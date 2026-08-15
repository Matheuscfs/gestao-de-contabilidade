import { getSqlite } from "./client";

// ─── Agregados de análise ─────────────────────────────────────────────────────
//
// Tudo aqui lê `transactions` e responde três perguntas sobre um INTERVALO de
// competências: quanto entrou, quanto saiu e para onde foi.
//
// As regras são as mesmas de `mes.ts` — repetidas aqui de propósito, porque são
// justamente elas que impedem número torto na tela:
//
//   entrou → INCOME, SALARY
//   saiu   → EXPENSE, LIVING_COST, DEBT_INSTALLMENT
//            + INVOICE com source <> 'PLUGGY'
//
// O que fica DE FORA e por quê:
//   • is_template = 1 — são as regras cadastradas (o salário, o custo fixo),
//     não o dinheiro que de fato circulou.
//   • INVOICE com source = 'PLUGGY' — a fatura criada pelo sync é exatamente a
//     SOMA dos EXPENSE daquele cartão na competência. Somar as duas contaria o
//     mesmo dinheiro duas vezes, então o gasto do cartão entra só pelos EXPENSE.
//     Já a fatura lançada à mão (source = 'MANUAL') CONTA: nesse caso não há
//     EXPENSE individuais por trás dela, e ignorá-la esconderia o gasto.
//   • TRANSFER — dinheiro trocando de bolso (inclusive pagamento de fatura),
//     não é entrada nem saída.
//   • INVESTMENT — aplicação é patrimônio, tem tela própria.
//   • Status não confirmado (PREVISTO/CANCELADO/…) — ainda não é fato.
//
// Competência: `month`/`year` mandam; quando estão em branco, caímos para o
// mês/ano de `date` ou `due_date`.
// ─────────────────────────────────────────────────────────────────────────────

/** Uma competência: mês (1-12) + ano. */
export type Competencia = { mes: number; ano: number };

/** Totais consolidados de um intervalo de competências, em centavos. */
export type ResumoAgregado = {
  /** Total que entrou no intervalo. */
  entrouCents: number;
  /** Total que saiu no intervalo. */
  saiuCents: number;
  /** Sobra (entrou − saiu). Pode ser negativa. */
  saldoCents: number;
  /** Quantas transações confirmadas sustentam esses números. */
  total: number;
};

/** Um ponto da série mensal — o resumo de uma única competência. */
export type PontoMensal = Competencia & ResumoAgregado;

/** Quanto saiu por categoria dentro do intervalo. */
export type GastoCategoria = {
  /** `null` quando o lançamento não tem categoria vinculada. */
  id: string | null;
  nome: string;
  cor: string;
  icone: string | null;
  totalCents: number;
  lancamentos: number;
};

// ─── Aritmética de competência ────────────────────────────────────────────────
//
// Comparar (mês, ano) em SQL é chato quando o intervalo cruza o ano. Reduzimos
// a competência a um índice inteiro contínuo (ano * 12 + mês − 1) tanto aqui
// quanto na query, e a comparação vira um BETWEEN simples.
// ─────────────────────────────────────────────────────────────────────────────

/** Converte uma competência em índice contínuo. Ex.: jan/2025 → 24300. */
export function indiceCompetencia({ mes, ano }: Competencia): number {
  return ano * 12 + (mes - 1);
}

/** Caminho inverso: índice contínuo → competência. */
export function competenciaDoIndice(indice: number): Competencia {
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** Anda `meses` para frente (positivo) ou para trás (negativo). */
export function deslocarCompetencia(c: Competencia, meses: number): Competencia {
  return competenciaDoIndice(indiceCompetencia(c) + meses);
}

/** Todas as competências do intervalo, do início ao fim, inclusive. */
export function competenciasDoIntervalo(
  inicio: Competencia,
  fim: Competencia
): Competencia[] {
  const i = indiceCompetencia(inicio);
  const f = indiceCompetencia(fim);
  const lista: Competencia[] = [];
  for (let k = i; k <= f; k++) lista.push(competenciaDoIndice(k));
  return lista;
}

/** Quantos meses o intervalo cobre (mínimo 1). */
export function tamanhoDoIntervalo(inicio: Competencia, fim: Competencia): number {
  return Math.max(1, indiceCompetencia(fim) - indiceCompetencia(inicio) + 1);
}

// ─── Pedaços de SQL compartilhados ────────────────────────────────────────────

/** Statuses que representam dinheiro que de fato circulou. */
const STATUS_CONFIRMADOS = "('CONFIRMADO', 'PAGO')";

/** Ano da competência, com fallback para a data do lançamento. */
const ANO_SQL =
  "COALESCE(t.year, CAST(strftime('%Y', COALESCE(t.date, t.due_date)) AS INTEGER))";

/** Mês da competência, com fallback para a data do lançamento. */
const MES_SQL =
  "COALESCE(t.month, CAST(strftime('%m', COALESCE(t.date, t.due_date)) AS INTEGER))";

/** Competência reduzida a índice contínuo — espelha `indiceCompetencia`. */
const INDICE_SQL = `(${ANO_SQL} * 12 + ${MES_SQL} - 1)`;

/** Tipos que contam como saída (com a exceção da fatura agregada da Pluggy). */
const EH_SAIDA_SQL = `(
  t.type IN ('EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
  OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
)`;

/** Tipos que contam como entrada. */
const EH_ENTRADA_SQL = "t.type IN ('INCOME', 'SALARY')";

/** Filtro comum: movimento real, confirmado, de um tipo que entra na conta. */
const FILTRO_BASE_SQL = `t.is_template = 0
  AND t.status IN ${STATUS_CONFIRMADOS}
  AND (${EH_ENTRADA_SQL} OR ${EH_SAIDA_SQL})
  AND ${INDICE_SQL} BETWEEN $1 AND $2`;

/** Cor usada quando o lançamento não tem categoria (token ink-placeholder). */
const COR_SEM_CATEGORIA = "#B5BCC9";

// ─── Queries ──────────────────────────────────────────────────────────────────

type LinhaResumo = {
  entrou: number | null;
  saiu: number | null;
  total: number | null;
};

function montarResumo(r: LinhaResumo | undefined): ResumoAgregado {
  const entrouCents = r?.entrou ?? 0;
  const saiuCents = r?.saiu ?? 0;
  return {
    entrouCents,
    saiuCents,
    saldoCents: entrouCents - saiuCents,
    total: r?.total ?? 0,
  };
}

/**
 * Entrou / saiu / sobra de um intervalo de competências (inclusive nas pontas).
 * Para um único mês, basta passar a mesma competência nas duas pontas.
 */
export async function resumoDoIntervalo(
  inicio: Competencia,
  fim: Competencia
): Promise<ResumoAgregado> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LinhaResumo[]>(
    `SELECT
        COALESCE(SUM(CASE WHEN ${EH_ENTRADA_SQL}
                          THEN COALESCE(t.amount_cents, 0) ELSE 0 END), 0) AS entrou,
        COALESCE(SUM(CASE WHEN ${EH_SAIDA_SQL}
                          THEN COALESCE(t.amount_cents, 0) ELSE 0 END), 0) AS saiu,
        COUNT(*) AS total
       FROM transactions t
      WHERE ${FILTRO_BASE_SQL}`,
    [indiceCompetencia(inicio), indiceCompetencia(fim)]
  );
  return montarResumo(rows[0]);
}

type LinhaSerie = LinhaResumo & { mes: number | null; ano: number | null };

/**
 * Série mês a mês do intervalo. Competências sem nenhum movimento confirmado
 * voltam zeradas (e com `total = 0`), para o gráfico ter todas as colunas —
 * cabe a quem desenha diferenciar "zero" de "sem dado" olhando `total`.
 */
export async function serieMensal(
  inicio: Competencia,
  fim: Competencia
): Promise<PontoMensal[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LinhaSerie[]>(
    `SELECT
        ${MES_SQL} AS mes,
        ${ANO_SQL} AS ano,
        COALESCE(SUM(CASE WHEN ${EH_ENTRADA_SQL}
                          THEN COALESCE(t.amount_cents, 0) ELSE 0 END), 0) AS entrou,
        COALESCE(SUM(CASE WHEN ${EH_SAIDA_SQL}
                          THEN COALESCE(t.amount_cents, 0) ELSE 0 END), 0) AS saiu,
        COUNT(*) AS total
       FROM transactions t
      WHERE ${FILTRO_BASE_SQL}
      GROUP BY ano, mes
      ORDER BY ano, mes`,
    [indiceCompetencia(inicio), indiceCompetencia(fim)]
  );

  const porIndice = new Map<number, LinhaSerie>();
  for (const r of rows) {
    if (r.mes == null || r.ano == null) continue;
    porIndice.set(indiceCompetencia({ mes: r.mes, ano: r.ano }), r);
  }

  return competenciasDoIntervalo(inicio, fim).map((c) => ({
    ...c,
    ...montarResumo(porIndice.get(indiceCompetencia(c))),
  }));
}

type LinhaCategoria = {
  id: string | null;
  nome: string | null;
  cor: string | null;
  icone: string | null;
  total: number | null;
  lancamentos: number | null;
};

/**
 * Quanto saiu por categoria no intervalo, do maior para o menor. Só saídas —
 * receita por categoria é outra pergunta. Lançamentos sem categoria vinculada
 * são agrupados em uma linha "Sem categoria" em vez de sumirem do total.
 */
export async function gastosPorCategoria(
  inicio: Competencia,
  fim: Competencia
): Promise<GastoCategoria[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LinhaCategoria[]>(
    `SELECT
        t.category_id AS id,
        c.name  AS nome,
        c.color AS cor,
        c.icon  AS icone,
        COALESCE(SUM(COALESCE(t.amount_cents, 0)), 0) AS total,
        COUNT(*) AS lancamentos
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.is_template = 0
        AND t.status IN ${STATUS_CONFIRMADOS}
        AND ${EH_SAIDA_SQL}
        AND ${INDICE_SQL} BETWEEN $1 AND $2
      GROUP BY t.category_id
      ORDER BY total DESC`,
    [indiceCompetencia(inicio), indiceCompetencia(fim)]
  );

  return rows
    .map((r) => ({
      id: r.id ?? null,
      nome: r.nome ?? "Sem categoria",
      cor: r.cor ?? COR_SEM_CATEGORIA,
      icone: r.icone ?? null,
      totalCents: r.total ?? 0,
      lancamentos: r.lancamentos ?? 0,
    }))
    .filter((g) => g.totalCents > 0);
}
