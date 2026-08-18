/**
 * Regras do financeiro do escritório — puras, sem banco e sem relógio próprio.
 *
 * Duas decisões estruturam tudo aqui:
 *
 * 1. **Status é derivado**, nunca gravado. "Atrasado" depende do dia em que se
 *    olha: um lançamento que hoje está em aberto amanhece atrasado sozinho.
 *    Gravar a palavra "ATRASADO" numa coluna criaria um dado que envelhece e
 *    passa a mentir — mesma postura das obrigações e da coluna do Kanban.
 *
 * 2. **A data de hoje entra por parâmetro.** É o que permite testar "venceu
 *    ontem" sem esperar a meia-noite, e o que impede a tela de mostrar coisas
 *    diferentes conforme o momento em que o componente renderizou.
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DirecaoLancamento = "RECEBER" | "PAGAR";

export type CategoriaLancamento =
  | "HONORARIO"
  | "SERVICO_EXTRA"
  | "REEMBOLSO"
  | "DESPESA"
  | "IMPOSTO"
  | "FOLHA"
  | "OUTRO";

export const LABEL_CATEGORIA: Record<CategoriaLancamento, string> = {
  HONORARIO: "Honorário mensal",
  SERVICO_EXTRA: "Serviço extra",
  REEMBOLSO: "Reembolso",
  DESPESA: "Despesa",
  IMPOSTO: "Imposto",
  FOLHA: "Folha",
  OUTRO: "Outro",
};

/** Categorias que fazem sentido em cada direção. */
export const CATEGORIAS_POR_DIRECAO: Record<
  DirecaoLancamento,
  CategoriaLancamento[]
> = {
  RECEBER: ["HONORARIO", "SERVICO_EXTRA", "REEMBOLSO", "OUTRO"],
  PAGAR: ["DESPESA", "IMPOSTO", "FOLHA", "OUTRO"],
};

export type StatusLancamento = "EM_ABERTO" | "ATRASADO" | "PAGO";

export const LABEL_STATUS: Record<StatusLancamento, string> = {
  EM_ABERTO: "Em aberto",
  ATRASADO: "Atrasado",
  PAGO: "Pago",
};

/** O mínimo que as regras precisam saber de um lançamento. */
export type LancamentoBase = {
  valorCents: number;
  /** ISO YYYY-MM-DD */
  vencimento: string;
  /** ISO YYYY-MM-DD; null = ainda não pago. */
  dataPagamento: string | null;
  valorPagoCents: number;
};

// ─── Datas ────────────────────────────────────────────────────────────────────

/**
 * Diferença em dias entre duas datas ISO. Positivo quando `fim` é posterior.
 *
 * Usa UTC de propósito: `new Date("2026-03-10")` já é meia-noite UTC, e
 * misturar com horário local faria a conta pular um dia dependendo do fuso —
 * exatamente o tipo de erro que transforma "pagou no dia" em "pagou atrasado".
 */
export function diferencaEmDias(inicio: string, fim: string): number {
  const MS_DIA = 86_400_000;
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / MS_DIA);
}

/**
 * Vencimento da competência `AAAA-MM` no dia contratado.
 *
 * Dia maior que o mês (31 em fevereiro) cai no último dia, em vez de vazar
 * para o mês seguinte. Não empurra para dia útil: honorário é contrato
 * privado, não prazo legal — quem define o dia é o combinado com o cliente.
 */
export function vencimentoDaCompetencia(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const d = Math.min(Math.max(Math.trunc(dia) || 1, 1), ultimoDia);
  return `${competencia}-${String(d).padStart(2, "0")}`;
}

/** Competência `AAAA-MM` a partir de mês e ano. */
export function competenciaDe(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

// ─── Status e pontualidade ────────────────────────────────────────────────────

export function statusLancamento(
  l: LancamentoBase,
  hojeIso: string
): StatusLancamento {
  if (l.dataPagamento) return "PAGO";
  return diferencaEmDias(l.vencimento, hojeIso) > 0 ? "ATRASADO" : "EM_ABERTO";
}

/**
 * Dias de atraso de um lançamento já pago. Zero quando pagou no dia ou antes —
 * antecipação não vira "atraso negativo", que só confundiria a média.
 */
export function diasDeAtraso(l: LancamentoBase): number {
  if (!l.dataPagamento) return 0;
  return Math.max(0, diferencaEmDias(l.vencimento, l.dataPagamento));
}

/** Dias que um lançamento em aberto já passou do vencimento. */
export function diasVencido(l: LancamentoBase, hojeIso: string): number {
  if (l.dataPagamento) return 0;
  return Math.max(0, diferencaEmDias(l.vencimento, hojeIso));
}

export type Pontualidade = {
  /** Lançamentos já pagos considerados no cálculo. */
  pagos: number;
  emDia: number;
  atrasados: number;
  /** Média de dias de atraso entre os pagos. Zero quando não há pagamento. */
  mediaDiasAtraso: number;
  piorAtrasoDias: number;
  /** 0 a 1. Null quando ainda não há histórico — não é "0% pontual". */
  percentualEmDia: number | null;
  /** Em aberto e já vencidos hoje. */
  emAtrasoAgora: number;
  valorEmAtrasoCents: number;
};

/**
 * Histórico de pontualidade de um cliente.
 *
 * Só lançamentos **pagos** entram na média: contar o que ainda nem venceu
 * puxaria o número para baixo sem que ninguém tenha atrasado nada.
 */
export function resumirPontualidade(
  lancamentos: LancamentoBase[],
  hojeIso: string
): Pontualidade {
  const pagos = lancamentos.filter((l) => l.dataPagamento);
  const atrasos = pagos.map(diasDeAtraso);
  const atrasados = atrasos.filter((d) => d > 0).length;
  const emAberto = lancamentos.filter(
    (l) => statusLancamento(l, hojeIso) === "ATRASADO"
  );

  return {
    pagos: pagos.length,
    emDia: pagos.length - atrasados,
    atrasados,
    mediaDiasAtraso:
      atrasos.length > 0
        ? atrasos.reduce((a, b) => a + b, 0) / atrasos.length
        : 0,
    piorAtrasoDias: atrasos.length > 0 ? Math.max(...atrasos) : 0,
    percentualEmDia:
      pagos.length > 0 ? (pagos.length - atrasados) / pagos.length : null,
    emAtrasoAgora: emAberto.length,
    valorEmAtrasoCents: emAberto.reduce((acc, l) => acc + l.valorCents, 0),
  };
}

// ─── Totais ───────────────────────────────────────────────────────────────────

export type TotaisFinanceiro = {
  previstoCents: number;
  /** Soma do que efetivamente entrou/saiu (valor pago, não o cobrado). */
  liquidadoCents: number;
  emAbertoCents: number;
  atrasadoCents: number;
};

/**
 * Totaliza um conjunto de lançamentos.
 *
 * `liquidadoCents` usa o valor **pago**, não o cobrado: baixa com desconto ou
 * com juros tem que aparecer pelo que entrou no caixa, senão o total do mês
 * nunca bate com o extrato.
 */
export function totalizar(
  lancamentos: LancamentoBase[],
  hojeIso: string
): TotaisFinanceiro {
  let previstoCents = 0;
  let liquidadoCents = 0;
  let emAbertoCents = 0;
  let atrasadoCents = 0;

  for (const l of lancamentos) {
    previstoCents += l.valorCents;
    const status = statusLancamento(l, hojeIso);
    if (status === "PAGO") {
      liquidadoCents += l.valorPagoCents;
    } else {
      emAbertoCents += l.valorCents;
      if (status === "ATRASADO") atrasadoCents += l.valorCents;
    }
  }

  return { previstoCents, liquidadoCents, emAbertoCents, atrasadoCents };
}
