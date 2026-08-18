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

import { ANO_FISCAL } from "./ano-fiscal";
import {
  calcularIRRFCents,
  FGTS_ALIQUOTA,
  IRRF_FAIXAS,
  IRRF_DESCONTO_SIMPLIFICADO_CENTS,
} from "./clt";
import type { AnexoSimples, AtividadePresumido } from "@/core/db/empresas";

export const TRIBUTOS_ANO_REFERENCIA = ANO_FISCAL;

// ─── Parâmetros 2026 ──────────────────────────────────────────────────────────

/** Salário mínimo nacional 2026. */
export const SALARIO_MINIMO_CENTS = 162_100;

/** Teto do salário de contribuição do INSS em 2026. */
export const INSS_TETO_2026_CENTS = 847_555;

/** Alíquota do INSS do pró-labore (contribuinte individual em empresa). */
export const INSS_PRO_LABORE_ALIQUOTA = 0.11;

/** CPP patronal sobre o pró-labore (Presumido, Real e Simples Anexo IV). */
export const CPP_PATRONAL_ALIQUOTA = 0.2;

/**
 * FGTS depositado pelo empregador — entra no numerador do Fator R. Reusa a
 * alíquota de `clt.ts` em vez de repetir o 0,08: é o mesmo depósito, visto de
 * outro ângulo. Não incide sobre pró-labore, que não é vínculo celetista.
 */
export const FGTS_ALIQUOTA_PATRONAL = FGTS_ALIQUOTA;

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

// ─── RBT12 de empresa em início de atividade ─────────────────────────────────

export type RegraRbt12 = "GERAL" | "PRIMEIRO_MES" | "PROPORCIONAL";

export type ResultadoRbt12 = {
  rbt12Cents: number;
  regra: RegraRbt12;
  /** Meses de receita que entraram na conta. */
  mesesConsiderados: number;
};

/**
 * Meses completos de atividade antes do mês de apuração.
 *
 * Zero significa que a empresa abriu no próprio mês apurado. Null quando não
 * há data de abertura: sem ela não dá para saber se a empresa é nova, e
 * assumir "nova" mudaria o imposto de quem só não preencheu o cadastro.
 */
export function mesesDeAtividade(
  aberturaISO: string | null,
  mesApuracao: number,
  anoApuracao: number
): number | null {
  if (!aberturaISO) return null;
  const ano = Number(aberturaISO.slice(0, 4));
  const mes = Number(aberturaISO.slice(5, 7));
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1) return null;

  const diff = anoApuracao * 12 + mesApuracao - (ano * 12 + mes);
  return diff >= 0 ? diff : null;
}

/**
 * RBT12 do período de apuração, respeitando o início de atividade.
 *
 * A LC 123 art. 18 §§ 1º e 2º manda proporcionalizar enquanto a empresa não
 * completa 12 meses, e são três momentos distintos:
 *
 *   1. Mês de abertura — RBT12 = receita do próprio mês × 12.
 *   2. Do 2º ao 12º mês — média aritmética da receita dos meses anteriores × 12.
 *   3. Do 13º em diante — regra geral: soma dos 12 meses anteriores.
 *
 * O app usava sempre a regra geral e, com RBT12 zerado, caía na alíquota
 * nominal da 1ª faixa. Isso acerta por acaso em quem fatura pouco e erra em
 * quem abre faturando: a projeção pode cair em faixa superior.
 *
 * `receitasAnteriores` vem em ordem cronológica, do mais antigo ao mais
 * recente, com no máximo 12 competências.
 */
export function calcularRbt12(
  receitasAnteriores: number[],
  receitaMesApuracaoCents: number,
  mesesDeAtividadeAnteriores: number | null
): ResultadoRbt12 {
  const soma = (lista: number[]) => lista.reduce((a, r) => a + r, 0);

  // Sem data de abertura ou já passou o 12º mês: regra geral.
  if (mesesDeAtividadeAnteriores == null || mesesDeAtividadeAnteriores >= 12) {
    const ultimos = receitasAnteriores.slice(-12);
    return {
      rbt12Cents: soma(ultimos),
      regra: "GERAL",
      mesesConsiderados: ultimos.length,
    };
  }

  // Mês de abertura: só existe a receita do próprio mês para projetar.
  if (mesesDeAtividadeAnteriores <= 0) {
    return {
      rbt12Cents: receitaMesApuracaoCents * 12,
      regra: "PRIMEIRO_MES",
      mesesConsiderados: 1,
    };
  }

  // Do 2º ao 12º mês: média dos meses anteriores, projetada para 12.
  const considerados = receitasAnteriores.slice(-mesesDeAtividadeAnteriores);
  const n = considerados.length;
  if (n === 0) {
    return { rbt12Cents: 0, regra: "PROPORCIONAL", mesesConsiderados: 0 };
  }
  return {
    rbt12Cents: Math.round((soma(considerados) / n) * 12),
    regra: "PROPORCIONAL",
    mesesConsiderados: n,
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

/** Fator R a partir do qual a empresa cai no Anexo III. */
export const FATOR_R_CORTE = 0.28;

/**
 * Janela em torno do corte em que vale planejar a folha: subir a retirada
 * pode valer muito mais do que custa. Abaixo de 25% a distância costuma ser
 * grande demais para compensar; acima de 31% a margem já é confortável.
 */
export const FATOR_R_FRONTEIRA = { de: 0.25, ate: 0.31 };

export type ComposicaoFolha = {
  /** Soma dos pró-labores mensais vigentes. */
  proLaboreMensalCents: number;
  /** Soma dos salários mensais dos funcionários ativos. */
  salariosMensalCents: number;
  /**
   * A CPP patronal é recolhida por fora do DAS? Verdadeiro no Anexo IV, no
   * Presumido e no Real. Nos Anexos I–III e V ela está embutida no DAS e,
   * como a lei fala em contribuição "efetivamente recolhida", não entra.
   */
  cppForaDoDas: boolean;
};

export type ResultadoFolha12m = {
  /** 12 meses de pró-labore + salários. */
  remuneracoesCents: number;
  /** 13º salário — uma remuneração a mais no período. */
  decimoTerceiroCents: number;
  /** Terço constitucional de férias (só sobre salários; pró-labore não tem). */
  tercoFeriasCents: number;
  /** FGTS 8% sobre salários, 13º e terço de férias. */
  fgtsCents: number;
  /** CPP patronal, quando recolhida por fora do DAS. */
  cppCents: number;
  totalCents: number;
};

/**
 * Estimativa da folha de 12 meses para o Fator R.
 *
 * A LC 123 art. 18 §24 define a folha como as remunerações pagas nos 12 meses
 * anteriores — pró-labore incluído — acrescidas da CPP efetivamente recolhida
 * e do FGTS. A conta anterior do app multiplicava só as remunerações atuais
 * por 12 e subestimava a folha em torno de 16%, o que empurra empresas de
 * fronteira para o Anexo V (15,5%) quando caberiam no III (6%).
 *
 * Continua sendo estimativa: projeta os valores de hoje para trás, porque o
 * app ainda não guarda o histórico mensal de folha. Quem reajustou salário ou
 * começou a retirar pró-labore no meio do período verá um número otimista —
 * por isso a tela mostra a composição aberta em vez de só o percentual.
 */
export function estimarFolha12m(c: ComposicaoFolha): ResultadoFolha12m {
  const mensalCents = c.proLaboreMensalCents + c.salariosMensalCents;

  const remuneracoesCents = mensalCents * 12;
  const decimoTerceiroCents = mensalCents;
  // Férias não somam um mês extra: o salário do mês de férias já está nos 12.
  // O que acresce é o terço constitucional, e só para quem é celetista.
  const tercoFeriasCents = Math.round(c.salariosMensalCents / 3);

  const baseFgtsCents =
    c.salariosMensalCents * 13 + tercoFeriasCents;
  const fgtsCents = Math.round(baseFgtsCents * FGTS_ALIQUOTA_PATRONAL);

  const cppCents = c.cppForaDoDas
    ? Math.round((mensalCents * 13 + tercoFeriasCents) * CPP_PATRONAL_ALIQUOTA)
    : 0;

  return {
    remuneracoesCents,
    decimoTerceiroCents,
    tercoFeriasCents,
    fgtsCents,
    cppCents,
    totalCents:
      remuneracoesCents +
      decimoTerceiroCents +
      tercoFeriasCents +
      fgtsCents +
      cppCents,
  };
}

// ─── Pró-labore (2026) ────────────────────────────────────────────────────────

/**
 * Piso do pró-labore: um salário mínimo.
 *
 * Sócio-administrador que trabalha na empresa deve retirar ao menos isso;
 * valor abaixo do piso é infração sujeita a autuação. Retirada zero é caso
 * diferente e legítimo — sócio que só investe, sem atuar na gestão, não retira
 * pró-labore e recebe apenas distribuição de lucros.
 */
export const PRO_LABORE_MINIMO_CENTS = SALARIO_MINIMO_CENTS;

export type ResultadoProLabore = {
  brutoCents: number;
  /** 11% até o teto — retido do sócio. */
  inssCents: number;
  /** IRRF com o redutor da Lei 15.270/2025. */
  irrfCents: number;
  liquidoCents: number;
  /** CPP 20% da empresa (0 quando a CPP está dentro do DAS). */
  cppEmpresaCents: number;
  /**
   * Retirada positiva porém abaixo do salário mínimo. Zero não acusa: é a
   * ausência de pró-labore, não um valor irregular.
   */
  abaixoDoMinimo: boolean;
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
    abaixoDoMinimo: brutoCents > 0 && brutoCents < PRO_LABORE_MINIMO_CENTS,
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

/** Teto da receita anual para a presunção reduzida de serviços (Lei 9.249 art. 15 §4º). */
export const LIMITE_PRESUNCAO_REDUZIDA_CENTS = 12_000_000; // R$ 120.000
/** Presunção de IRPJ para serviços dentro do teto. */
export const PRESUNCAO_SERVICOS_REDUZIDA = 0.16;

/**
 * Presunção de IRPJ da atividade, considerando a redução de serviços.
 *
 * Prestadora de serviços com receita bruta anual até R$ 120.000 usa 16% em vez
 * de 32% — mas **só no IRPJ**. A CSLL segue o art. 20 da Lei 9.249, que não tem
 * essa exceção e permanece em 32%.
 *
 * Ficam de fora as profissões regulamentadas (advocacia, medicina, engenharia,
 * contabilidade…), além de serviços hospitalares e de transporte. Uma sociedade
 * de advogados fatura R$ 80 mil e continua nos 32%.
 *
 * Estourar o teto no meio do ano faz os 32% retroagirem ao início do
 * ano-calendário — por isso o parâmetro é a receita **anual**, e não a do
 * trimestre: apurar trimestre a trimestre esconderia o estouro.
 */
export function presuncaoIrpj(
  atividade: AtividadePresumido,
  receitaAnualCents: number,
  profissaoRegulamentada: boolean
): number {
  if (atividade !== "SERVICOS") return PRESUNCOES[atividade].irpj;
  if (profissaoRegulamentada) return PRESUNCOES.SERVICOS.irpj;
  return receitaAnualCents <= LIMITE_PRESUNCAO_REDUZIDA_CENTS
    ? PRESUNCAO_SERVICOS_REDUZIDA
    : PRESUNCOES.SERVICOS.irpj;
}

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

/**
 * IRPJ (15% + adicional de 10%) e CSLL (9%) sobre as bases presumidas do trimestre.
 *
 * `receitaAnualCents` e `profissaoRegulamentada` só entram para decidir a
 * presunção reduzida de serviços; omitidos, valem os 32% cheios.
 */
export function calcularPresumidoTrimestre(
  atividade: AtividadePresumido,
  receitaTrimestreCents: number,
  receitaAnualCents = Number.POSITIVE_INFINITY,
  profissaoRegulamentada = false
): ResultadoPresumidoTrimestre {
  const presuncao = PRESUNCOES[atividade];
  const aliquotaIrpj = presuncaoIrpj(
    atividade,
    receitaAnualCents,
    profissaoRegulamentada
  );
  const baseIrpjCents = Math.round(receitaTrimestreCents * aliquotaIrpj);
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
