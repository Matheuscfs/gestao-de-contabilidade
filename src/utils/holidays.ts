import { formatISO } from "date-fns";

/**
 * Feriados nacionais brasileiros.
 *
 * Retorna lista de strings ISO "YYYY-MM-DD" para o ano informado.
 * Inclui feriados fixos e os móveis calculados com base na Páscoa.
 */
export function feriadosDoAno(ano: number): string[] {
  const pascoa = calcularPascoa(ano);
  const fixos = feriadosFixos(ano);
  const moveis = feriadosMoveis(pascoa, ano);

  return [...new Set([...fixos, ...moveis])].sort();
}

/** Feriados nacionais com data fixa. */
function feriadosFixos(ano: number): string[] {
  return [
    iso(ano, 1, 1),   // Confraternização Universal
    iso(ano, 4, 21),  // Tiradentes
    iso(ano, 5, 1),   // Dia do Trabalho
    iso(ano, 9, 7),   // Independência do Brasil
    iso(ano, 10, 12), // Nossa Senhora Aparecida
    iso(ano, 11, 2),  // Finados
    iso(ano, 11, 15), // Proclamação da República
    iso(ano, 11, 20), // Consciência Negra (lei federal desde 2023)
    iso(ano, 12, 25), // Natal
  ];
}

/** Feriados móveis derivados da data da Páscoa. */
function feriadosMoveis(
  pascoa: Date,
  _ano: number
): string[] {
  const isoData = (d: Date) => formatISO(d, { representation: "date" });

  const carnavalSexta = new Date(pascoa);
  carnavalSexta.setDate(pascoa.getDate() - 48);

  const carnavalSegunda = new Date(pascoa);
  carnavalSegunda.setDate(pascoa.getDate() - 48 + 3);

  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(pascoa.getDate() - 2);

  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(pascoa.getDate() + 60);

  return [
    isoData(carnavalSexta),
    isoData(carnavalSegunda),
    isoData(sextaSanta),
    isoData(pascoa),
    isoData(corpusChristi),
  ];
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
