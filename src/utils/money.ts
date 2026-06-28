/**
 * Utilitários para valores monetários.
 *
 * Regra fundamental: todo valor monetário é armazenado como inteiro de centavos.
 * Ponto flutuante nunca representa dinheiro (AD-3).
 */

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formata centavos para exibição em BRL. Ex.: 184700 → "R$ 1.847,00" */
export function formatarBRL(centavos: number): string {
  return BRL_FORMATTER.format(centavos / 100);
}

/** Formata centavos sem decimais. Ex.: 184700 → "R$ 1.847" */
export function formatarBRLCompacto(centavos: number): string {
  return BRL_COMPACT_FORMATTER.format(centavos / 100);
}

/** Converte string "1.847,00" ou "1847.00" para centavos inteiros. */
export function parsearBRL(valor: string): number {
  const limpo = valor
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const float = parseFloat(limpo);
  if (isNaN(float)) return 0;
  return Math.round(float * 100);
}

/** Converte reais (float) para centavos inteiros de forma segura. */
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos inteiros para reais (só para exibição). */
export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}

/** Soma um array de valores em centavos sem risco de float. */
export function somarCentavos(valores: number[]): number {
  return valores.reduce((soma, v) => soma + v, 0);
}

/** Calcula porcentagem: quanto `parte` representa de `total` (0–100). */
export function porcentagem(parte: number, total: number): number {
  if (total === 0) return 0;
  return (parte / total) * 100;
}
