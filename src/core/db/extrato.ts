import { getSqlite } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// O "extrato" é a lista de TODOS os movimentos reais (transactions com
// is_template = 0), enriquecidos com os nomes/cores das fontes vinculadas:
// conta, cartão, categoria e persona. Modelos recorrentes (is_template = 1)
// são definições, não movimentos, então ficam de fora.
// ─────────────────────────────────────────────────────────────────────────────

export type MovimentoExtrato = {
  id: string;
  type: string;
  status: string;
  description: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  paidCents: number | null;
  date: string | null;
  month: number | null;
  year: number | null;
  notes: string | null;
  tags: string | null;
  incomeModality: string | null;
  source: string;
  pluggyId: string | null;
  pluggySyncedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Vínculos
  accountId: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountType: string | null;
  accountBank: string | null;

  cardId: string | null;
  cardName: string | null;
  cardBrand: string | null;
  cardColor: string | null;

  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;

  personaId: string | null;
  personaName: string | null;
  personaColor: string | null;
  personaAvatar: string | null;
};

type ExtratoRow = {
  id: string;
  type: string;
  status: string;
  description: string;
  amount_cents: number | null;
  due_date: string | null;
  paid_at: string | null;
  paid_cents: number | null;
  date: string | null;
  month: number | null;
  year: number | null;
  notes: string | null;
  tags: string | null;
  income_modality: string | null;
  source: string;
  pluggy_id: string | null;
  pluggy_synced_at: string | null;
  created_at: string;
  updated_at: string;

  account_id: string | null;
  account_name: string | null;
  account_color: string | null;
  account_type: string | null;
  account_bank: string | null;

  credit_card_id: string | null;
  card_name: string | null;
  card_brand: string | null;
  card_color: string | null;

  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;

  persona_id: string | null;
  persona_name: string | null;
  persona_color: string | null;
  persona_avatar: string | null;
};

function mapearLinha(r: ExtratoRow): MovimentoExtrato {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    description: r.description,
    amountCents: r.amount_cents ?? 0,
    dueDate: r.due_date ?? null,
    paidAt: r.paid_at ?? null,
    paidCents: r.paid_cents ?? null,
    date: r.date ?? null,
    month: r.month ?? null,
    year: r.year ?? null,
    notes: r.notes ?? null,
    tags: r.tags ?? null,
    incomeModality: r.income_modality ?? null,
    source: r.source,
    pluggyId: r.pluggy_id ?? null,
    pluggySyncedAt: r.pluggy_synced_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,

    accountId: r.account_id ?? null,
    accountName: r.account_name ?? null,
    accountColor: r.account_color ?? null,
    accountType: r.account_type ?? null,
    accountBank: r.account_bank ?? null,

    cardId: r.credit_card_id ?? null,
    cardName: r.card_name ?? null,
    cardBrand: r.card_brand ?? null,
    cardColor: r.card_color ?? null,

    categoryId: r.category_id ?? null,
    categoryName: r.category_name ?? null,
    categoryColor: r.category_color ?? null,
    categoryIcon: r.category_icon ?? null,

    personaId: r.persona_id ?? null,
    personaName: r.persona_name ?? null,
    personaColor: r.persona_color ?? null,
    personaAvatar: r.persona_avatar ?? null,
  };
}

// ─── Query ──────────────────────────────────────────────────────────────────

/** Representa um registro pronto para cópia: o JSON cru da Pluggy + a linha local. */
export type RegistroCompleto = {
  /** Objeto exatamente como salvo em `transactions.raw` (ou null se manual). */
  pluggy: unknown | null;
  /** Todos os campos da linha em `transactions`, exceto `raw`. */
  quibo: Record<string, unknown>;
};

/**
 * Lê a linha completa de uma transação (todos os campos da tabela) e separa o
 * payload cru da Pluggy guardado em `raw`. Usado para copiar `{ pluggy, quibo }`.
 */
export async function obterRegistroCompleto(id: string): Promise<RegistroCompleto> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<Record<string, unknown>[]>(
    `SELECT * FROM transactions WHERE id = $1 LIMIT 1`,
    [id]
  );
  const row = rows[0] ?? {};

  let pluggy: unknown | null = null;
  const raw = row.raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      pluggy = JSON.parse(raw);
    } catch {
      pluggy = raw; // se não for JSON válido, devolve a string crua
    }
  }

  const quibo: Record<string, unknown> = { ...row };
  delete quibo.raw;

  return { pluggy, quibo };
}

/**
 * Lista todos os movimentos reais (não-modelo), do mais recente para o mais
 * antigo, com os dados de conta, cartão, categoria e persona já resolvidos.
 * A filtragem fina é feita no cliente para uma UX instantânea.
 */
export async function listarExtrato(): Promise<MovimentoExtrato[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<ExtratoRow[]>(
    `SELECT
        t.id, t.type, t.status, t.description, t.amount_cents,
        t.due_date, t.paid_at, t.paid_cents,
        t.date, t.month, t.year,
        t.notes, t.tags, t.income_modality, t.source,
        t.pluggy_id, t.pluggy_synced_at, t.created_at, t.updated_at,
        t.account_id,     a.name  AS account_name,  a.color AS account_color,
                          a.type  AS account_type,  a.bank  AS account_bank,
        t.credit_card_id, cc.name AS card_name,     cc.brand AS card_brand,
                          cc.color AS card_color,
        t.category_id,    c.name  AS category_name, c.color AS category_color,
                          c.icon  AS category_icon,
        t.persona_id,     p.name  AS persona_name,  p.color AS persona_color,
                          p.avatar AS persona_avatar
       FROM transactions t
       LEFT JOIN accounts     a  ON a.id  = t.account_id
       LEFT JOIN credit_cards cc ON cc.id = t.credit_card_id
       LEFT JOIN categories   c  ON c.id  = t.category_id
       LEFT JOIN personas     p  ON p.id  = t.persona_id
      WHERE t.is_template = 0
      ORDER BY COALESCE(t.date, t.due_date, t.created_at) DESC, t.created_at DESC`
  );
  return rows.map(mapearLinha);
}
