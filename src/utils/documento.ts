/**
 * Utilitários de documentos brasileiros (CPF/CNPJ).
 *
 * Convenção: o banco guarda só os dígitos; a formatação é feita na exibição.
 */

/** Remove tudo que não for dígito. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Formata 14 dígitos como 00.000.000/0000-00. Valores parciais são formatados até onde dá. */
export function formatarCNPJ(cnpj: string): string {
  const d = apenasDigitos(cnpj).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Formata 11 dígitos como 000.000.000-00. Valores parciais são formatados até onde dá. */
export function formatarCPF(cpf: string): string {
  const d = apenasDigitos(cpf).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Valida os dígitos verificadores de um CNPJ (aceita com ou sem máscara). */
export function validarCNPJ(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calcularDV = (base: string): number => {
    // Pesos do CNPJ: 5,4,3,2,9,8,7,6,5,4,3,2 (12 dígitos) ou com 6 à frente (13)
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base
      .split("")
      .reduce((acc, dig, i) => acc + parseInt(dig, 10) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcularDV(d.slice(0, 12));
  if (dv1 !== parseInt(d[12], 10)) return false;
  const dv2 = calcularDV(d.slice(0, 13));
  return dv2 === parseInt(d[13], 10);
}

/** Valida os dígitos verificadores de um CPF (aceita com ou sem máscara). */
export function validarCPF(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calcularDV = (base: string): number => {
    const soma = base
      .split("")
      .reduce(
        (acc, dig, i) => acc + parseInt(dig, 10) * (base.length + 1 - i),
        0
      );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const dv1 = calcularDV(d.slice(0, 9));
  if (dv1 !== parseInt(d[9], 10)) return false;
  const dv2 = calcularDV(d.slice(0, 10));
  return dv2 === parseInt(d[10], 10);
}
