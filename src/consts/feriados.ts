/**
 * Feriados nacionais do Brasil — fonte única de dados.
 *
 * Os feriados FIXOS têm data certa todo ano (mês/dia). Os MÓVEIS dependem da
 * data da Páscoa e são informados como um deslocamento (em dias) a partir dela.
 *
 * O cálculo por ano (resolvendo a Páscoa e montando a lista ISO) fica em
 * `@/utils/holidays` (`feriadosDoAno`), que consome estas constantes. A contagem
 * de dias úteis de um mês específico fica em `@/utils/dates` (`diasUteisNoMes`).
 */

export type FeriadoFixo = { mes: number; dia: number; nome: string };
export type FeriadoMovel = { offsetPascoa: number; nome: string };

/** Feriados nacionais com data fixa. */
export const FERIADOS_NACIONAIS_FIXOS: readonly FeriadoFixo[] = [
  { mes: 1, dia: 1, nome: "Confraternização Universal" },
  { mes: 4, dia: 21, nome: "Tiradentes" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho" },
  { mes: 9, dia: 7, nome: "Independência do Brasil" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida" },
  { mes: 11, dia: 2, nome: "Finados" },
  { mes: 11, dia: 15, nome: "Proclamação da República" },
  { mes: 11, dia: 20, nome: "Consciência Negra" }, // lei federal desde 2024
  { mes: 12, dia: 25, nome: "Natal" },
];

/**
 * Feriados móveis nacionais, como deslocamento em dias a partir da Páscoa.
 * Carnaval (segunda e terça), Sexta-feira Santa, Páscoa e Corpus Christi.
 */
export const FERIADOS_NACIONAIS_MOVEIS: readonly FeriadoMovel[] = [
  { offsetPascoa: -48, nome: "Carnaval (segunda-feira)" },
  { offsetPascoa: -47, nome: "Carnaval (terça-feira)" },
  { offsetPascoa: -2, nome: "Sexta-feira Santa" },
  { offsetPascoa: 0, nome: "Páscoa" },
  { offsetPascoa: 60, nome: "Corpus Christi" },
];
