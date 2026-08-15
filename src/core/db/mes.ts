import { getSqlite } from "./client";

// ─── Resumo da competência ────────────────────────────────────────────────────
//
// O "entrou / saiu / sobra" do mês, lido direto de `transactions`.
//
// O que entra na conta:
//   entrou → INCOME, SALARY
//   saiu   → EXPENSE, LIVING_COST, DEBT_INSTALLMENT
//
// O que fica DE FORA e por quê:
//   • is_template = 1 — são as regras cadastradas (o salário, o custo fixo),
//     não o dinheiro que de fato circulou no mês.
//   • INVOICE com source = 'PLUGGY' — a fatura gerada pelo sync é exatamente a
//     SOMA dos EXPENSE daquele cartão na competência. Somar as duas contaria o
//     mesmo dinheiro duas vezes, então o gasto do cartão entra só pelos EXPENSE.
//     Já a fatura lançada à mão (source = 'MANUAL') CONTA: nesse caso não há
//     EXPENSE individuais por trás dela, e ignorá-la esconderia o gasto.
//   • TRANSFER — dinheiro trocando de bolso, não entrada nem saída.
//   • INVESTMENT — aplicação é patrimônio, tem tela própria.
//   • Status não confirmado (PREVISTO/CANCELADO/…) — ainda não é fato.
//
// Competência: `month`/`year` mandam; quando estão em branco, caímos para o
// mês/ano de `date` ou `due_date`.
// ─────────────────────────────────────────────────────────────────────────────

export type ResumoMes = {
  /** Total que entrou na competência, em centavos. */
  entrouCents: number;
  /** Total que saiu na competência, em centavos. */
  saiuCents: number;
  /** Sobra do mês (entrou − saiu), em centavos. Pode ser negativa. */
  saldoCents: number;
  /** Quantas transações confirmadas sustentam esses números. */
  total: number;
};

type ResumoRow = {
  entrou: number | null;
  saiu: number | null;
  total: number | null;
};

/** Statuses que representam dinheiro que de fato circulou. */
const STATUS_CONFIRMADOS = "('CONFIRMADO', 'PAGO')";

export async function resumoDoMes(mes: number, ano: number): Promise<ResumoMes> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<ResumoRow[]>(
    `SELECT
        COALESCE(SUM(CASE WHEN t.type IN ('INCOME', 'SALARY')
                          THEN t.amount_cents ELSE 0 END), 0) AS entrou,
        COALESCE(SUM(CASE WHEN t.type IN ('EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
                            OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
                          THEN t.amount_cents ELSE 0 END), 0) AS saiu,
        COUNT(*) AS total
       FROM transactions t
      WHERE t.is_template = 0
        AND t.status IN ${STATUS_CONFIRMADOS}
        AND (
              t.type IN ('INCOME', 'SALARY', 'EXPENSE', 'LIVING_COST', 'DEBT_INSTALLMENT')
              OR (t.type = 'INVOICE' AND t.source <> 'PLUGGY')
            )
        AND COALESCE(
              t.month,
              CAST(strftime('%m', COALESCE(t.date, t.due_date)) AS INTEGER)
            ) = ?
        AND COALESCE(
              t.year,
              CAST(strftime('%Y', COALESCE(t.date, t.due_date)) AS INTEGER)
            ) = ?`,
    // ATENÇÃO: os parâmetros são ligados pela ORDEM DE APARIÇÃO no SQL, não
    // pelo número. Em SQLite, `$1` é um parâmetro *nomeado* (nome "1") que
    // recebe o próximo índice livre conforme aparece no texto — escrever
    // `= $2` antes de `= $1` faz o primeiro receber `mes` e comparar ano com
    // mês, zerando o resultado. Por isso usamos `?`: aqui a ordem é explícita.
    [mes, ano]
  );

  const r = rows[0];
  const entrouCents = r?.entrou ?? 0;
  const saiuCents = r?.saiu ?? 0;
  return {
    entrouCents,
    saiuCents,
    saldoCents: entrouCents - saiuCents,
    total: r?.total ?? 0,
  };
}
