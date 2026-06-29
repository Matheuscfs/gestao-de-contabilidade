/**
 * Constantes do domínio de dívidas.
 *
 * Os valores de `SubTipoDivida` devem corresponder ao CHECK constraint da
 * migração: CHECK(dbt_sub_type IN ('INSTALLMENT','LOAN','PENDING','FLEXIBLE')).
 */

export type SubTipoDivida = "LOAN" | "INSTALLMENT" | "PENDING" | "FLEXIBLE";

export const SUBTIPOS_DIVIDA: { id: SubTipoDivida; label: string }[] = [
  { id: "LOAN", label: "Empréstimo" },
  { id: "INSTALLMENT", label: "Parcelamento" },
  { id: "PENDING", label: "Em aberto" },
  { id: "FLEXIBLE", label: "Outro" },
];

export function labelSubtipoDivida(sub: string | null): string {
  return SUBTIPOS_DIVIDA.find((s) => s.id === sub)?.label ?? "Outro";
}
