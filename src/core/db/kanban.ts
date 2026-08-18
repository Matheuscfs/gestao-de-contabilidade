/**
 * Quadro Kanban das obrigações de uma competência.
 *
 * Um card é uma **ocorrência de obrigação** (empresa + obrigação + competência)
 * — a mesma linha que o motor da Fase 2 já gera. O que a Fase 7 acrescenta é o
 * checklist: as etapas do fluxo configurado, instanciadas por ocorrência.
 *
 * A coluna do card é **derivada**, nunca gravada — mesma postura de "ATRASADA"
 * nas obrigações e de "atrasado" nos processos:
 *
 *   CONCLUIDO ⟸ status entregue/paga/dispensada
 *   FAZENDO   ⟸ pendente com ao menos uma etapa cumprida
 *   A_FAZER   ⟸ pendente sem nenhuma etapa cumprida
 *
 * Assim não existe estado que possa divergir do checklist: marcar a primeira
 * etapa move o card, e o card nunca "mente" sobre o progresso.
 */

import { getSqlite } from "./client";
import { agora, hoje } from "@/utils/dates";
import {
  calcularVencimento,
  obterObrigacao,
  obrigacoesAplicaveis,
  type ContextoEmpresa,
} from "@/consts/obrigacoes";
import { etapaSeAplica, type CondicaoEtapa } from "@/consts/fluxos";
import type { StatusOcorrencia } from "./obrigacoes";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ColunaKanban = "A_FAZER" | "FAZENDO" | "CONCLUIDO";

export const COLUNAS: { id: ColunaKanban; label: string }[] = [
  { id: "A_FAZER", label: "A fazer" },
  { id: "FAZENDO", label: "Fazendo" },
  { id: "CONCLUIDO", label: "Concluído" },
];

export type EtapaCard = {
  id: string;
  descricao: string;
  ordem: number;
  concluida: boolean;
};

export type CardKanban = {
  /** id da ocorrência — é a identidade do card. */
  id: string;
  empresaId: string;
  empresaNome: string;
  obrigacaoCodigo: string;
  /** Nome do catálogo (ex.: "DAS"); cai no código se o catálogo mudou. */
  obrigacaoNome: string;
  competenciaMes: number;
  competenciaAno: number;
  vencimento: string;
  status: StatusOcorrencia;
  atrasada: boolean;
  etapas: EtapaCard[];
  coluna: ColunaKanban;
};

// ─── Derivação da coluna ──────────────────────────────────────────────────────

export function colunaDoCard(
  status: StatusOcorrencia,
  etapas: { concluida: boolean }[]
): ColunaKanban {
  if (status !== "PENDENTE") return "CONCLUIDO";
  return etapas.some((e) => e.concluida) ? "FAZENDO" : "A_FAZER";
}

// ─── Geração do quadro ────────────────────────────────────────────────────────

type EmpresaParaQuadro = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  data_abertura: string | null;
  regime_tributario: string;
  regime_ibs_cbs: string | null;
  tem_funcionarios: number;
  sem_movimento: number;
  tem_pro_labore: number;
};

/**
 * Materializa o quadro da competência: garante uma ocorrência por obrigação
 * aplicável de cada empresa ativa e instancia as etapas do fluxo que ainda
 * faltam. Idempotente — pode rodar a cada abertura da tela.
 *
 * Diferente de `prepararObrigacoes`, que trabalha uma empresa na janela móvel
 * de competências, este prepara **todas as empresas numa competência escolhida**
 * — é o "gerar o Kanban do mês".
 */
export async function prepararQuadro(mes: number, ano: number): Promise<void> {
  const sqlite = await getSqlite();

  const empresas = await sqlite.select<EmpresaParaQuadro[]>(
    `SELECT e.id, e.razao_social, e.nome_fantasia, e.data_abertura,
            e.regime_tributario, e.regime_ibs_cbs, e.tem_funcionarios, e.sem_movimento,
            (SELECT COUNT(*) FROM empresa_socios s
              WHERE s.empresa_id = e.id AND s.data_saida IS NULL
                AND s.pro_labore_cents > 0) AS tem_pro_labore
       FROM empresas e
      WHERE e.archived = 0 AND e.status = 'ATIVA'
      ORDER BY e.razao_social COLLATE NOCASE ASC`
  );

  const desativadas = await sqlite.select<
    { empresa_id: string; obrigacao_codigo: string }[]
  >(`SELECT empresa_id, obrigacao_codigo FROM obrigacoes_desativadas`);
  const desativadasPorEmpresa = new Map<string, Set<string>>();
  for (const d of desativadas) {
    const set = desativadasPorEmpresa.get(d.empresa_id) ?? new Set();
    set.add(d.obrigacao_codigo);
    desativadasPorEmpresa.set(d.empresa_id, set);
  }

  const fluxos = await sqlite.select<
    {
      id: string;
      obrigacao_codigo: string;
      descricao: string;
      ordem: number;
      condicao: string | null;
    }[]
  >(
    `SELECT id, obrigacao_codigo, descricao, ordem, condicao
       FROM obrigacao_fluxo_etapas ORDER BY obrigacao_codigo, ordem`
  );
  const fluxoPorCodigo = new Map<string, typeof fluxos>();
  for (const f of fluxos) {
    const lista = fluxoPorCodigo.get(f.obrigacao_codigo) ?? [];
    lista.push(f);
    fluxoPorCodigo.set(f.obrigacao_codigo, lista);
  }

  // Ocorrências que já existem na competência, num único SELECT. Sem isto
  // seria uma consulta por obrigação de cada empresa só para descobrir o id
  // recém-inserido — algumas centenas de idas ao banco a cada troca de mês.
  const existentes = await sqlite.select<
    { id: string; empresa_id: string; obrigacao_codigo: string }[]
  >(
    `SELECT id, empresa_id, obrigacao_codigo FROM obrigacoes_ocorrencias
      WHERE competencia_mes = ? AND competencia_ano = ?`,
    [mes, ano]
  );
  const idPorChave = new Map(
    existentes.map((o) => [`${o.empresa_id}|${o.obrigacao_codigo}`, o.id])
  );

  const ts = agora();

  for (const empresa of empresas) {
    const ctxEmpresa: ContextoEmpresa = {
      regime: empresa.regime_tributario as ContextoEmpresa["regime"],
      temFuncionarios: empresa.tem_funcionarios === 1,
      temProLabore: empresa.tem_pro_labore > 0,
      regimeIbsCbs: empresa.regime_ibs_cbs as ContextoEmpresa["regimeIbsCbs"],
    };
    const ctxEtapa = {
      temProLabore: empresa.tem_pro_labore > 0,
      temFuncionarios: empresa.tem_funcionarios === 1,
      semMovimento: empresa.sem_movimento === 1,
    };
    const off = desativadasPorEmpresa.get(empresa.id) ?? new Set<string>();

    // Empresa aberta depois da competência não deve nada nela.
    if (empresa.data_abertura && empresa.data_abertura.slice(0, 7) > competenciaISO(mes, ano)) {
      continue;
    }

    for (const def of obrigacoesAplicaveis(ctxEmpresa)) {
      if (off.has(def.codigo)) continue;
      // Só mensais entram no quadro do mês; trimestrais entram no trimestre que
      // fecham e anuais na competência 12, seguindo o próprio catálogo.
      if (def.periodicidade === "TRIMESTRAL" && mes % 3 !== 0) continue;
      if (def.periodicidade === "ANUAL" && mes !== 12) continue;
      if (def.vigencia?.deAno != null && ano < def.vigencia.deAno) continue;
      if (def.vigencia?.ateAno != null && ano > def.vigencia.ateAno) continue;

      const chave = `${empresa.id}|${def.codigo}`;
      let ocorrenciaId = idPorChave.get(chave);

      if (!ocorrenciaId) {
        ocorrenciaId = crypto.randomUUID();
        await sqlite.execute(
          `INSERT INTO obrigacoes_ocorrencias
             (id, empresa_id, obrigacao_codigo, competencia_mes, competencia_ano,
              vencimento, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?)`,
          [
            ocorrenciaId,
            empresa.id,
            def.codigo,
            mes,
            ano,
            calcularVencimento(def, mes, ano),
            ts,
            ts,
          ]
        );
        idPorChave.set(chave, ocorrenciaId);
      }

      const etapasDoFluxo = fluxoPorCodigo.get(def.codigo) ?? [];
      let ordem = 0;
      for (const etapa of etapasDoFluxo) {
        if (!etapaSeAplica(etapa.condicao as CondicaoEtapa | null, ctxEtapa)) {
          continue;
        }
        // O índice único (ocorrencia_id, fluxo_etapa_id) segura a reexecução.
        await sqlite.execute(
          `INSERT OR IGNORE INTO obrigacao_ocorrencia_etapas
             (id, ocorrencia_id, fluxo_etapa_id, descricao, ordem, concluida,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            crypto.randomUUID(),
            ocorrenciaId,
            etapa.id,
            etapa.descricao,
            ordem++,
            ts,
            ts,
          ]
        );
      }
    }
  }
}

function competenciaISO(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

// ─── Leitura do quadro ────────────────────────────────────────────────────────

type CardRow = {
  id: string;
  empresa_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  obrigacao_codigo: string;
  competencia_mes: number;
  competencia_ano: number;
  vencimento: string;
  status: string;
};

type EtapaRow = {
  id: string;
  ocorrencia_id: string;
  descricao: string;
  ordem: number;
  concluida: number;
};

export async function listarQuadro(
  mes: number,
  ano: number
): Promise<CardKanban[]> {
  const sqlite = await getSqlite();

  const [cards, etapas] = await Promise.all([
    sqlite.select<CardRow[]>(
      `SELECT o.id, o.empresa_id, e.razao_social, e.nome_fantasia,
              o.obrigacao_codigo, o.competencia_mes, o.competencia_ano,
              o.vencimento, o.status
         FROM obrigacoes_ocorrencias o
         JOIN empresas e ON e.id = o.empresa_id
        WHERE o.competencia_mes = ? AND o.competencia_ano = ? AND e.archived = 0
        ORDER BY o.vencimento ASC, e.razao_social COLLATE NOCASE ASC`,
      [mes, ano]
    ),
    sqlite.select<EtapaRow[]>(
      `SELECT et.id, et.ocorrencia_id, et.descricao, et.ordem, et.concluida
         FROM obrigacao_ocorrencia_etapas et
         JOIN obrigacoes_ocorrencias o ON o.id = et.ocorrencia_id
        WHERE o.competencia_mes = ? AND o.competencia_ano = ?
        ORDER BY et.ordem ASC`,
      [mes, ano]
    ),
  ]);

  const etapasPorCard = new Map<string, EtapaCard[]>();
  for (const e of etapas) {
    const lista = etapasPorCard.get(e.ocorrencia_id) ?? [];
    lista.push({
      id: e.id,
      descricao: e.descricao,
      ordem: e.ordem,
      concluida: e.concluida === 1,
    });
    etapasPorCard.set(e.ocorrencia_id, lista);
  }

  const hojeISO = hoje();
  return cards.map((c) => {
    const status = c.status as StatusOcorrencia;
    const lista = etapasPorCard.get(c.id) ?? [];
    const def = obterObrigacao(c.obrigacao_codigo);
    return {
      id: c.id,
      empresaId: c.empresa_id,
      empresaNome: c.nome_fantasia || c.razao_social,
      obrigacaoCodigo: c.obrigacao_codigo,
      obrigacaoNome: def?.nome ?? c.obrigacao_codigo,
      competenciaMes: c.competencia_mes,
      competenciaAno: c.competencia_ano,
      vencimento: c.vencimento,
      status,
      atrasada: status === "PENDENTE" && c.vencimento < hojeISO,
      etapas: lista,
      coluna: colunaDoCard(status, lista),
    };
  });
}

// ─── Ações ────────────────────────────────────────────────────────────────────

export async function alternarEtapaCard(
  etapaId: string,
  concluida: boolean
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  await sqlite.execute(
    `UPDATE obrigacao_ocorrencia_etapas
        SET concluida = ?, concluida_em = ?, updated_at = ?
      WHERE id = ?`,
    [concluida ? 1 : 0, concluida ? ts : null, ts, etapaId]
  );
}

/**
 * Move o card para uma coluna. Como a coluna é derivada, mover significa
 * ajustar o que a origina — status e checklist — de forma que o card caia
 * mesmo na coluna pedida.
 */
export async function moverCard(
  ocorrenciaId: string,
  coluna: ColunaKanban
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();

  if (coluna === "CONCLUIDO") {
    await sqlite.execute(
      `UPDATE obrigacao_ocorrencia_etapas
          SET concluida = 1, concluida_em = COALESCE(concluida_em, ?), updated_at = ?
        WHERE ocorrencia_id = ?`,
      [ts, ts, ocorrenciaId]
    );
    await sqlite.execute(
      `UPDATE obrigacoes_ocorrencias
          SET status = 'ENTREGUE', concluida_em = ?, updated_at = ?
        WHERE id = ?`,
      [ts, ts, ocorrenciaId]
    );
    return;
  }

  // Voltar para pendente em ambos os casos; o que muda é o checklist.
  await sqlite.execute(
    `UPDATE obrigacoes_ocorrencias
        SET status = 'PENDENTE', concluida_em = NULL, updated_at = ?
      WHERE id = ?`,
    [ts, ocorrenciaId]
  );

  if (coluna === "A_FAZER") {
    await sqlite.execute(
      `UPDATE obrigacao_ocorrencia_etapas
          SET concluida = 0, concluida_em = NULL, updated_at = ?
        WHERE ocorrencia_id = ?`,
      [ts, ocorrenciaId]
    );
    return;
  }

  // FAZENDO: precisa de ao menos uma etapa cumprida para cair nesta coluna.
  const feitas = await sqlite.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM obrigacao_ocorrencia_etapas
      WHERE ocorrencia_id = ? AND concluida = 1`,
    [ocorrenciaId]
  );
  if ((feitas[0]?.n ?? 0) > 0) return;

  const primeira = await sqlite.select<{ id: string }[]>(
    `SELECT id FROM obrigacao_ocorrencia_etapas
      WHERE ocorrencia_id = ? ORDER BY ordem ASC LIMIT 1`,
    [ocorrenciaId]
  );
  if (primeira.length === 0) {
    // Card sem checklist não tem como ficar "no meio": mantém em A fazer.
    return;
  }
  await alternarEtapaCard(primeira[0].id, true);
}

/** Marca todas as etapas e conclui — atalho usado pela IA e pelo botão do card. */
export async function concluirCard(ocorrenciaId: string): Promise<void> {
  return moverCard(ocorrenciaId, "CONCLUIDO");
}

/** Adiciona uma etapa avulsa a um card (fora do fluxo configurado). */
export async function adicionarEtapaAvulsa(
  ocorrenciaId: string,
  descricao: string
): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();
  const ultimo = await sqlite.select<{ n: number | null }[]>(
    `SELECT MAX(ordem) AS n FROM obrigacao_ocorrencia_etapas WHERE ocorrencia_id = ?`,
    [ocorrenciaId]
  );
  await sqlite.execute(
    `INSERT INTO obrigacao_ocorrencia_etapas
       (id, ocorrencia_id, fluxo_etapa_id, descricao, ordem, concluida, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 0, ?, ?)`,
    [
      crypto.randomUUID(),
      ocorrenciaId,
      descricao.trim(),
      (ultimo[0]?.n ?? -1) + 1,
      ts,
      ts,
    ]
  );
}

export async function excluirEtapaCard(etapaId: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `DELETE FROM obrigacao_ocorrencia_etapas WHERE id = ?`,
    [etapaId]
  );
}
