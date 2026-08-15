/**
 * Cálculo de tributos do módulo contábil — valores vigentes em 2026.
 *
 * - Simples Nacional: Anexos I–V (LC 123/2006, tabelas da LC 155/2016),
 *   alíquota efetiva por RBT12 e Fator R.
 * - Pró-labore: INSS 11% (contribuinte individual, teto 2026 R$ 8.475,55) e
 *   IRRF pela tabela progressiva com o redutor da Lei 15.270/2025 (isenção
 *   efetiva até R$ 5.000/mês, redução parcial até R$ 7.350).
 * - Lucro Presumido: presunções de 8%/16%/32%, IRPJ 15% + adicional 10%,
 *   CSLL 9%, PIS 0,65% e Cofins 3% (cumulativos).
 * - MEI: DAS fixo sobre o salário mínimo 2026 (R$ 1.621,00).
 *
 * Tudo em CENTAVOS inteiros. São estimativas para acompanhamento — não
 * substituem a apuração oficial (PGDAS-D, DCTFWeb etc.).
 */

import {
  calcularIRRFCents,
  IRRF_FAIXAS,
  IRRF_DESCONTO_SIMPLIFICADO_CENTS,
} from "./clt";
import type { AnexoSimples, AtividadePresumido } from "@/core/db/empresas";

export const TRIBUTOS_ANO_REFERENCIA = "2026";

// ─── Parâmetros 2026 ──────────────────────────────────────────────────────────

/** Salário mínimo nacional 2026. */
export const SALARIO_MINIMO_CENTS = 162_100;

/** Teto do salário de contribuição do INSS em 2026. */
export const INSS_TETO_2026_CENTS = 847_555;

/** Alíquota do INSS do pró-labore (contribuinte individual em empresa). */
export const INSS_PRO_LABORE_ALIQUOTA = 0.11;

/** CPP patronal sobre o pró-labore (Presumido, Real e Simples Anexo IV). */
export const CPP_PATRONAL_ALIQUOTA = 0.2;

// Redutor do IRRF (Lei 15.270/2025): isenção efetiva até R$ 5.000/mês e
// redução decrescente até R$ 7.350 → redutor = 978,62 − 13,3145% do rendimento.
export const IR_ISENCAO_TOTAL_ATE_CENTS = 500_000;
export const IR_REDUTOR_LIMITE_CENTS = 735_000;
const IR_REDUTOR_FIXO_CENTS = 97_862;
const IR_REDUTOR_FATOR = 0.133145;

// ─── Simples Nacional — Anexos I a V ─────────────────────────────────────────

export type FaixaSimples = {
  /** RBT12 máximo da faixa. */
  ateCents: number;
  /** Alíquota nominal (fração, ex.: 0.06 = 6%). */
  aliquota: number;
  /** Parcela a deduzir da faixa. */
  deduzirCents: number;
};

/** Limite anual de receita do Simples Nacional. */
export const SIMPLES_LIMITE_CENTS = 480_000_000;
/** Sublimite estadual: acima disso, ICMS/ISS saem do DAS. */
export const SIMPLES_SUBLIMITE_CENTS = 360_000_000;
/** Limite anual de receita do MEI. */
export const MEI_LIMITE_CENTS = 8_100_000;

const FAIXAS_RBT12 = [
  18_000_000, 36_000_000, 72_000_000, 180_000_000, 360_000_000, 480_000_000,
];

function anexo(
  aliquotas: number[],
  deduzir: number[]
): FaixaSimples[] {
  return FAIXAS_RBT12.map((ate, i) => ({
    ateCents: ate,
    aliquota: aliquotas[i],
    deduzirCents: deduzir[i],
  }));
}

export const ANEXOS_SIMPLES: Record<AnexoSimples, FaixaSimples[]> = {
  // Comércio
  I: anexo(
    [0.04, 0.073, 0.095, 0.107, 0.143, 0.19],
    [0, 594_000, 1_386_000, 2_250_000, 8_730_000, 37_800_000]
  ),
  // Indústria
  II: anexo(
    [0.045, 0.078, 0.1, 0.112, 0.147, 0.3],
    [0, 594_000, 1_386_000, 2_250_000, 8_550_000, 72_000_000]
  ),
  // Serviços (Fator R ≥ 28%)
  III: anexo(
    [0.06, 0.112, 0.135, 0.16, 0.21, 0.33],
    [0, 936_000, 1_764_000, 3_564_000, 12_564_000, 64_800_000]
  ),
  // Serviços do § 5º-C (construção, advocacia, limpeza…) — CPP fora do DAS
  IV: anexo(
    [0.045, 0.09, 0.102, 0.14, 0.22, 0.33],
    [0, 810_000, 1_242_000, 3_978_000, 18_378_000, 82_800_000]
  ),
  // Serviços (Fator R < 28%)
  V: anexo(
    [0.155, 0.18, 0.195, 0.205, 0.23, 0.3055],
    [0, 450_000, 990_000, 1_710_000, 6_210_000, 54_000_000]
  ),
};

export type ResultadoSimples = {
  rbt12Cents: number;
  /** Fração (ex.: 0.0674). Null quando RBT12 = 0 (usa a 1ª faixa nominal). */
  aliquotaEfetiva: number;
  faixa: number;
  dasEstimadoCents: number;
  acimaDoLimite: boolean;
  acimaDoSublimite: boolean;
};

/**
 * Alíquota efetiva e DAS estimado do mês.
 * Efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12.
 * Com RBT12 zerado (empresa nova), usa a alíquota nominal da 1ª faixa.
 */
export function calcularSimples(
  anexoSimples: AnexoSimples,
  rbt12Cents: number,
  receitaMesCents: number
): ResultadoSimples {
  const faixas = ANEXOS_SIMPLES[anexoSimples];
  let idx = faixas.findIndex((f) => rbt12Cents <= f.ateCents);
  if (idx === -1) idx = faixas.length - 1;
  const faixa = faixas[idx];
  const aliquotaEfetiva =
    rbt12Cents > 0
      ? (rbt12Cents * faixa.aliquota - faixa.deduzirCents) / rbt12Cents
      : faixas[0].aliquota;
  return {
    rbt12Cents,
    aliquotaEfetiva,
    faixa: idx + 1,
    dasEstimadoCents: Math.round(receitaMesCents * aliquotaEfetiva),
    acimaDoLimite: rbt12Cents > SIMPLES_LIMITE_CENTS,
    acimaDoSublimite: rbt12Cents > SIMPLES_SUBLIMITE_CENTS,
  };
}

/** Fator R = folha dos últimos 12 meses ÷ RBT12. ≥ 28% → Anexo III; senão V. */
export function calcularFatorR(
  folha12mCents: number,
  rbt12Cents: number
): { fatorR: number; anexoIndicado: "III" | "V" } {
  const fatorR = rbt12Cents > 0 ? folha12mCents / rbt12Cents : 0;
  return { fatorR, anexoIndicado: fatorR >= 0.28 ? "III" : "V" };
}

// ─── Pró-labore (2026) ────────────────────────────────────────────────────────

export type ResultadoProLabore = {
  brutoCents: number;
  /** 11% até o teto — retido do sócio. */
  inssCents: number;
  /** IRRF com o redutor da Lei 15.270/2025. */
  irrfCents: number;
  liquidoCents: number;
  /** CPP 20% da empresa (0 quando a CPP está dentro do DAS). */
  cppEmpresaCents: number;
};

/** Redutor do IRRF 2026: zera até R$ 5.000 e decresce até R$ 7.350. */
export function aplicarRedutorIR(
  impostoCents: number,
  rendimentoCents: number
): number {
  if (impostoCents <= 0) return 0;
  if (rendimentoCents <= IR_ISENCAO_TOTAL_ATE_CENTS) return 0;
  if (rendimentoCents <= IR_REDUTOR_LIMITE_CENTS) {
    const redutor = Math.round(
      IR_REDUTOR_FIXO_CENTS - IR_REDUTOR_FATOR * rendimentoCents
    );
    return Math.max(0, impostoCents - Math.max(0, redutor));
  }
  return impostoCents;
}

/**
 * Descontos do pró-labore do sócio. A CPP patronal entra quando a empresa
 * recolhe fora do DAS (Presumido, Real e Simples Anexo IV).
 */
export function calcularProLabore(
  brutoCents: number,
  comCppPatronal: boolean
): ResultadoProLabore {
  const inssCents = Math.round(
    Math.min(brutoCents, INSS_TETO_2026_CENTS) * INSS_PRO_LABORE_ALIQUOTA
  );
  // Tabela progressiva (melhor entre deduções legais e desconto simplificado)…
  const irrfTabela = calcularIRRFCents(brutoCents, inssCents);
  // …com o redutor de 2026 aplicado sobre o rendimento bruto.
  const irrfCents = aplicarRedutorIR(irrfTabela, brutoCents);
  return {
    brutoCents,
    inssCents,
    irrfCents,
    liquidoCents: brutoCents - inssCents - irrfCents,
    cppEmpresaCents: comCppPatronal
      ? Math.round(brutoCents * CPP_PATRONAL_ALIQUOTA)
      : 0,
  };
}

// ─── Lucro Presumido ──────────────────────────────────────────────────────────

export const LABEL_ATIVIDADE_PRESUMIDO: Record<AtividadePresumido, string> = {
  COMERCIO_INDUSTRIA: "Comércio / indústria",
  TRANSPORTE_PASSAGEIROS: "Transporte de passageiros",
  SERVICOS: "Serviços",
};

/** Presunções de lucro por atividade: base do IRPJ e da CSLL. */
export const PRESUNCOES: Record<
  AtividadePresumido,
  { irpj: number; csll: number }
> = {
  COMERCIO_INDUSTRIA: { irpj: 0.08, csll: 0.12 },
  TRANSPORTE_PASSAGEIROS: { irpj: 0.16, csll: 0.12 },
  SERVICOS: { irpj: 0.32, csll: 0.32 },
};

export const PIS_ALIQUOTA = 0.0065;
export const COFINS_ALIQUOTA = 0.03;
const IRPJ_ALIQUOTA = 0.15;
const IRPJ_ADICIONAL_ALIQUOTA = 0.1;
/** Adicional de IRPJ incide sobre a base que exceder R$ 60.000 no trimestre. */
const IRPJ_ADICIONAL_LIMITE_TRIMESTRE_CENTS = 6_000_000;
const CSLL_ALIQUOTA = 0.09;

export type ResultadoPresumidoMes = {
  pisCents: number;
  cofinsCents: number;
};

export type ResultadoPresumidoTrimestre = {
  receitaTrimestreCents: number;
  baseIrpjCents: number;
  baseCsllCents: number;
  irpjCents: number;
  /** Parcela do adicional de 10% já incluída em `irpjCents`. */
  irpjAdicionalCents: number;
  csllCents: number;
};

/** PIS e Cofins cumulativos sobre a receita do mês. */
export function calcularPresumidoMes(
  receitaMesCents: number
): ResultadoPresumidoMes {
  return {
    pisCents: Math.round(receitaMesCents * PIS_ALIQUOTA),
    cofinsCents: Math.round(receitaMesCents * COFINS_ALIQUOTA),
  };
}

/** IRPJ (15% + adicional de 10%) e CSLL (9%) sobre as bases presumidas do trimestre. */
export function calcularPresumidoTrimestre(
  atividade: AtividadePresumido,
  receitaTrimestreCents: number
): ResultadoPresumidoTrimestre {
  const presuncao = PRESUNCOES[atividade];
  const baseIrpjCents = Math.round(receitaTrimestreCents * presuncao.irpj);
  const baseCsllCents = Math.round(receitaTrimestreCents * presuncao.csll);
  const excedente = Math.max(
    0,
    baseIrpjCents - IRPJ_ADICIONAL_LIMITE_TRIMESTRE_CENTS
  );
  const irpjAdicionalCents = Math.round(excedente * IRPJ_ADICIONAL_ALIQUOTA);
  return {
    receitaTrimestreCents,
    baseIrpjCents,
    baseCsllCents,
    irpjCents: Math.round(baseIrpjCents * IRPJ_ALIQUOTA) + irpjAdicionalCents,
    irpjAdicionalCents,
    csllCents: Math.round(baseCsllCents * CSLL_ALIQUOTA),
  };
}

// ─── MEI ──────────────────────────────────────────────────────────────────────

/** INSS do DAS-MEI: 5% do salário mínimo. */
export const MEI_INSS_CENTS = Math.round(SALARIO_MINIMO_CENTS * 0.05);
/** Acréscimos fixos do DAS-MEI conforme a atividade. */
export const MEI_ICMS_CENTS = 100;
export const MEI_ISS_CENTS = 500;

// Reexporta para o painel de pró-labore explicar a base do IRRF.
export { IRRF_FAIXAS, IRRF_DESCONTO_SIMPLIFICADO_CENTS };
