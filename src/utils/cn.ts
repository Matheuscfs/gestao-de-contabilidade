/**
 * Concatena classes condicionais ignorando valores falsy.
 *
 * @example
 * cn("px-4", ativo && "bg-brand", erro ? "text-negative" : "text-ink")
 */
export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}
