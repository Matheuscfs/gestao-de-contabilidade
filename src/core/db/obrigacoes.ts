import { getSqlite } from "./client";
import { agora, hoje } from "@/utils/dates";
import {
  calcularVencimento,
  competenciasNaJanela,
  obrigacoesAplicaveis,
  obterObrigacao,
  type ContextoEmpresa,
  type ObrigacaoDef,
} from "@/consts/obrigacoes";
import type { Empresa } from "./empresas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StatusOcorrencia = "PENDENTE" | "ENTREGUE" | "PAGA" | "DISPENSADA";

export type OcorrenciaObrigacao = {
  id: string;
  empresaId: string;
  obrigacaoCodigo: string;
  competenciaMes: number;
  competenciaAno: number;
  /** ISO YYYY-MM-DD, já ajustado a dia útil. */
  vencimento: string;
  status: StatusOcorrencia;
  valorCents: number | null;
  concluidaEm: string | null;
  /** Definição do catálogo (nome, tipo, esfera…); null se o código saiu do catálogo. */
  def: ObrigacaoDef | null;
  /** Derivado: vencimento no passado e ainda pendente. */
  atrasada: boolean;
};

type OcorrenciaRow = {
  id: string;
  empresa_id: string;
  obrigacao_codigo: string;
  competencia_mes: number;
  competencia_ano: number;
  vencimento: string;
  status: string;
  valor_cents: number | null;
  concluida_em: string | null;
};

function mapearLinha(r: OcorrenciaRow, hojeISO: string): OcorrenciaObrigacao {
  const status = r.status as StatusOcorrencia;
  return {
    id: r.id,
    empresaId: r.empresa_id,
    obrigacaoCodigo: r.obrigacao_codigo,
    competenciaMes: r.competencia_mes,
    competenciaAno: r.competencia_ano,
    vencimento: r.vencimento,
    status,
    valorCents: r.valor_cents ?? null,
    concluidaEm: r.concluida_em ?? null,
    def: obterObrigacao(r.obrigacao_codigo),
    atrasada: status === "PENDENTE" && r.vencimento < hojeISO,
  };
}

// ─── Contexto da empresa ──────────────────────────────────────────────────────

/** Sócio com pró-labore > 0 e vínculo vigente? (alimenta a aplicabilidade). */
export async function empresaTemProLabore(empresaId: string): Promise<boolean> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM empresa_socios
      WHERE empresa_id = ? AND data_saida IS NULL AND pro_labore_cents > 0`,
    [empresaId]
  );
  return rows[0].n > 0;
}

async function contextoDaEmpresa(empresa: Empresa): Promise<ContextoEmpresa> {
  return {
    regime: empresa.regimeTributario,
    temFuncionarios: empresa.temFuncionarios,
    temProLabore: await empresaTemProLabore(empresa.id),
    regimeIbsCbs: empresa.regimeIbsCbs,
  };
}

// ─── Desativações por empresa ─────────────────────────────────────────────────

export async function listarDesativadas(empresaId: string): Promise<Set<string>> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ obrigacao_codigo: string }[]>(
    `SELECT obrigacao_codigo FROM obrigacoes_desativadas WHERE empresa_id = ?`,
    [empresaId]
  );
  return new Set(rows.map((r) => r.obrigacao_codigo));
}

/**
 * Ativa/desativa uma obrigação do catálogo para a empresa. Desativar remove as
 * ocorrências ainda pendentes (as concluídas ficam como histórico).
 */
export async function definirObrigacaoAtiva(
  empresaId: string,
  codigo: string,
  ativa: boolean
): Promise<void> {
  const sqlite = await getSqlite();
  if (ativa) {
    await sqlite.execute(
      `DELETE FROM obrigacoes_desativadas WHERE empresa_id = ? AND obrigacao_codigo = ?`,
      [empresaId, codigo]
    );
  } else {
    await sqlite.execute(
      `INSERT OR IGNORE INTO obrigacoes_desativadas (empresa_id, obrigacao_codigo, created_at)
       VALUES (?, ?, ?)`,
      [empresaId, codigo, agora()]
    );
    await sqlite.execute(
      `DELETE FROM obrigacoes_ocorrencias
        WHERE empresa_id = ? AND obrigacao_codigo = ? AND status = 'PENDENTE'`,
      [empresaId, codigo]
    );
  }
}

// ─── Geração de ocorrências ───────────────────────────────────────────────────

/**
 * Materializa as ocorrências das obrigações aplicáveis à empresa na janela
 * atual (idempotente: o índice único segura duplicatas via INSERT OR IGNORE).
 * Chamado ao abrir a aba de obrigações — mesma mecânica do motor de
 * ocorrências financeiras (`prepararCompetencia`).
 */
export async function prepararObrigacoes(empresa: Empresa): Promise<void> {
  const sqlite = await getSqlite();
  const ctx = await contextoDaEmpresa(empresa);
  const desativadas = await listarDesativadas(empresa.id);
  const defs = obrigacoesAplicaveis(ctx).filter(
    (d) => !desativadas.has(d.codigo)
  );

  const agoraTs = agora();
  const dataHoje = new Date();

  for (const def of defs) {
    const competencias = competenciasNaJanela(
      def,
      dataHoje,
      empresa.dataAbertura
    );
    for (const comp of competencias) {
      // ISS é municipal: o dia vem da empresa, não do catálogo.
      const vencimento = calcularVencimento(
        def,
        comp.mes,
        comp.ano,
        def.esfera === "MUNICIPAL" ? empresa.issDiaVencimento : null
      );
      await sqlite.execute(
        `INSERT OR IGNORE INTO obrigacoes_ocorrencias
           (id, empresa_id, obrigacao_codigo, competencia_mes, competencia_ano,
            vencimento, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?)`,
        [
          crypto.randomUUID(),
          empresa.id,
          def.codigo,
          comp.mes,
          comp.ano,
          vencimento,
          agoraTs,
          agoraTs,
        ]
      );
    }
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarOcorrencias(
  empresaId: string
): Promise<OcorrenciaObrigacao[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<OcorrenciaRow[]>(
    `SELECT id, empresa_id, obrigacao_codigo, competencia_mes, competencia_ano,
            vencimento, status, valor_cents, concluida_em
       FROM obrigacoes_ocorrencias
      WHERE empresa_id = ?
      ORDER BY vencimento ASC, obrigacao_codigo ASC`,
    [empresaId]
  );
  const hojeISO = hoje();
  return rows.map((r) => mapearLinha(r, hojeISO));
}

/** Pendências (inclui atrasadas) por empresa, para badges na listagem. */
export async function contarPendencias(): Promise<
  Record<string, { pendentes: number; atrasadas: number }>
> {
  const sqlite = await getSqlite();
  const hojeISO = hoje();
  const rows = await sqlite.select<
    { empresa_id: string; pendentes: number; atrasadas: number }[]
  >(
    `SELECT empresa_id,
            COUNT(*) AS pendentes,
            SUM(CASE WHEN vencimento < ? THEN 1 ELSE 0 END) AS atrasadas
       FROM obrigacoes_ocorrencias
      WHERE status = 'PENDENTE'
      GROUP BY empresa_id`,
    [hojeISO]
  );
  const mapa: Record<string, { pendentes: number; atrasadas: number }> = {};
  for (const r of rows) {
    mapa[r.empresa_id] = { pendentes: r.pendentes, atrasadas: r.atrasadas };
  }
  return mapa;
}

/** Conclui (ENTREGUE/PAGA), dispensa ou reabre (PENDENTE) uma ocorrência. */
export async function atualizarStatusOcorrencia(
  id: string,
  status: StatusOcorrencia,
  valorCents?: number | null
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const concluida = status !== "PENDENTE" ? ts : null;
  const gravaValor = valorCents !== undefined;
  await sqlite.execute(
    `UPDATE obrigacoes_ocorrencias
        SET status = ?, concluida_em = ?, ${gravaValor ? "valor_cents = ?," : ""} updated_at = ?
      WHERE id = ?`,
    gravaValor
      ? [status, concluida, valorCents, ts, id]
      : [status, concluida, ts, id]
  );
}
