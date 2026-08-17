/**
 * Enquadramento tributário a partir do CNAE.
 *
 * O que este módulo resolve: dizer, para uma atividade, qual anexo do Simples
 * se aplica e — o ponto que faltava no app — **se aquela atividade é sujeita
 * ao Fator R**.
 *
 * O app tratava "Anexo III" como sinônimo de "passou no Fator R". A LC 123 não
 * funciona assim. São três situações diferentes:
 *
 *   • art. 18 §5º-C  → Anexo IV, sem Fator R (construção, advocacia,
 *     vigilância, limpeza). A CPP sai por fora do DAS.
 *   • art. 18 §5º-D  → o Fator R decide: folha/RBT12 ≥ 28% vai ao Anexo III,
 *     abaixo disso fica no Anexo V (medicina, engenharia, TI, publicidade,
 *     consultoria, academias, laboratórios…).
 *   • art. 18 §5º-B  → Anexo III **por atividade**, sem teste de folha
 *     (contabilidade, creche e ensino, agência de viagem, autoescola,
 *     transporte municipal, instalação e manutenção, produção audiovisual,
 *     corretagem de seguros). E o §5º-F manda o **resto** dos serviços para o
 *     Anexo III também — ou seja, "Anexo III sem Fator R" é a regra residual,
 *     não a exceção rara.
 *
 * Regra de ouro deste arquivo: **CNAE fora das listas devolve `null`**. Não há
 * chute nem padrão silencioso. Enquadrar errado troca 6% por 15,5% de alíquota
 * inicial, então quando não dá para afirmar, quem decide é o contador na tela.
 *
 * O RAT (grau de risco) deliberadamente **não** é sugerido aqui: ele vem do
 * Anexo V do Decreto 3.048/99, subclasse por subclasse, e varia dentro da
 * mesma divisão — derivar por prefixo produziria número errado com cara de
 * número certo. O campo continua manual na aba Folha.
 */

import type { AnexoSimples, AtividadePresumido } from "@/core/db/empresas";

export type EnquadramentoCnae = {
  /**
   * Anexo sugerido para o cadastro. Nas atividades sujeitas ao Fator R vem
   * como "III": é o desfecho quando a folha alcança 28%, e a aba Tributos
   * avisa assim que o Fator R apurado apontar para o V.
   */
  anexoSugerido: AnexoSimples;
  /** A atividade entra no teste de folha da LC 123 art. 18 §5º-D? */
  sujeitoFatorR: boolean;
  /** Presunção correspondente no Lucro Presumido. */
  atividadePresumido: AtividadePresumido;
  /** Base legal, mostrada na tela para o contador conferir. */
  fundamento: string;
};

type Regra = EnquadramentoCnae & {
  /** Prefixo do código de 7 dígitos: divisão (2), grupo (3), classe (4) ou subclasse (7). */
  prefixo: string;
};

// ─── Formatação ───────────────────────────────────────────────────────────────

/** Extrai os 7 dígitos do CNAE, aceitando "8630-5/03", "8630503" ou 8630503. */
export function digitosCnae(bruto: string | number | null | undefined): string {
  if (bruto === null || bruto === undefined) return "";
  return String(bruto).replace(/\D/g, "");
}

/**
 * Formata para a máscara oficial `9999-9/99`. Devolve null quando não há 7
 * dígitos — a Receita sempre manda os 7, e um código truncado enquadraria a
 * empresa pela atividade errada.
 */
export function formatarCnae(bruto: string | number | null | undefined): string | null {
  const d = digitosCnae(bruto);
  if (d.length !== 7) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

// ─── Tabela de enquadramento ──────────────────────────────────────────────────

const COMERCIO: Omit<Regra, "prefixo"> = {
  anexoSugerido: "I",
  sujeitoFatorR: false,
  atividadePresumido: "COMERCIO_INDUSTRIA",
  fundamento: "Comércio — Anexo I (LC 123 art. 18 §4º I).",
};

const INDUSTRIA: Omit<Regra, "prefixo"> = {
  anexoSugerido: "II",
  sujeitoFatorR: false,
  atividadePresumido: "COMERCIO_INDUSTRIA",
  fundamento: "Indústria — Anexo II (LC 123 art. 18 §4º II).",
};

function servicoAnexoIII(fundamento: string): Omit<Regra, "prefixo"> {
  return {
    anexoSugerido: "III",
    sujeitoFatorR: false,
    atividadePresumido: "SERVICOS",
    fundamento,
  };
}

function servicoAnexoIV(fundamento: string): Omit<Regra, "prefixo"> {
  return {
    anexoSugerido: "IV",
    sujeitoFatorR: false,
    atividadePresumido: "SERVICOS",
    fundamento,
  };
}

function servicoFatorR(atividade: string): Omit<Regra, "prefixo"> {
  return {
    anexoSugerido: "III",
    sujeitoFatorR: true,
    atividadePresumido: "SERVICOS",
    fundamento: `${atividade} — LC 123 art. 18 §5º-D: o Fator R decide entre o Anexo III (folha ≥ 28% da receita) e o Anexo V.`,
  };
}

/**
 * Prefixo mais longo vence — subclasse específica sobrepõe a divisão inteira.
 * A ordem no array é irrelevante; a busca ordena por tamanho.
 */
const REGRAS: Regra[] = [
  // ── Comércio e indústria ────────────────────────────────────────────────
  // Divisões 05 a 32. A 33 fica de fora de propósito: "manutenção, reparação
  // e instalação de máquinas" é serviço do §5º-B IX, não indústria.
  ...["05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16",
      "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28",
      "29", "30", "31", "32"].map((prefixo) => ({ prefixo, ...INDUSTRIA })),
  // Comércio de veículos (45), atacado (46) e varejo (47).
  ...["45", "46", "47"].map((prefixo) => ({ prefixo, ...COMERCIO })),

  // ── Anexo IV — LC 123 art. 18 §5º-C (CPP fora do DAS) ───────────────────
  ...["41", "42", "43"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIV(
      "Construção de imóveis e obras de engenharia — Anexo IV (LC 123 art. 18 §5º-C I). A CPP patronal é recolhida por fora do DAS."
    ),
  })),
  {
    prefixo: "8130300",
    ...servicoAnexoIV(
      "Paisagismo — Anexo IV (LC 123 art. 18 §5º-C I). A CPP patronal é recolhida por fora do DAS."
    ),
  },
  {
    prefixo: "6911", // serviços advocatícios
    ...servicoAnexoIV(
      "Advocacia — Anexo IV (LC 123 art. 18 §5º-C VI). A CPP patronal é recolhida por fora do DAS."
    ),
  },
  ...["801", "802"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIV(
      "Vigilância e segurança — Anexo IV (LC 123 art. 18 §5º-C V). A CPP patronal é recolhida por fora do DAS."
    ),
  })),
  ...["8121", "8122", "8129"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIV(
      "Limpeza e conservação — Anexo IV (LC 123 art. 18 §5º-C V). A CPP patronal é recolhida por fora do DAS."
    ),
  })),

  // ── Sujeitas ao Fator R — LC 123 art. 18 §5º-D ──────────────────────────
  { prefixo: "6201", ...servicoFatorR("Desenvolvimento de software sob encomenda") },
  { prefixo: "6202", ...servicoFatorR("Customização de programas de computador") },
  { prefixo: "6203", ...servicoFatorR("Licenciamento de programas de computador") },
  { prefixo: "6204", ...servicoFatorR("Consultoria em tecnologia da informação") },
  { prefixo: "6822", ...servicoFatorR("Administração de imóveis de terceiros") },
  { prefixo: "9313", ...servicoFatorR("Academia de atividades físicas") },
  { prefixo: "8591", ...servicoFatorR("Ensino de esportes") },
  { prefixo: "8592901", ...servicoFatorR("Ensino de dança") },
  { prefixo: "8230001", ...servicoFatorR("Montagem de estandes para feiras") },
  { prefixo: "8630", ...servicoFatorR("Atendimento médico e odontológico ambulatorial") },
  { prefixo: "8640", ...servicoFatorR("Laboratório de análises clínicas e diagnóstico por imagem") },
  { prefixo: "8650", ...servicoFatorR("Serviços de profissionais da saúde (fisioterapia, psicologia, nutrição, fonoaudiologia, enfermagem)") },
  { prefixo: "7500", ...servicoFatorR("Medicina veterinária") },
  { prefixo: "7111", ...servicoFatorR("Arquitetura") },
  { prefixo: "7112", ...servicoFatorR("Engenharia") },
  { prefixo: "7119", ...servicoFatorR("Serviços técnicos de engenharia (topografia, cartografia, testes e análises)") },
  { prefixo: "7410", ...servicoFatorR("Design") },
  { prefixo: "7020", ...servicoFatorR("Consultoria em gestão empresarial") },
  { prefixo: "7311", ...servicoFatorR("Agência de publicidade") },
  { prefixo: "7312", ...servicoFatorR("Agenciamento de espaços publicitários") },
  { prefixo: "7319", ...servicoFatorR("Publicidade e marketing") },
  { prefixo: "6391", ...servicoFatorR("Agência de notícias") },
  // Representação comercial mora na divisão 46 (atacado) mas é serviço de
  // intermediação — sem esta linha cairia no Anexo I pela regra do comércio.
  { prefixo: "461", ...servicoFatorR("Representação comercial e agenciamento") },
  { prefixo: "7490104", ...servicoFatorR("Intermediação de negócios em geral") },

  // ── Anexo III por atividade — LC 123 art. 18 §5º-B (sem Fator R) ────────
  {
    prefixo: "33",
    ...servicoAnexoIII(
      "Instalação, reparos e manutenção em geral — Anexo III por atividade (LC 123 art. 18 §5º-B IX). Não passa pelo Fator R."
    ),
  },
  ...["951", "952"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIII(
      "Reparação e manutenção — Anexo III por atividade (LC 123 art. 18 §5º-B IX). Não passa pelo Fator R."
    ),
  })),
  {
    prefixo: "6920601",
    ...servicoAnexoIII(
      "Escritório de serviços contábeis — Anexo III por atividade (LC 123 art. 18 §5º-B XIV). Não passa pelo Fator R."
    ),
  },
  // Educação: creche, pré-escola, fundamental, médio, técnico, idiomas,
  // artes e cursos livres. Academias e ensino de dança já foram capturados
  // acima por prefixo mais longo.
  ...["851", "852", "853", "854", "855", "859"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIII(
      "Ensino — Anexo III por atividade (LC 123 art. 18 §5º-B I). Não passa pelo Fator R."
    ),
  })),
  {
    prefixo: "5310502",
    ...servicoAnexoIII(
      "Agência franqueada dos Correios — Anexo III por atividade (LC 123 art. 18 §5º-B II). Não passa pelo Fator R."
    ),
  },
  ...["7911", "7912"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIII(
      "Agência de viagem e turismo — Anexo III por atividade (LC 123 art. 18 §5º-B III). Não passa pelo Fator R."
    ),
  })),
  {
    prefixo: "4921",
    anexoSugerido: "III" as const,
    sujeitoFatorR: false,
    atividadePresumido: "TRANSPORTE_PASSAGEIROS" as const,
    fundamento:
      "Transporte municipal de passageiros — Anexo III por atividade (LC 123 art. 18 §5º-B XIII). Não passa pelo Fator R.",
  },
  ...["5911", "5912", "5913", "5914", "9001"].map((prefixo) => ({
    prefixo,
    ...servicoAnexoIII(
      "Produção cinematográfica, audiovisual e artes cênicas — Anexo III por atividade (LC 123 art. 18 §5º-B XV). Não passa pelo Fator R."
    ),
  })),
  {
    prefixo: "6622",
    ...servicoAnexoIII(
      "Corretagem de seguros — Anexo III por atividade (LC 123 art. 18 §5º-B XVII). Não passa pelo Fator R."
    ),
  },
];

const REGRAS_POR_ESPECIFICIDADE = [...REGRAS].sort(
  (a, b) => b.prefixo.length - a.prefixo.length
);

// ─── Consulta ─────────────────────────────────────────────────────────────────

/**
 * Enquadra o CNAE, ou devolve `null` quando a atividade não está nas listas.
 *
 * `null` não é falha: é a resposta honesta para "não dá para afirmar sem ler o
 * rol". Quem chama deve pedir a decisão ao usuário, nunca assumir um padrão.
 */
export function classificarCnae(
  bruto: string | number | null | undefined
): EnquadramentoCnae | null {
  const d = digitosCnae(bruto);
  if (d.length !== 7) return null;

  const regra = REGRAS_POR_ESPECIFICIDADE.find((r) => d.startsWith(r.prefixo));
  if (!regra) return null;

  const { prefixo: _prefixo, ...enquadramento } = regra;
  return enquadramento;
}

/**
 * Texto curto para a tela quando o CNAE não foi reconhecido — a mensagem
 * precisa dizer o que fazer, não só que falhou.
 */
export const AVISO_CNAE_NAO_CLASSIFICADO =
  "Não consegui enquadrar este CNAE automaticamente. Confira o anexo no rol da LC 123 art. 18 §§5º-B a 5º-F e marque abaixo se a atividade é sujeita ao Fator R.";
