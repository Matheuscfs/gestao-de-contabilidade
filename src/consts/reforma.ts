/**
 * Reforma tributária (EC 132/2023 + LC 214/2025) — linha do tempo da
 * transição 2026–2033, com o recorte do que muda para cada regime.
 *
 * Como os demais catálogos do módulo contábil, vive em código e é atualizada
 * junto com o app conforme a regulamentação evolui.
 */

import type { RegimeIbsCbs, RegimeTributario } from "@/core/db/empresas";

export const LABEL_REGIME_IBS_CBS: Record<RegimeIbsCbs, string> = {
  SIMPLES_DAS: "IBS/CBS por dentro do DAS",
  SIMPLES_HIBRIDO: "Híbrido (IBS/CBS por fora)",
  REGULAR: "Regime regular de IBS/CBS",
};

export const DESCRICAO_REGIME_IBS_CBS: Record<RegimeIbsCbs, string> = {
  SIMPLES_DAS:
    "Tudo continua na guia única do Simples. Mais simples, mas os clientes PJ não aproveitam crédito de IBS/CBS das suas notas.",
  SIMPLES_HIBRIDO:
    "Permanece no Simples para os demais tributos, mas apura IBS/CBS por fora, no regime regular — as notas passam a transferir crédito integral para clientes PJ.",
  REGULAR:
    "Sai do recolhimento simplificado de IBS/CBS e apura como as demais empresas. Faz sentido quando a maior parte das vendas é para outras empresas.",
};

// ─── Linha do tempo ───────────────────────────────────────────────────────────

export type FaseReforma = {
  /** Ano de início da fase. */
  ano: number;
  /** Ano final (fases plurianuais, ex.: 2029–2032). */
  anoFim?: number;
  titulo: string;
  /** O que acontece, em geral. */
  geral: string;
  /** Recorte por regime — sobrepõe/complementa o texto geral quando presente. */
  porRegime?: Partial<Record<RegimeTributario, string>>;
};

export const FASES_REFORMA: FaseReforma[] = [
  {
    ano: 2026,
    titulo: "Fase de testes",
    geral:
      "CBS a 0,9% e IBS a 0,1% em caráter informativo, sem recolhimento para quem cumpre as obrigações acessórias. Falhas de preenchimento de boa-fé não geram multa.",
    porRegime: {
      PRESUMIDO:
        "Desde 03/08/2026 os campos de IBS/CBS são obrigatórios nos documentos fiscais eletrônicos. A apuração assistida é informativa.",
      REAL:
        "Desde 03/08/2026 os campos de IBS/CBS são obrigatórios nos documentos fiscais eletrônicos. A apuração assistida é informativa.",
      SIMPLES: "Nada muda para o Simples Nacional em 2026.",
      MEI: "Nada muda para o MEI em 2026.",
    },
  },
  {
    ano: 2027,
    titulo: "CBS entra valendo",
    geral:
      "A CBS substitui PIS e Cofins em alíquota cheia. Começa o Imposto Seletivo e o IPI é zerado (exceto Zona Franca de Manaus).",
    porRegime: {
      SIMPLES:
        "O Simples passa a destacar IBS/CBS nas notas. É o ano da decisão: manter tudo no DAS ou apurar IBS/CBS por fora (híbrido/regular) para transferir crédito aos clientes PJ.",
      MEI: "O MEI passa a indicar IBS/CBS nos documentos fiscais, sem mudança no DAS-MEI.",
      PRESUMIDO: "PIS/Cofins deixam de existir — a CBS assume nas guias mensais.",
      REAL: "PIS/Cofins deixam de existir — a CBS assume nas guias mensais.",
    },
  },
  {
    ano: 2028,
    titulo: "Consolidação",
    geral:
      "CBS plena e IBS ainda em alíquota de teste. Ano de adaptação de sistemas e preços antes da virada do ICMS/ISS.",
  },
  {
    ano: 2029,
    anoFim: 2032,
    titulo: "Transição ICMS/ISS → IBS",
    geral:
      "ICMS e ISS encolhem ano a ano (10% → 40% de redução) enquanto o IBS sobe na mesma proporção. Benefícios fiscais estaduais/municipais vão sendo extintos.",
    porRegime: {
      SIMPLES:
        "Quem ficou com IBS/CBS no DAS segue na guia única; quem optou pelo regime regular acompanha a escalada do IBS.",
    },
  },
  {
    ano: 2033,
    titulo: "Modelo novo completo",
    geral:
      "ICMS e ISS extintos. IVA dual pleno: IBS (estados/municípios) + CBS (União), com Imposto Seletivo sobre bens prejudiciais.",
  },
];

/** Fase da linha do tempo em que um ano cai: passada, atual ou futura. */
export function situacaoDaFase(
  fase: FaseReforma,
  anoAtual: number
): "PASSADA" | "ATUAL" | "FUTURA" {
  const fim = fase.anoFim ?? fase.ano;
  if (anoAtual > fim) return "PASSADA";
  if (anoAtual < fase.ano) return "FUTURA";
  return "ATUAL";
}

/** A decisão do Simples sobre IBS/CBS só passa a valer a partir de 2027. */
export const ANO_DECISAO_SIMPLES = 2027;
