/**
 * Cálculo da folha de pagamento — proventos, descontos e encargos patronais.
 *
 * O que existia antes era só `calcularCLT` (INSS + IRRF + FGTS) para estimar
 * um líquido. Faltava o outro lado: o custo do empregador. A auditoria fiscal
 * apontou que a CPP era tratada como 20% secos, quando fora do DAS o encargo
 * real soma ainda RAT ajustado pelo FAP e, no Presumido/Real, terceiros.
 *
 * As três regras que decidem tudo:
 *
 *   1. Simples nos Anexos I, II, III e V — CPP, RAT e terceiros estão dentro
 *      do DAS. Encargo patronal separado: só FGTS.
 *   2. Simples no Anexo IV — CPP e RAT saem por fora, mas terceiros não são
 *      devidos: o Simples é isento do Sistema S em qualquer anexo.
 *   3. Presumido e Real — CPP, RAT ajustado pelo FAP e terceiros, todos por fora.
 *
 * Pró-labore nunca gera FGTS nem RAT: não é vínculo celetista e não há risco
 * ambiental do trabalho a cobrir. Gera CPP quando ela é recolhida por fora.
 */

import {
  calcularINSSCents,
  calcularIRRFCents,
  FGTS_ALIQUOTA,
} from "./clt";
import {
  CPP_PATRONAL_ALIQUOTA,
  INSS_PRO_LABORE_ALIQUOTA,
  INSS_TETO_2026_CENTS,
  aplicarRedutorIR,
} from "./tributos";
import type { AnexoSimples, RegimeTributario } from "@/core/db/empresas";

// ─── Parâmetros de encargo ────────────────────────────────────────────────────

/** Graus de risco do RAT, em centésimos de % (100 = 1%). */
export const RAT_OPCOES = [
  { centesimos: 100, label: "1% — risco leve" },
  { centesimos: 200, label: "2% — risco médio" },
  { centesimos: 300, label: "3% — risco grave" },
];

export const FAP_MINIMO_DECIMILESIMOS = 5_000; // 0,5000
export const FAP_MAXIMO_DECIMILESIMOS = 20_000; // 2,0000
export const FAP_NEUTRO_DECIMILESIMOS = 10_000; // 1,0000

/** Terceiros mais comum (FPAS 515: comércio/serviços) — 5,8%. */
export const TERCEIROS_PADRAO_CENTESIMOS = 580;

export type ParametrosEncargo = {
  regime: RegimeTributario;
  anexoSimples: AnexoSimples | null;
  /** RAT em centésimos de % (100 = 1%). */
  ratCentesimos: number;
  /** FAP em decimilésimos (10000 = 1,0000). */
  fapDecimilesimos: number;
  /** Terceiros em centésimos de % (580 = 5,8%). */
  terceirosCentesimos: number;
};

/**
 * A CPP é recolhida por fora do DAS?
 *
 * Mesma pergunta que a aba Tributos já fazia para o pró-labore — aqui ela
 * decide também RAT e terceiros, porque as três seguem o mesmo destino.
 */
export function cppForaDoDas(
  regime: RegimeTributario,
  anexoSimples: AnexoSimples | null
): boolean {
  if (regime === "PRESUMIDO" || regime === "REAL") return true;
  return regime === "SIMPLES" && anexoSimples === "IV";
}

/** O Simples é isento de terceiros (Sistema S) em todos os anexos. */
export function deveTerceiros(regime: RegimeTributario): boolean {
  return regime === "PRESUMIDO" || regime === "REAL";
}

/** RAT ajustado = RAT × FAP, em centésimos de %. */
export function ratAjustadoCentesimos(
  ratCentesimos: number,
  fapDecimilesimos: number
): number {
  return Math.round((ratCentesimos * fapDecimilesimos) / FAP_NEUTRO_DECIMILESIMOS);
}

// ─── Encargos patronais ───────────────────────────────────────────────────────

export type EncargosPatronais = {
  fgtsCents: number;
  cppCents: number;
  ratCents: number;
  terceirosCents: number;
  totalCents: number;
};

/**
 * Encargos do empregador sobre uma base de remuneração.
 *
 * `celetista` separa o que é vínculo CLT (tem FGTS e RAT) de pró-labore
 * (não tem nenhum dos dois, mas tem CPP quando ela sai por fora do DAS).
 */
export function calcularEncargos(
  baseCents: number,
  params: ParametrosEncargo,
  celetista: boolean
): EncargosPatronais {
  if (baseCents <= 0) {
    return { fgtsCents: 0, cppCents: 0, ratCents: 0, terceirosCents: 0, totalCents: 0 };
  }

  const fgtsCents = celetista ? Math.round(baseCents * FGTS_ALIQUOTA) : 0;

  const fora = cppForaDoDas(params.regime, params.anexoSimples);
  const cppCents = fora ? Math.round(baseCents * CPP_PATRONAL_ALIQUOTA) : 0;

  const ratCents =
    fora && celetista
      ? Math.round(
          (baseCents *
            ratAjustadoCentesimos(params.ratCentesimos, params.fapDecimilesimos)) /
            10_000
        )
      : 0;

  const terceirosCents =
    fora && celetista && deveTerceiros(params.regime)
      ? Math.round((baseCents * params.terceirosCentesimos) / 10_000)
      : 0;

  return {
    fgtsCents,
    cppCents,
    ratCents,
    terceirosCents,
    totalCents: fgtsCents + cppCents + ratCents + terceirosCents,
  };
}

// ─── Item de folha ────────────────────────────────────────────────────────────

export type ProventosItem = {
  baseCents: number;
  decimoTerceiroCents: number;
  feriasCents: number;
  tercoFeriasCents: number;
  outrosProventosCents: number;
};

export type ItemCalculado = {
  proventosCents: number;
  inssCents: number;
  irrfCents: number;
  outrosDescontosCents: number;
  descontosCents: number;
  liquidoCents: number;
  encargos: EncargosPatronais;
  /** Proventos + encargos: o que a pessoa custa à empresa no mês. */
  custoTotalCents: number;
};

/**
 * Calcula um item de folha celetista.
 *
 * Simplificação assumida e relevante: 13º e férias entram na mesma base do
 * mês para INSS e IRRF. Na folha oficial o 13º tem tributação **exclusiva e
 * separada** e as férias têm sua própria competência. Fazer isso direito exige
 * modelar recibos separados; enquanto não existe, o número aqui serve para
 * custo e para o Fator R — não para emitir holerite.
 */
export function calcularItemSalario(
  proventos: ProventosItem,
  dependentes: number,
  outrosDescontosCents: number,
  params: ParametrosEncargo
): ItemCalculado {
  const proventosCents =
    proventos.baseCents +
    proventos.decimoTerceiroCents +
    proventos.feriasCents +
    proventos.tercoFeriasCents +
    proventos.outrosProventosCents;

  const inssCents = calcularINSSCents(proventosCents);
  const irrfCents = calcularIRRFCents(proventosCents, inssCents, dependentes);

  const descontosCents = inssCents + irrfCents + outrosDescontosCents;
  const encargos = calcularEncargos(proventosCents, params, true);

  return {
    proventosCents,
    inssCents,
    irrfCents,
    outrosDescontosCents,
    descontosCents,
    liquidoCents: proventosCents - descontosCents,
    encargos,
    custoTotalCents: proventosCents + encargos.totalCents,
  };
}

/**
 * Calcula um item de pró-labore.
 *
 * Difere do celetista em três pontos: INSS é alíquota fixa de 11% até o teto
 * (contribuinte individual, não a tabela progressiva), o IRRF passa pelo
 * redutor da Lei 15.270/2025, e não há FGTS nem RAT.
 */
export function calcularItemProLabore(
  brutoCents: number,
  dependentes: number,
  outrosDescontosCents: number,
  params: ParametrosEncargo
): ItemCalculado {
  const inssCents = Math.round(
    Math.min(brutoCents, INSS_TETO_2026_CENTS) * INSS_PRO_LABORE_ALIQUOTA
  );
  const irrfCents = aplicarRedutorIR(
    calcularIRRFCents(brutoCents, inssCents, dependentes),
    brutoCents
  );

  const descontosCents = inssCents + irrfCents + outrosDescontosCents;
  const encargos = calcularEncargos(brutoCents, params, false);

  return {
    proventosCents: brutoCents,
    inssCents,
    irrfCents,
    outrosDescontosCents,
    descontosCents,
    liquidoCents: brutoCents - descontosCents,
    encargos,
    custoTotalCents: brutoCents + encargos.totalCents,
  };
}

// ─── Fator R a partir da folha real ───────────────────────────────────────────

export type ItemParaFatorR = {
  proventosCents: number;
  /** CPP efetivamente recolhida no item (zero quando está dentro do DAS). */
  cppCents: number;
  fgtsCents: number;
};

/**
 * Numerador do Fator R a partir de competências já fechadas.
 *
 * A LC 123 art. 18 §24 soma as remunerações pagas nos 12 meses anteriores —
 * pró-labore incluído — mais a CPP efetivamente recolhida e o FGTS. O RAT
 * **não** entra: a lei fala em contribuição patronal previdenciária, e o RAT
 * é contribuição de custeio do seguro de acidente, não da previdência.
 */
export function folhaRealParaFatorR(itens: ItemParaFatorR[]): number {
  return itens.reduce(
    (acc, i) => acc + i.proventosCents + i.cppCents + i.fgtsCents,
    0
  );
}
