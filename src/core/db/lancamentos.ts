import { getSqlite } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// "Lançamento" aqui é a OCORRÊNCIA real de uma competência (is_template = 0)
// que ainda está `PREVISTO` — ou seja, o que falta o usuário confirmar no mês.
// Modelos recorrentes (is_template = 1) são a regra cadastrada, não a ocorrência,
// e por isso nunca aparecem nesta lista.
//
// Competência: a coluna `month`/`year` é a fonte de verdade, mas linhas antigas
// (ou importadas) podem tê-la em branco — nesse caso caímos para o mês/ano de
// `date` ou `due_date`, para o lançamento não sumir do seletor de mês.
// ─────────────────────────────────────────────────────────────────────────────

export type LancamentoPendente = {
  id: string;
  type: string;
  description: string;
  amountCents: number;
  dueDate: string | null;
  date: string | null;
  month: number | null;
  year: number | null;
  /** MANUAL | PLUGGY */
  source: string;

  accountName: string | null;
  accountColor: string | null;
  cardName: string | null;
  cardColor: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

type LancamentoRow = {
  id: string;
  type: string;
  description: string;
  amount_cents: number | null;
  due_date: string | null;
  date: string | null;
  month: number | null;
  year: number | null;
  source: string;

  account_name: string | null;
  account_color: string | null;
  card_name: string | null;
  card_color: string | null;
  category_name: string | null;
  category_color: string | null;
};

function mapearLinha(r: LancamentoRow): LancamentoPendente {
  return {
    id: r.id,
    type: r.type,
    description: r.description,
    amountCents: r.amount_cents ?? 0,
    dueDate: r.due_date ?? null,
    date: r.date ?? null,
    month: r.month ?? null,
    year: r.year ?? null,
    source: r.source,

    accountName: r.account_name ?? null,
    accountColor: r.account_color ?? null,
    cardName: r.card_name ?? null,
    cardColor: r.card_color ?? null,
    categoryName: r.category_name ?? null,
    categoryColor: r.category_color ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lista os lançamentos ainda pendentes de confirmação na competência informada,
 * já com nome/cor de conta, cartão e categoria resolvidos (mesmo padrão do
 * extrato). Ordena pelo que vence primeiro.
 */
export async function listarLancamentosDoMes(
  mes: number,
  ano: number
): Promise<LancamentoPendente[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<LancamentoRow[]>(
    `SELECT
        t.id, t.type, t.description, t.amount_cents,
        t.due_date, t.date, t.month, t.year, t.source,
        a.name  AS account_name,  a.color  AS account_color,
        cc.name AS card_name,     cc.color AS card_color,
        c.name  AS category_name, c.color  AS category_color
       FROM transactions t
       LEFT JOIN accounts     a  ON a.id  = t.account_id
       LEFT JOIN credit_cards cc ON cc.id = t.credit_card_id
       LEFT JOIN categories   c  ON c.id  = t.category_id
      WHERE t.is_template = 0
        AND t.status = 'PREVISTO'
        AND COALESCE(
              t.month,
              CAST(strftime('%m', COALESCE(t.date, t.due_date)) AS INTEGER)
            ) = ?
        AND COALESCE(
              t.year,
              CAST(strftime('%Y', COALESCE(t.date, t.due_date)) AS INTEGER)
            ) = ?
      ORDER BY COALESCE(t.due_date, t.date, t.created_at) ASC, t.created_at ASC`,
    // ATENÇÃO: parâmetros são ligados pela ORDEM DE APARIÇÃO no SQL, não pelo
    // número — `$1` em SQLite é um parâmetro *nomeado*, não o índice 1. Usamos
    // `?` para que a correspondência com este array seja explícita.
    [mes, ano]
  );
  return rows.map(mapearLinha);
}

/**
 * Confirma um lançamento: muda o status para CONFIRMADO e carimba a data de
 * pagamento/atualização. Idempotente — reconfirmar só reescreve o carimbo.
 */
export async function confirmarLancamento(id: string): Promise<void> {
  const sqlite = await getSqlite();
  const ts = new Date().toISOString();
  await sqlite.execute(
    `UPDATE transactions
        SET status = 'CONFIRMADO', paid_at = $1, updated_at = $2
      WHERE id = $3`,
    [ts, ts, id]
  );
}
