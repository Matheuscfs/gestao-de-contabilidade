import { formatISO } from "date-fns";
import {
  FERIADOS_NACIONAIS_FIXOS,
  FERIADOS_NACIONAIS_MOVEIS,
} from "@/consts/feriados";

/**
 * Feriados nacionais brasileiros.
 *
 * Retorna lista de strings ISO "YYYY-MM-DD" para o ano informado.
 * Inclui feriados fixos e os móveis calculados com base na Páscoa.
 * As datas-base ficam em `@/consts/feriados`.
 */
export function feriadosDoAno(ano: number): string[] {
  const pascoa = calcularPascoa(ano);

  const fixos = FERIADOS_NACIONAIS_FIXOS.map((f) => iso(ano, f.mes, f.dia));

  const moveis = FERIADOS_NACIONAIS_MOVEIS.map((f) => {
    const data = new Date(pascoa);
    data.setDate(pascoa.getDate() + f.offsetPascoa);
    return formatISO(data, { representation: "date" });
  });

  return [...new Set([...fixos, ...moveis])].sort();
}

/**
 * Calcula a data da Páscoa pelo algoritmo de Meeus/Jones/Butcher.
 */
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(ano, mes - 1, dia);
}

function iso(ano: number, mes: number, dia: number): string {
  return formatISO(new Date(ano, mes - 1, dia), { representation: "date" });
}
