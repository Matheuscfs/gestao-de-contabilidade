/**
 * Ano-calendário das tabelas fiscais do app.
 *
 * Existe por causa de um bug real: `clt.ts` (INSS/IRRF) e `tributos.ts`
 * (Simples, pró-labore, Presumido) declaravam cada um o seu próprio ano de
 * referência, e `tributos.ts` importa o cálculo de IRRF de `clt.ts`. Quando as
 * tabelas de 2026 entraram só em `tributos.ts`, o pró-labore passou a ser
 * calculado com a tabela de 2025 sem que nada acusasse.
 *
 * Agora o ano mora aqui e os dois importam daqui. Trocar de ano é um lugar só,
 * e `clt.test.ts` trava valores conhecidos das tabelas para que a constante não
 * avance sem os números irem junto.
 */

export const ANO_FISCAL = "2026";
