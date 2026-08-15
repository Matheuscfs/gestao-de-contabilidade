import { getSqlite } from "./client";
import { agora, hoje } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoProcesso =
  | "ABERTURA"
  | "ALTERACAO"
  | "PARCELAMENTO"
  | "CERTIDAO"
  | "DEFESA"
  | "REGULARIZACAO"
  | "BAIXA"
  | "OUTRO";

export type StatusProcesso =
  | "EM_ANDAMENTO"
  | "AGUARDANDO"
  | "CONCLUIDO"
  | "CANCELADO";

export const LABEL_TIPO_PROCESSO: Record<TipoProcesso, string> = {
  ABERTURA: "Abertura",
  ALTERACAO: "Alteração contratual",
  PARCELAMENTO: "Parcelamento",
  CERTIDAO: "Certidões",
  DEFESA: "Defesa administrativa",
  REGULARIZACAO: "Regularização",
  BAIXA: "Baixa",
  OUTRO: "Outro",
};

export const LABEL_STATUS_PROCESSO: Record<StatusProcesso, string> = {
  EM_ANDAMENTO: "em andamento",
  AGUARDANDO: "aguardando",
  CONCLUIDO: "concluído",
  CANCELADO: "cancelado",
};

/** Checklists sugeridos ao criar um processo, por tipo. */
export const ETAPAS_SUGERIDAS: Record<TipoProcesso, string[]> = {
  ABERTURA: [
    "Consulta de viabilidade (nome e endereço)",
    "DBE / Coleta Web na Receita Federal",
    "Contrato social assinado",
    "Registro na Junta Comercial",
    "CNPJ emitido",
    "Inscrições estadual/municipal",
    "Alvará de funcionamento",
    "Certificado digital",
  ],
  ALTERACAO: [
    "Minuta da alteração contratual",
    "Assinaturas dos sócios",
    "Registro na Junta Comercial",
    "Atualização na Receita (DBE)",
    "Atualização das inscrições",
  ],
  PARCELAMENTO: [
    "Levantamento dos débitos",
    "Adesão ao parcelamento",
    "Primeira parcela paga",
    "Acompanhamento das parcelas",
  ],
  CERTIDAO: [
    "CND federal (RFB/PGFN)",
    "CND estadual",
    "CND municipal",
    "CRF do FGTS",
    "CNDT trabalhista",
  ],
  DEFESA: [
    "Análise da notificação/auto",
    "Reunir documentação",
    "Protocolar defesa/impugnação",
    "Acompanhar julgamento",
  ],
  REGULARIZACAO: [
    "Diagnóstico das pendências",
    "Entrega de declarações em atraso",
    "Regularização dos débitos",
    "Confirmação da situação fiscal",
  ],
  BAIXA: [
    "Quitação de débitos e obrigações",
    "Distrato social assinado",
    "Baixa na Junta Comercial",
    "Baixa do CNPJ",
    "Baixa das inscrições",
  ],
  OUTRO: [],
};

export type EtapaProcesso = {
  id: string;
  descricao: string;
  ordem: number;
  concluida: boolean;
};

export type Processo = {
  id: string;
  empresaId: string;
  titulo: string;
  tipo: TipoProcesso;
  descricao: string | null;
  prazo: string | null;
  status: StatusProcesso;
  concluidoEm: string | null;
  etapas: EtapaProcesso[];
  /** Derivado: prazo no passado e ainda não concluído/cancelado. */
  atrasado: boolean;
};

export type DadosProcesso = {
  titulo: string;
  tipo: TipoProcesso;
  descricao: string | null;
  prazo: string | null;
};

type ProcessoRow = {
  id: string;
  empresa_id: string;
  titulo: string;
  tipo: string;
  descricao: string | null;
  prazo: string | null;
  status: string;
  concluido_em: string | null;
};

type EtapaRow = {
  id: string;
  processo_id: string;
  descricao: string;
  ordem: number;
  concluida: number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarProcessos(empresaId: string): Promise<Processo[]> {
  const sqlite = await getSqlite();
  const [processos, etapas] = await Promise.all([
    sqlite.select<ProcessoRow[]>(
      `SELECT id, empresa_id, titulo, tipo, descricao, prazo, status, concluido_em
         FROM processos
        WHERE empresa_id = ?
        ORDER BY (status IN ('CONCLUIDO','CANCELADO')) ASC,
                 prazo IS NULL ASC, prazo ASC, created_at DESC`,
      [empresaId]
    ),
    sqlite.select<EtapaRow[]>(
      `SELECT e.id, e.processo_id, e.descricao, e.ordem, e.concluida
         FROM processo_etapas e
         JOIN processos p ON p.id = e.processo_id
        WHERE p.empresa_id = ?
        ORDER BY e.ordem ASC, e.created_at ASC`,
      [empresaId]
    ),
  ]);

  const etapasPorProcesso = new Map<string, EtapaProcesso[]>();
  for (const e of etapas) {
    const lista = etapasPorProcesso.get(e.processo_id) ?? [];
    lista.push({
      id: e.id,
      descricao: e.descricao,
      ordem: e.ordem,
      concluida: e.concluida === 1,
    });
    etapasPorProcesso.set(e.processo_id, lista);
  }

  const hojeISO = hoje();
  return processos.map((p) => {
    const status = p.status as StatusProcesso;
    return {
      id: p.id,
      empresaId: p.empresa_id,
      titulo: p.titulo,
      tipo: p.tipo as TipoProcesso,
      descricao: p.descricao ?? null,
      prazo: p.prazo ?? null,
      status,
      concluidoEm: p.concluido_em ?? null,
      etapas: etapasPorProcesso.get(p.id) ?? [],
      atrasado:
        (status === "EM_ANDAMENTO" || status === "AGUARDANDO") &&
        p.prazo != null &&
        p.prazo < hojeISO,
    };
  });
}

/** Processos em andamento/aguardando por empresa, para o chip da listagem. */
export async function contarProcessosAtivos(): Promise<Record<string, number>> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ empresa_id: string; n: number }[]>(
    `SELECT empresa_id, COUNT(*) AS n FROM processos
      WHERE status IN ('EM_ANDAMENTO','AGUARDANDO')
      GROUP BY empresa_id`
  );
  const mapa: Record<string, number> = {};
  for (const r of rows) mapa[r.empresa_id] = r.n;
  return mapa;
}

export async function criarProcesso(
  empresaId: string,
  dados: DadosProcesso,
  etapas: string[]
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const processoId = crypto.randomUUID();
  await sqlite.execute(
    `INSERT INTO processos
       (id, empresa_id, titulo, tipo, descricao, prazo, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'EM_ANDAMENTO', ?, ?)`,
    [
      processoId,
      empresaId,
      dados.titulo.trim(),
      dados.tipo,
      dados.descricao?.trim() || null,
      dados.prazo,
      ts,
      ts,
    ]
  );
  let ordem = 0;
  for (const descricao of etapas) {
    if (!descricao.trim()) continue;
    await sqlite.execute(
      `INSERT INTO processo_etapas
         (id, processo_id, descricao, ordem, concluida, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [crypto.randomUUID(), processoId, descricao.trim(), ordem++, ts, ts]
    );
  }
}

export async function editarProcesso(
  id: string,
  dados: DadosProcesso
): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE processos
        SET titulo = ?, tipo = ?, descricao = ?, prazo = ?, updated_at = ?
      WHERE id = ?`,
    [
      dados.titulo.trim(),
      dados.tipo,
      dados.descricao?.trim() || null,
      dados.prazo,
      agora(),
      id,
    ]
  );
}

export async function atualizarStatusProcesso(
  id: string,
  status: StatusProcesso
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const concluido =
    status === "CONCLUIDO" || status === "CANCELADO" ? ts : null;
  await sqlite.execute(
    `UPDATE processos SET status = ?, concluido_em = ?, updated_at = ? WHERE id = ?`,
    [status, concluido, ts, id]
  );
}

export async function excluirProcesso(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM processos WHERE id = ?`, [id]);
}

// ─── Etapas ───────────────────────────────────────────────────────────────────

export async function adicionarEtapa(
  processoId: string,
  descricao: string
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const rows = await sqlite.select<{ max_ordem: number | null }[]>(
    `SELECT MAX(ordem) AS max_ordem FROM processo_etapas WHERE processo_id = ?`,
    [processoId]
  );
  const ordem = (rows[0].max_ordem ?? -1) + 1;
  await sqlite.execute(
    `INSERT INTO processo_etapas
       (id, processo_id, descricao, ordem, concluida, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [crypto.randomUUID(), processoId, descricao.trim(), ordem, ts, ts]
  );
}

export async function alternarEtapa(
  id: string,
  concluida: boolean
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `UPDATE processo_etapas
        SET concluida = ?, concluida_em = ?, updated_at = ?
      WHERE id = ?`,
    [concluida ? 1 : 0, concluida ? ts : null, ts, id]
  );
}

export async function excluirEtapa(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM processo_etapas WHERE id = ?`, [id]);
}
