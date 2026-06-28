/**
 * Cálculos financeiros determinísticos do Quibo.
 *
 * Todas as funções são puras e testáveis. Nunca delegadas à IA (P8).
 * Valores monetários são sempre inteiros de centavos.
 */

import type { Entry, LivingCost, DebtInstallment } from "@/core/db/schema";
import { estaVigemNoMes, janelaCicloCartao } from "@/utils/dates";

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export type EstadoMes = "SOBRA_BOA" | "APERTADO" | "VERMELHO";

export interface ResumoMes {
  receitaCents: number;
  despesaCents: number;
  sobraCents: number;
  estado: EstadoMes;
}

// ─── Sobra do mês ─────────────────────────────────────────────────────────────

/**
 * Calcula receita, despesa e sobra do mês.
 *
 * - Receita: soma de entries INCOME do mês (sem cartão)
 * - Despesa: soma de entries EXPENSE do mês (sem cartão) + faturas derivadas + custos de vida + parcelas de dívida
 */
export function calcularResumoMes(
  entries: Entry[],
  custoDeVidaAtivos: LivingCost[],
  parcelasDivida: DebtInstallment[],
  faturaCartoes: { creditCardId: string; totalCents: number }[],
  mes: number,
  ano: number,
  limiteApertado = 0.15
): ResumoMes {
  const entriesDoMes = entries.filter(
    (e) => e.month === mes && e.year === ano && e.status !== "CANCELADO"
  );

  const receita = entriesDoMes
    .filter((e) => e.type === "INCOME" && !e.creditCardId)
    .reduce((s, e) => s + e.amountCents, 0);

  const despesaEntries = entriesDoMes
    .filter((e) => e.type === "EXPENSE" && !e.creditCardId)
    .reduce((s, e) => s + e.amountCents, 0);

  const despesaCustos = custoDeVidaAtivos
    .filter((c) =>
      estaVigemNoMes(c.startDate, c.endDate, mes, ano) &&
      c.sourceType === "ACCOUNT"
    )
    .reduce((s, c) => s + c.amountCents, 0);

  const despesaParcelas = parcelasDivida.reduce(
    (s, p) => s + p.amountCents,
    0
  );

  const despesaFaturas = faturaCartoes.reduce(
    (s, f) => s + f.totalCents,
    0
  );

  const despesa =
    despesaEntries + despesaCustos + despesaParcelas + despesaFaturas;
  const sobra = receita - despesa;

  return {
    receitaCents: receita,
    despesaCents: despesa,
    sobraCents: sobra,
    estado: calcularEstadoMes(sobra, receita, limiteApertado),
  };
}

/** Determina o "clima" do mês com base na sobra relativa. */
export function calcularEstadoMes(
  sobraCents: number,
  receitaCents: number,
  limiteApertado = 0.15
): EstadoMes {
  if (sobraCents < 0) return "VERMELHO";
  const ratio = sobraCents / Math.max(receitaCents, 1);
  if (ratio < limiteApertado) return "APERTADO";
  return "SOBRA_BOA";
}

// ─── Ciclo de fatura do cartão ────────────────────────────────────────────────

/** Calcula o total de uma fatura derivado dos entries do ciclo. */
export function calcularTotalFatura(
  entries: Entry[],
  creditCardId: string,
  mes: number,
  ano: number,
  closingDay: number
): number {
  const { inicio, fim } = janelaCicloCartao(mes, ano, closingDay);

  return entries
    .filter(
      (e) =>
        e.creditCardId === creditCardId &&
        e.status !== "CANCELADO" &&
        e.date >= inicio &&
        e.date <= fim
    )
    .reduce((s, e) => s + e.amountCents, 0);
}

/** Calcula limite disponível do cartão (entries PREVISTO consomem limite). */
export function calcularLimiteDisponivel(
  entries: Entry[],
  creditCardId: string,
  limiteCents: number
): number {
  const consumido = entries
    .filter(
      (e) =>
        e.creditCardId === creditCardId && e.status === "PREVISTO"
    )
    .reduce((s, e) => s + e.amountCents, 0);

  return limiteCents - consumido;
}

// ─── Saldo de conta ───────────────────────────────────────────────────────────

/** Recalcula saldo do zero a partir dos entries confirmados. */
export function recalcularSaldo(
  entries: Entry[],
  accountId: string,
  initialBalanceCents: number
): number {
  const confirmados = entries.filter(
    (e) => e.accountId === accountId && e.status === "CONFIRMADO"
  );

  const entradas = confirmados
    .filter((e) => e.type === "INCOME")
    .reduce((s, e) => s + e.amountCents, 0);

  const saidas = confirmados
    .filter((e) => e.type === "EXPENSE")
    .reduce((s, e) => s + e.amountCents, 0);

  return initialBalanceCents + entradas - saidas;
}

// ─── Progresso de dívida ──────────────────────────────────────────────────────

export interface ProgressoDivida {
  porcentagem: number;
  faltaCents: number;
  status: "ACTIVE" | "PAID_OFF" | "OVERDUE";
}

export function calcularProgressoDivida(
  totalAmountCents: number,
  paidAmountCents: number,
  temParcelaVencida: boolean
): ProgressoDivida {
  const porcentagem =
    totalAmountCents > 0
      ? Math.min(100, (paidAmountCents / totalAmountCents) * 100)
      : 0;

  const faltaCents = Math.max(0, totalAmountCents - paidAmountCents);

  let status: ProgressoDivida["status"] = "ACTIVE";
  if (paidAmountCents >= totalAmountCents) status = "PAID_OFF";
  else if (temParcelaVencida) status = "OVERDUE";

  return { porcentagem, faltaCents, status };
}

// ─── Juros de atraso ─────────────────────────────────────────────────────────

/**
 * Calcula multa por atraso de parcela.
 *
 * @param installmentValueCents valor da parcela em centavos
 * @param dueDate data de vencimento ISO
 * @param paidDate data de pagamento ISO
 * @param interestRatePercent % ao mês
 */
export function calcularJurosAtraso(
  installmentValueCents: number,
  dueDate: string,
  paidDate: string,
  interestRatePercent: number
): number {
  const due = new Date(dueDate).getTime();
  const paid = new Date(paidDate).getTime();
  const diffMs = paid - due;

  if (diffMs <= 0) return 0;

  const mesesAtraso = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
  const multa = Math.round(
    installmentValueCents * (interestRatePercent / 100) * mesesAtraso
  );

  return multa;
}

// ─── Salário horista ─────────────────────────────────────────────────────────

/**
 * Calcula valor bruto de salário horista para um mês.
 *
 * @param hourlyRateCents valor da hora em centavos
 * @param hoursPerDay horas por dia
 * @param diasTrabalhados total de dias trabalhados no mês
 */
export function calcularSalarioHorista(
  hourlyRateCents: number,
  hoursPerDay: number,
  diasTrabalhados: number
): number {
  return Math.round(hourlyRateCents * hoursPerDay * diasTrabalhados);
}
