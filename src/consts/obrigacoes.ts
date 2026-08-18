/**
 * Catálogo de obrigações acessórias e tributos por regime.
 *
 * Vive em código (como as tabelas de INSS/IRRF em `clt.ts`): as regras são
 * versionadas com o app e atualizadas por migração de código, não de dados.
 * O banco guarda apenas as ocorrências geradas (`obrigacoes_ocorrencias`) e as
 * desativações por empresa (`obrigacoes_desativadas`).
 *
 * Prazos legais mudam — os valores aqui refletem as regras vigentes em 2026 e
 * casos que variam por UF/município estão sinalizados na descrição para o
 * usuário ajustar ou desativar.
 */

import {
  addDays,
  addMonths,
  formatISO,
  getDaysInMonth,
  isWeekend,
  parseISO,
  subDays,
} from "date-fns";
import { feriadosDoAno } from "@/utils/holidays";
import type { RegimeIbsCbs, RegimeTributario } from "@/core/db/empresas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoObrigacao = "GUIA" | "DECLARACAO";
export type EsferaObrigacao = "FEDERAL" | "ESTADUAL" | "MUNICIPAL";
export type PeriodicidadeObrigacao = "MENSAL" | "TRIMESTRAL" | "ANUAL";
/** Como o vencimento se move quando cai em fim de semana/feriado. */
export type AjusteDiaUtil = "ANTECIPA" | "POSTERGA" | "NENHUM";

/** O que o catálogo precisa saber da empresa para decidir aplicabilidade. */
export type ContextoEmpresa = {
  regime: RegimeTributario;
  temFuncionarios: boolean;
  temProLabore: boolean;
  /** Opção da reforma tributária (Simples: DAS / híbrido / regular). */
  regimeIbsCbs?: RegimeIbsCbs | null;
};

export type ObrigacaoDef = {
  codigo: string;
  nome: string;
  descricao: string;
  tipo: TipoObrigacao;
  esfera: EsferaObrigacao;
  periodicidade: PeriodicidadeObrigacao;
  /** Dia do mês do vencimento (limitado ao último dia do mês). */
  diaVencimento: number;
  /** Mensal/trimestral: meses entre a competência e o vencimento (padrão 1). */
  mesesAposCompetencia?: number;
  /** Anual: mês do vencimento no ano seguinte ao de apuração (1–12). */
  mesVencimento?: number;
  ajusteDiaUtil: AjusteDiaUtil;
  aplica: (ctx: ContextoEmpresa) => boolean;
  /**
   * Anos-calendário de competência em que a obrigação existe (reforma
   * tributária): `deAno` inclusivo, `ateAno` inclusivo. Ausente = sempre.
   */
  vigencia?: { deAno?: number; ateAno?: number };
};

// ─── Catálogo ─────────────────────────────────────────────────────────────────

const temFolha = (ctx: ContextoEmpresa) =>
  ctx.temFuncionarios || ctx.temProLabore;
const regimeRegular = (ctx: ContextoEmpresa) =>
  ctx.regime === "PRESUMIDO" || ctx.regime === "REAL";
/** Apura IBS/CBS por fora: Presumido/Real, ou Simples que optou por híbrido/regular. */
const apuraIbsCbs = (ctx: ContextoEmpresa) =>
  regimeRegular(ctx) ||
  (ctx.regime === "SIMPLES" &&
    (ctx.regimeIbsCbs === "SIMPLES_HIBRIDO" || ctx.regimeIbsCbs === "REGULAR"));

export const CATALOGO_OBRIGACOES: ObrigacaoDef[] = [
  // ── MEI ─────────────────────────────────────────────────────────────────────
  {
    codigo: "DAS_MEI",
    nome: "DAS-MEI",
    descricao: "Guia mensal do MEI, gerada no portal do Simples Nacional.",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "POSTERGA",
    aplica: (ctx) => ctx.regime === "MEI",
  },
  {
    codigo: "DASN_SIMEI",
    nome: "DASN-SIMEI",
    descricao: "Declaração anual de faturamento do MEI.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "ANUAL",
    diaVencimento: 31,
    mesVencimento: 5,
    ajusteDiaUtil: "NENHUM",
    aplica: (ctx) => ctx.regime === "MEI",
  },

  // ── Simples Nacional ───────────────────────────────────────────────────────
  {
    codigo: "PGDAS_D",
    nome: "PGDAS-D",
    descricao: "Apuração mensal do Simples Nacional — gera o DAS.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "POSTERGA",
    aplica: (ctx) => ctx.regime === "SIMPLES",
  },
  {
    codigo: "DAS",
    nome: "DAS",
    descricao: "Guia unificada do Simples Nacional.",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "POSTERGA",
    aplica: (ctx) => ctx.regime === "SIMPLES",
  },
  {
    codigo: "DEFIS",
    nome: "DEFIS",
    descricao: "Declaração anual de informações socioeconômicas do Simples.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "ANUAL",
    diaVencimento: 31,
    mesVencimento: 3,
    ajusteDiaUtil: "NENHUM",
    aplica: (ctx) => ctx.regime === "SIMPLES",
  },

  // ── Folha (funcionários e/ou pró-labore, qualquer regime) ──────────────────
  {
    codigo: "ESOCIAL_FOLHA",
    nome: "eSocial — folha",
    descricao:
      "Fechamento da folha no eSocial: funcionários e pró-labore dos sócios.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 15,
    ajusteDiaUtil: "ANTECIPA",
    aplica: temFolha,
  },
  {
    codigo: "DCTFWEB",
    nome: "DCTFWeb / MIT",
    descricao:
      "Declaração dos débitos federais (folha e, no Presumido/Real, demais tributos via MIT).",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 25,
    ajusteDiaUtil: "ANTECIPA",
    aplica: (ctx) => temFolha(ctx) || regimeRegular(ctx),
  },
  {
    codigo: "INSS_DARF",
    nome: "INSS (DARF)",
    descricao:
      "Recolhimento do INSS da folha e do pró-labore, com DARF emitido na DCTFWeb.",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "ANTECIPA",
    aplica: temFolha,
  },
  {
    codigo: "FGTS_DIGITAL",
    nome: "FGTS Digital",
    descricao: "Guia mensal do FGTS dos funcionários (sócio não tem FGTS).",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "ANTECIPA",
    aplica: (ctx) => ctx.temFuncionarios,
  },

  // ── Lucro Presumido / Lucro Real ───────────────────────────────────────────
  {
    codigo: "PIS_COFINS",
    nome: "PIS/Cofins",
    descricao:
      "Guias mensais de PIS e Cofins — últimas competências em dez/2026; a CBS assume a partir de 2027 (reforma tributária).",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 25,
    ajusteDiaUtil: "ANTECIPA",
    aplica: regimeRegular,
    vigencia: { ateAno: 2026 },
  },
  {
    codigo: "EFD_CONTRIBUICOES",
    nome: "EFD-Contribuições",
    descricao:
      "Escrituração de PIS/Cofins até a competência dez/2026. Prazo legal: 10º dia útil do 2º mês seguinte (data aproximada).",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 10,
    mesesAposCompetencia: 2,
    ajusteDiaUtil: "POSTERGA",
    aplica: regimeRegular,
    vigencia: { ateAno: 2026 },
  },

  // ── Reforma tributária (IBS/CBS) ───────────────────────────────────────────
  {
    codigo: "APURACAO_IBS_CBS",
    nome: "Apuração IBS/CBS",
    descricao:
      "Apuração assistida do IBS/CBS. Em 2026 é informativa (CBS 0,9% + IBS 0,1%) e dispensa o recolhimento se cumprida. Prazo aproximado.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "POSTERGA",
    aplica: apuraIbsCbs,
    vigencia: { deAno: 2026 },
  },
  {
    codigo: "CBS_MENSAL",
    nome: "CBS",
    descricao:
      "Contribuição sobre Bens e Serviços — substitui PIS/Cofins a partir de 2027. Prazo estimado (a confirmar na regulamentação).",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "ANTECIPA",
    aplica: apuraIbsCbs,
    vigencia: { deAno: 2027 },
  },
  {
    codigo: "IBS_MENSAL",
    nome: "IBS",
    descricao:
      "Imposto sobre Bens e Serviços — transição do ICMS/ISS de 2029 a 2032, pleno em 2033. Prazo estimado.",
    tipo: "GUIA",
    esfera: "ESTADUAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "ANTECIPA",
    aplica: apuraIbsCbs,
    vigencia: { deAno: 2029 },
  },
  {
    codigo: "IRPJ_CSLL_TRI",
    nome: "IRPJ/CSLL trimestral",
    descricao:
      "Quota única (ou 1ª quota) do IRPJ e da CSLL, até o último dia útil do mês seguinte ao trimestre.",
    tipo: "GUIA",
    esfera: "FEDERAL",
    periodicidade: "TRIMESTRAL",
    diaVencimento: 31,
    ajusteDiaUtil: "ANTECIPA",
    aplica: regimeRegular,
  },
  {
    codigo: "EFD_REINF",
    nome: "EFD-Reinf",
    descricao:
      "Retenções e receitas sem folha. Desative se a empresa não tem eventos a informar.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "MENSAL",
    diaVencimento: 15,
    ajusteDiaUtil: "ANTECIPA",
    aplica: regimeRegular,
  },
  {
    codigo: "ISS_MENSAL",
    nome: "ISS",
    descricao:
      "Imposto municipal sobre serviços. Dia e regras variam por município — ajuste ou desative se não for prestadora.",
    tipo: "GUIA",
    esfera: "MUNICIPAL",
    periodicidade: "MENSAL",
    diaVencimento: 10,
    ajusteDiaUtil: "POSTERGA",
    aplica: regimeRegular,
  },
  {
    codigo: "EFD_ICMS_IPI",
    nome: "EFD ICMS/IPI",
    descricao:
      "Escrituração estadual para contribuintes de ICMS/IPI. Prazo varia por UF — desative se não contribuinte.",
    tipo: "DECLARACAO",
    esfera: "ESTADUAL",
    periodicidade: "MENSAL",
    diaVencimento: 20,
    ajusteDiaUtil: "POSTERGA",
    aplica: regimeRegular,
  },
  {
    codigo: "ECD",
    nome: "ECD",
    descricao:
      "Escrituração Contábil Digital. Obrigatória no Lucro Real; no Presumido, se distribuir lucros acima da presunção.",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "ANUAL",
    diaVencimento: 31,
    mesVencimento: 5,
    ajusteDiaUtil: "ANTECIPA",
    aplica: regimeRegular,
  },
  {
    codigo: "ECF",
    nome: "ECF",
    descricao: "Escrituração Contábil Fiscal (substituiu a DIPJ).",
    tipo: "DECLARACAO",
    esfera: "FEDERAL",
    periodicidade: "ANUAL",
    diaVencimento: 31,
    mesVencimento: 7,
    ajusteDiaUtil: "ANTECIPA",
    aplica: regimeRegular,
  },
];

export function obterObrigacao(codigo: string): ObrigacaoDef | null {
  return CATALOGO_OBRIGACOES.find((o) => o.codigo === codigo) ?? null;
}

/** Obrigações do catálogo que se aplicam à empresa (antes das desativações manuais). */
export function obrigacoesAplicaveis(ctx: ContextoEmpresa): ObrigacaoDef[] {
  return CATALOGO_OBRIGACOES.filter((o) => o.aplica(ctx));
}

// ─── Cálculo de vencimento ────────────────────────────────────────────────────

/** Move a data para dia útil (sem sábado/domingo/feriado nacional) conforme o modo. */
export function ajustarParaDiaUtil(
  dataISO: string,
  modo: AjusteDiaUtil
): string {
  if (modo === "NENHUM") return dataISO;
  let data = parseISO(dataISO);
  const passo = modo === "POSTERGA" ? 1 : -1;
  // Feriados do ano da data (recarregados se o ajuste cruzar a virada do ano).
  let feriados = feriadosDoAno(data.getFullYear());
  let iso = dataISO;
  while (isWeekend(data) || feriados.includes(iso)) {
    data = passo === 1 ? addDays(data, 1) : subDays(data, 1);
    if (data.getFullYear() !== parseISO(iso).getFullYear()) {
      feriados = feriadosDoAno(data.getFullYear());
    }
    iso = formatISO(data, { representation: "date" });
  }
  return iso;
}

/**
 * Vencimento de uma obrigação para a competência dada, já ajustado a dia útil.
 * Mensal/trimestral: competência + `mesesAposCompetencia` (padrão 1).
 * Anual: `mesVencimento` do ano seguinte ao de apuração.
 *
 * `diaOverride` substitui o dia do catálogo — usado pelo ISS, que é municipal
 * e vence em data diferente em cada cidade.
 */
export function calcularVencimento(
  def: ObrigacaoDef,
  competenciaMes: number,
  competenciaAno: number,
  diaOverride?: number | null
): string {
  let mes: number;
  let ano: number;
  if (def.periodicidade === "ANUAL") {
    ano = competenciaAno + 1;
    mes = def.mesVencimento ?? 12;
  } else {
    const base = addMonths(
      new Date(competenciaAno, competenciaMes - 1, 1),
      def.mesesAposCompetencia ?? 1
    );
    mes = base.getMonth() + 1;
    ano = base.getFullYear();
  }
  // O override existe para obrigação municipal: o ISS vence em dia diferente
  // em cada cidade, e o catálogo não tem como saber de qual empresa se trata.
  const diaBase =
    diaOverride != null && diaOverride >= 1 && diaOverride <= 31
      ? diaOverride
      : def.diaVencimento;
  const dia = Math.min(diaBase, getDaysInMonth(new Date(ano, mes - 1)));
  const iso = formatISO(new Date(ano, mes - 1, dia), { representation: "date" });
  return ajustarParaDiaUtil(iso, def.ajusteDiaUtil);
}

/**
 * Competências que devem existir hoje para uma obrigação, dentro da vida da
 * empresa. Janela: mensal = últimos 4 meses; trimestral = trimestres fechados
 * no último ano; anual = apuração do ano anterior.
 *
 * A vida da empresa é limitada nas duas pontas: nada antes da abertura, nada
 * depois da baixa. O corte é pelo **mês**, não pelo dia — empresa baixada em
 * 20/03 ainda deve a competência de março inteira, e cortar no dia exato
 * apagaria uma entrega que continua obrigatória.
 */
export function competenciasNaJanela(
  def: ObrigacaoDef,
  hoje: Date,
  aberturaISO: string | null,
  baixaISO: string | null = null
): { mes: number; ano: number }[] {
  const abertura = aberturaISO ? parseISO(aberturaISO) : null;
  const depoisDaAbertura = (mes: number, ano: number) =>
    !abertura ||
    ano > abertura.getFullYear() ||
    (ano === abertura.getFullYear() && mes >= abertura.getMonth() + 1);

  const baixa = baixaISO ? parseISO(baixaISO) : null;
  const antesDaBaixa = (mes: number, ano: number) =>
    !baixa ||
    ano < baixa.getFullYear() ||
    (ano === baixa.getFullYear() && mes <= baixa.getMonth() + 1);
  // Vigência da obrigação (reforma tributária): competências fora do intervalo
  // de anos não são geradas.
  const naVigencia = (ano: number) =>
    (def.vigencia?.deAno == null || ano >= def.vigencia.deAno) &&
    (def.vigencia?.ateAno == null || ano <= def.vigencia.ateAno);

  const competencias: { mes: number; ano: number }[] = [];

  if (def.periodicidade === "ANUAL") {
    const anoApuracao = hoje.getFullYear() - 1;
    if (
      naVigencia(anoApuracao) &&
      (!abertura || abertura.getFullYear() <= anoApuracao) &&
      (!baixa || baixa.getFullYear() >= anoApuracao)
    ) {
      competencias.push({ mes: 12, ano: anoApuracao });
    }
    return competencias;
  }

  const passoMeses = def.periodicidade === "TRIMESTRAL" ? 3 : 1;
  const janelaMeses = def.periodicidade === "TRIMESTRAL" ? 12 : 4;
  for (let atras = 0; atras < janelaMeses; atras++) {
    const base = addMonths(new Date(hoje.getFullYear(), hoje.getMonth(), 1), -atras);
    const mes = base.getMonth() + 1;
    const ano = base.getFullYear();
    if (def.periodicidade === "TRIMESTRAL" && mes % passoMeses !== 0) continue;
    if (!naVigencia(ano)) continue;
    if (!depoisDaAbertura(mes, ano)) continue;
    if (!antesDaBaixa(mes, ano)) continue;
    competencias.push({ mes, ano });
  }
  return competencias;
}

// ─── Rótulos ──────────────────────────────────────────────────────────────────

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "ref. jul/2026", "2º trimestre 2026" ou "ano-base 2025". */
export function rotuloCompetencia(
  periodicidade: PeriodicidadeObrigacao,
  mes: number,
  ano: number
): string {
  if (periodicidade === "ANUAL") return `ano-base ${ano}`;
  if (periodicidade === "TRIMESTRAL") return `${mes / 3}º trimestre ${ano}`;
  return `ref. ${MESES_CURTOS[mes - 1]}/${ano}`;
}
