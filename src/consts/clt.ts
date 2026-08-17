/**
 * Parâmetros e cálculos de remuneração CLT no Brasil — tabelas vigentes em 2026.
 *
 * Fontes: tabela progressiva do INSS de 2026 (salário mínimo R$ 1.621,00, teto
 * R$ 8.475,55) e tabela progressiva do IRRF de 2026 (isenção até R$ 2.428,80 e
 * desconto simplificado de R$ 607,20).
 *
 * Estas tabelas não servem só à folha CLT: `tributos.ts` reaproveita o cálculo
 * de IRRF daqui para o pró-labore do sócio. Por isso o ano vem de
 * `ano-fiscal.ts` — as duas pontas precisam virar de ano juntas.
 *
 * Todos os valores monetários são em CENTAVOS (inteiros) para evitar erros de
 * ponto flutuante. As estimativas são uma aproximação para dar uma noção do
 * líquido — não substituem o cálculo da folha (que pode ter outras verbas).
 */

import { ANO_FISCAL } from "./ano-fiscal";

export const CLT_ANO_REFERENCIA = ANO_FISCAL;

// ─── Modalidade ────────────────────────────────────────────────────────────────

export type Modalidade = "PJ" | "CLT" | "OUTRO";

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  PJ: "PJ",
  CLT: "CLT",
  OUTRO: "Outro",
};

// ─── INSS — contribuição do empregado (tabela progressiva 2025) ─────────────────

/** Faixas do INSS: alíquota aplicada à parcela do salário dentro da faixa. */
export const INSS_FAIXAS: readonly { ateCents: number; aliquota: number }[] = [
  { ateCents: 162_100, aliquota: 0.075 }, // até R$ 1.621,00 (salário mínimo)
  { ateCents: 290_284, aliquota: 0.09 }, // até R$ 2.902,84
  { ateCents: 435_427, aliquota: 0.12 }, // até R$ 4.354,27
  { ateCents: 847_555, aliquota: 0.14 }, // teto: R$ 8.475,55
];

/** Teto de contribuição do INSS (salário base máximo). */
export const INSS_TETO_BASE_CENTS = 847_555;

// ─── IRRF — imposto de renda retido na fonte (tabela mensal 2026) ───────────────

/** Faixas do IRRF: aplica `aliquota` sobre a base e subtrai a `parcelaDeduzir`. */
export const IRRF_FAIXAS: readonly {
  ateCents: number;
  aliquota: number;
  parcelaDeduzirCents: number;
}[] = [
  { ateCents: 242_880, aliquota: 0, parcelaDeduzirCents: 0 }, // isento até R$ 2.428,80
  { ateCents: 282_665, aliquota: 0.075, parcelaDeduzirCents: 18_216 },
  { ateCents: 375_105, aliquota: 0.15, parcelaDeduzirCents: 39_416 },
  { ateCents: 466_468, aliquota: 0.225, parcelaDeduzirCents: 67_549 },
  { ateCents: Number.POSITIVE_INFINITY, aliquota: 0.275, parcelaDeduzirCents: 90_873 },
];

/** Dedução mensal por dependente no IRRF. */
export const IRRF_DEDUCAO_DEPENDENTE_CENTS = 18_959;

/**
 * Desconto simplificado mensal do IRRF (alternativa às deduções legais).
 * Equivale a 25% do teto da faixa de isenção — sobe junto com ela.
 */
export const IRRF_DESCONTO_SIMPLIFICADO_CENTS = 60_720;

// ─── FGTS — depósito do empregador (NÃO é descontado do salário) ────────────────

export const FGTS_ALIQUOTA = 0.08;

// ─── Cálculos ───────────────────────────────────────────────────────────────────

/** INSS devido sobre o salário bruto, somando as parcelas de cada faixa. */
export function calcularINSSCents(brutoCents: number): number {
  if (brutoCents <= 0) return 0;
  const base = Math.min(brutoCents, INSS_TETO_BASE_CENTS);

  let inss = 0;
  let piso = 0;
  for (const faixa of INSS_FAIXAS) {
    const teto = Math.min(base, faixa.ateCents);
    if (teto > piso) inss += (teto - piso) * faixa.aliquota;
    piso = faixa.ateCents;
    if (base <= faixa.ateCents) break;
  }
  return Math.round(inss);
}

function irrfPelaTabela(baseCents: number): number {
  if (baseCents <= 0) return 0;
  for (const faixa of IRRF_FAIXAS) {
    if (baseCents <= faixa.ateCents) {
      return Math.max(0, Math.round(baseCents * faixa.aliquota - faixa.parcelaDeduzirCents));
    }
  }
  return 0;
}

/**
 * IRRF retido. Considera o modelo mais vantajoso entre as deduções legais
 * (INSS + dependentes) e o desconto simplificado.
 */
export function calcularIRRFCents(
  brutoCents: number,
  inssCents: number,
  dependentes = 0
): number {
  const baseLegal = brutoCents - inssCents - dependentes * IRRF_DEDUCAO_DEPENDENTE_CENTS;
  const baseSimplificada = brutoCents - IRRF_DESCONTO_SIMPLIFICADO_CENTS;
  return Math.min(irrfPelaTabela(baseLegal), irrfPelaTabela(baseSimplificada));
}

export type ResultadoCLT = {
  brutoCents: number;
  inssCents: number;
  irrfCents: number;
  /** INSS + IRRF (o que efetivamente é descontado do salário). */
  totalDescontosCents: number;
  liquidoCents: number;
  /** FGTS depositado pelo empregador — informativo, não descontado. */
  fgtsCents: number;
};

/** Estimativa de líquido CLT a partir do salário bruto mensal. */
export function calcularCLT(brutoCents: number, dependentes = 0): ResultadoCLT {
  const inssCents = calcularINSSCents(brutoCents);
  const irrfCents = calcularIRRFCents(brutoCents, inssCents, dependentes);
  const totalDescontosCents = inssCents + irrfCents;
  return {
    brutoCents,
    inssCents,
    irrfCents,
    totalDescontosCents,
    liquidoCents: brutoCents - totalDescontosCents,
    fgtsCents: Math.round(brutoCents * FGTS_ALIQUOTA),
  };
}
