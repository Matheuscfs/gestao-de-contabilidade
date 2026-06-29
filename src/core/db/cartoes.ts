import type { CreditCard } from "./schema";
import { getSqlite } from "./client";

// Conexão raw compartilhada (mesmo arquivo/caminho absoluto do client.ts),
// garantindo consistência cross-platform.
async function db() {
  return getSqlite();
}

// ─── Linha raw do banco (snake_case) ─────────────────────────────────────────

type CartaoRow = {
  id: string;
  name: string;
  brand: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  color: string;
  is_active: number;
  persona_id: string | null;
  source: string;
  pluggy_id: string | null;
  pluggy_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapearLinha(r: CartaoRow): CreditCard {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    limitCents: r.limit_cents,
    closingDay: r.closing_day,
    dueDay: r.due_day,
    color: r.color,
    isActive: r.is_active,
    personaId: r.persona_id ?? null,
    source: r.source,
    pluggyId: r.pluggy_id ?? null,
    pluggySyncedAt: r.pluggy_synced_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarCartoes(): Promise<CreditCard[]> {
  const conn = await db();
  const rows = await conn.select<CartaoRow[]>(
    "SELECT * FROM credit_cards ORDER BY created_at DESC"
  );
  return rows.map(mapearLinha);
}

export async function criarCartao(dados: {
  name: string;
  brand: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
  isActive: number;
  source: string;
}): Promise<void> {
  const conn = await db();
  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  await conn.execute(
    `INSERT INTO credit_cards
       (id, name, brand, limit_cents, closing_day, due_day, color, is_active, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      dados.name,
      dados.brand,
      dados.limitCents,
      dados.closingDay,
      dados.dueDay,
      dados.color,
      dados.isActive,
      dados.source,
      agora,
      agora,
    ]
  );
}

export async function atualizarCartao(
  id: string,
  dados: Partial<{
    name: string;
    brand: string;
    limitCents: number;
    closingDay: number;
    dueDay: number;
    color: string;
    isActive: number;
    source: string;
  }>
): Promise<void> {
  const conn = await db();
  const agora = new Date().toISOString();

  const colMap: Record<string, string> = {
    name: "name",
    brand: "brand",
    limitCents: "limit_cents",
    closingDay: "closing_day",
    dueDay: "due_day",
    color: "color",
    isActive: "is_active",
    source: "source",
  };

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [campo, coluna] of Object.entries(colMap)) {
    if (campo in dados) {
      params.push((dados as Record<string, unknown>)[campo]);
      sets.push(`${coluna} = $${params.length}`);
    }
  }

  if (sets.length === 0) return;

  params.push(agora);
  sets.push(`updated_at = $${params.length}`);

  params.push(id);
  await conn.execute(
    `UPDATE credit_cards SET ${sets.join(", ")} WHERE id = $${params.length}`,
    params
  );
}

export async function deletarCartao(id: string): Promise<void> {
  const conn = await db();
  await conn.execute("DELETE FROM credit_cards WHERE id = $1", [id]);
}

/**
 * Soma, em centavos, o total lançado nos cartões de crédito na competência
 * informada — a "fatura deste mês". Considera despesas (`EXPENSE`), faturas
 * (`INVOICE`) e parcelas de dívida (`DEBT_INSTALLMENT`) vinculadas a algum
 * cartão. Retorna 0 quando ainda não há lançamentos.
 */
export async function faturaDoMes(mes: number, ano: number): Promise<number> {
  const conn = await db();
  const rows = await conn.select<{ total: number | null }[]>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM transactions
      WHERE credit_card_id IS NOT NULL
        AND type IN ('EXPENSE', 'INVOICE', 'DEBT_INSTALLMENT')
        AND month = $1
        AND year = $2`,
    [mes, ano]
  );
  return rows[0]?.total ?? 0;
}
