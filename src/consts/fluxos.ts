/**
 * Fluxos padrão: o procedimento do escritório para cumprir cada obrigação.
 *
 * Distinção que importa: o **catálogo de obrigações** (`obrigacoes.ts`) diz o
 * que a lei exige e quando vence — é regra, vive em código e é versionada com
 * o app. O **fluxo** diz como o escritório trabalha aquela obrigação (gerar a
 * guia, mandar pro cliente, conferir o pró-labore) — é rotina, muda de
 * escritório para escritório e o usuário edita na tela de Fluxos.
 *
 * O que está aqui é só a semente: na primeira execução estas etapas vão para
 * `obrigacao_fluxo_etapas` e, a partir daí, o banco é a fonte da verdade.
 * Mexer neste arquivo depois não reescreve o que o usuário já ajustou.
 */

/**
 * Quando a etapa se aplica. Avaliada por empresa na geração do quadro — é o
 * que faz "verificar se tem pró-labore" só aparecer em quem tem, em vez de
 * virar uma linha morta no checklist de todo mundo.
 */
export type CondicaoEtapa =
  | "TEM_PRO_LABORE"
  | "SEM_PRO_LABORE"
  | "TEM_FUNCIONARIOS"
  | "SEM_MOVIMENTO"
  | "COM_MOVIMENTO";

export const LABEL_CONDICAO: Record<CondicaoEtapa, string> = {
  TEM_PRO_LABORE: "só com pró-labore",
  SEM_PRO_LABORE: "só sem pró-labore",
  TEM_FUNCIONARIOS: "só com funcionários",
  SEM_MOVIMENTO: "só sem movimento",
  COM_MOVIMENTO: "só com movimento",
};

export type EtapaFluxoPadrao = {
  descricao: string;
  condicao?: CondicaoEtapa;
};

/**
 * Etapas padrão por código do catálogo de obrigações.
 *
 * Códigos sem entrada aqui nascem com um fluxo mínimo genérico
 * (`ETAPAS_GENERICAS`) — melhor um checklist curto do que card sem checklist.
 */
export const FLUXOS_PADRAO: Record<string, EtapaFluxoPadrao[]> = {
  // ── Simples Nacional ────────────────────────────────────────────────────────
  DAS: [
    { descricao: "Gerar guia do DAS" },
    { descricao: "Enviar guia ao cliente" },
    { descricao: "Confirmar pagamento" },
    { descricao: "Confirmar entrega zerada", condicao: "SEM_MOVIMENTO" },
  ],
  PGDAS_D: [
    { descricao: "Apurar a receita do mês" },
    { descricao: "Transmitir PGDAS-D" },
    { descricao: "Guardar o recibo de transmissão" },
  ],
  DEFIS: [
    { descricao: "Conferir as receitas do ano-base" },
    { descricao: "Transmitir DEFIS" },
    { descricao: "Guardar o recibo de transmissão" },
  ],

  // ── MEI ─────────────────────────────────────────────────────────────────────
  DAS_MEI: [
    { descricao: "Gerar DAS-MEI" },
    { descricao: "Enviar guia ao cliente" },
    { descricao: "Confirmar pagamento" },
  ],
  DASN_SIMEI: [
    { descricao: "Conferir o faturamento do ano" },
    { descricao: "Transmitir DASN-SIMEI" },
  ],

  // ── Pró-labore e folha ──────────────────────────────────────────────────────
  INSS_DARF: [
    { descricao: "Conferir o pró-labore do mês", condicao: "TEM_PRO_LABORE" },
    { descricao: "Emitir a guia do pró-labore", condicao: "TEM_PRO_LABORE" },
    { descricao: "Enviar guia ao cliente", condicao: "TEM_PRO_LABORE" },
    { descricao: "Registrar que não houve retirada", condicao: "SEM_PRO_LABORE" },
  ],
  ESOCIAL_FOLHA: [
    { descricao: "Fechar a folha do mês" },
    { descricao: "Transmitir o eSocial" },
    { descricao: "Enviar holerites ao cliente" },
  ],
  FGTS_DIGITAL: [
    { descricao: "Emitir a guia do FGTS" },
    { descricao: "Enviar guia ao cliente" },
    { descricao: "Confirmar pagamento" },
  ],
  DCTFWEB: [
    { descricao: "Conferir os débitos apurados" },
    { descricao: "Transmitir DCTFWeb" },
    { descricao: "Emitir e enviar o DARF" },
  ],

  // ── Lucro Presumido / Real ──────────────────────────────────────────────────
  EFD_ICMS_IPI: [
    { descricao: "Fechar o movimento fiscal do mês" },
    { descricao: "Transmitir o SPED Fiscal" },
    { descricao: "Guardar o recibo de transmissão" },
  ],
  ECD: [
    { descricao: "Fechar o balanço do ano-base" },
    { descricao: "Transmitir o SPED Contábil" },
    { descricao: "Guardar o recibo de transmissão" },
  ],
  ECF: [
    { descricao: "Conferir a apuração do ano-base" },
    { descricao: "Transmitir a ECF" },
    { descricao: "Guardar o recibo de transmissão" },
  ],
  IRPJ_CSLL_TRI: [
    { descricao: "Apurar IRPJ e CSLL do trimestre" },
    { descricao: "Emitir os DARFs" },
    { descricao: "Enviar guias ao cliente" },
  ],
  PIS_COFINS: [
    { descricao: "Apurar PIS e Cofins" },
    { descricao: "Emitir os DARFs" },
    { descricao: "Enviar guias ao cliente" },
  ],
  EFD_CONTRIBUICOES: [
    { descricao: "Fechar a apuração de contribuições" },
    { descricao: "Transmitir a EFD-Contribuições" },
    { descricao: "Guardar o recibo de transmissão" },
  ],
  EFD_REINF: [
    { descricao: "Conferir retenções do mês" },
    { descricao: "Transmitir a EFD-Reinf" },
  ],

  // ── Municipal ───────────────────────────────────────────────────────────────
  ISS_MENSAL: [
    { descricao: "Conferir as NFS-e emitidas" },
    { descricao: "Gerar a guia do ISS" },
    { descricao: "Enviar guia ao cliente" },
  ],

  // ── Reforma tributária ──────────────────────────────────────────────────────
  APURACAO_IBS_CBS: [
    { descricao: "Conferir os documentos do período" },
    { descricao: "Fechar a apuração de IBS/CBS" },
  ],
  CBS_MENSAL: [
    { descricao: "Apurar a CBS" },
    { descricao: "Emitir a guia" },
    { descricao: "Enviar guia ao cliente" },
  ],
  IBS_MENSAL: [
    { descricao: "Apurar o IBS" },
    { descricao: "Emitir a guia" },
    { descricao: "Enviar guia ao cliente" },
  ],
};

/** Fluxo mínimo para obrigação sem etapas próprias definidas. */
export const ETAPAS_GENERICAS: EtapaFluxoPadrao[] = [
  { descricao: "Apurar" },
  { descricao: "Entregar / transmitir" },
  { descricao: "Enviar comprovante ao cliente" },
];

/** Etapas padrão de um código, caindo no genérico quando não há específico. */
export function fluxoPadrao(codigo: string): EtapaFluxoPadrao[] {
  return FLUXOS_PADRAO[codigo] ?? ETAPAS_GENERICAS;
}

// ─── Avaliação de condições ───────────────────────────────────────────────────

/** O que uma condição de etapa precisa saber da empresa. */
export type ContextoEtapa = {
  temProLabore: boolean;
  temFuncionarios: boolean;
  semMovimento: boolean;
};

/**
 * A etapa entra no checklist desta empresa? Etapa sem condição entra sempre.
 */
export function etapaSeAplica(
  condicao: CondicaoEtapa | null | undefined,
  ctx: ContextoEtapa
): boolean {
  if (!condicao) return true;
  switch (condicao) {
    case "TEM_PRO_LABORE":
      return ctx.temProLabore;
    case "SEM_PRO_LABORE":
      return !ctx.temProLabore;
    case "TEM_FUNCIONARIOS":
      return ctx.temFuncionarios;
    case "SEM_MOVIMENTO":
      return ctx.semMovimento;
    case "COM_MOVIMENTO":
      return !ctx.semMovimento;
  }
}
