import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  getYear,
  getMonth,
  getDaysInMonth,
  isWeekend,
  isAfter,
  isBefore,
  parseISO,
  formatISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { feriadosDoAno } from "./holidays";

/** Retorna timestamp ISO-8601 UTC atual (para campos createdAt/updatedAt). */
export function agora(): string {
  return new Date().toISOString();
}

/** Retorna data ISO-8601 local YYYY-MM-DD. */
export function hoje(): string {
  return formatISO(new Date(), { representation: "date" });
}

/** Formata mês e ano para exibição. Ex.: formatarMesAno(6, 2025) → "junho de 2025" */
export function formatarMesAno(mes: number, ano: number): string {
  const data = new Date(ano, mes - 1, 1);
  return format(data, "MMMM 'de' yyyy", { locale: ptBR });
}

/** Formata data ISO para exibição. Ex.: "2025-06-15" → "15 de junho" */
export function formatarData(isoDate: string, incluirAno = false): string {
  const data = parseISO(isoDate);
  return format(data, incluirAno ? "d 'de' MMMM 'de' yyyy" : "d 'de' MMMM", {
    locale: ptBR,
  });
}

/** Início do mês como string ISO. */
export function inicioDoMes(mes: number, ano: number): string {
  return formatISO(startOfMonth(new Date(ano, mes - 1, 1)), {
    representation: "date",
  });
}

/** Fim do mês como string ISO. */
export function fimDoMes(mes: number, ano: number): string {
  return formatISO(endOfMonth(new Date(ano, mes - 1, 1)), {
    representation: "date",
  });
}

/** Retorna { mes, ano } do mês seguinte. */
export function proximoMes(
  mes: number,
  ano: number
): { mes: number; ano: number } {
  const d = addMonths(new Date(ano, mes - 1, 1), 1);
  return { mes: getMonth(d) + 1, ano: getYear(d) };
}

/** Retorna { mes, ano } do mês anterior. */
export function mesAnterior(
  mes: number,
  ano: number
): { mes: number; ano: number } {
  const d = subMonths(new Date(ano, mes - 1, 1), 1);
  return { mes: getMonth(d) + 1, ano: getYear(d) };
}

/**
 * Conta dias trabalhados em um mês segundo o tipo de jornada.
 * Usado no cálculo de salário horista.
 */
export function contarDiasTrabalhados(
  mes: number,
  ano: number,
  workDays: "ALL_DAYS" | "WEEKDAYS" | "CUSTOM",
  incluirFeriados: boolean,
  diasCustom?: number[]
): number {
  const totalDias = getDaysInMonth(new Date(ano, mes - 1));
  const feriados = incluirFeriados ? [] : feriadosDoAno(ano);

  let contagem = 0;

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = new Date(ano, mes - 1, dia);
    const isoData = formatISO(data, { representation: "date" });

    if (!incluirFeriados && feriados.includes(isoData)) continue;

    if (workDays === "ALL_DAYS") {
      contagem++;
    } else if (workDays === "WEEKDAYS") {
      if (!isWeekend(data)) contagem++;
    } else if (workDays === "CUSTOM" && diasCustom) {
      if (diasCustom.includes(data.getDay())) contagem++;
    }
  }

  return contagem;
}

/** Verifica se um compromisso está vigente num determinado mês. */
export function estaVigemNoMes(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  mes: number,
  ano: number
): boolean {
  const inicio = inicioDoMes(mes, ano);
  const fim = fimDoMes(mes, ano);

  if (startDate && isAfter(parseISO(startDate), parseISO(fim))) return false;
  if (endDate && isBefore(parseISO(endDate), parseISO(inicio))) return false;

  return true;
}

/** Janela de ciclo de cartão: [closingDay do mês anterior +1, closingDay do mês]. */
export function janelaCicloCartao(
  mes: number,
  ano: number,
  closingDay: number
): { inicio: string; fim: string } {
  const mesAnteriorData = subMonths(new Date(ano, mes - 1, 1), 1);
  const anoAnterior = getYear(mesAnteriorData);
  const mesAnteriorNum = getMonth(mesAnteriorData) + 1;

  const diaFimAnterior = Math.min(
    closingDay,
    getDaysInMonth(new Date(anoAnterior, mesAnteriorNum - 1))
  );
  const diaFimAtual = Math.min(
    closingDay,
    getDaysInMonth(new Date(ano, mes - 1))
  );

  const inicioDate = new Date(anoAnterior, mesAnteriorNum - 1, diaFimAnterior + 1);
  const fimDate = new Date(ano, mes - 1, diaFimAtual);

  return {
    inicio: formatISO(inicioDate, { representation: "date" }),
    fim: formatISO(fimDate, { representation: "date" }),
  };
}
