import { getDb, getSqlite } from "./client";
import { categories } from "./schema";
import type { Category } from "./schema";
import { eq, and } from "drizzle-orm";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// Uma "receita" é uma fonte de renda, modelada como template de transação:
//   type = 'INCOME', is_template = 1
//   is_recurring = 1 → entra todo mês (recorrente) · 0 → pontual
//   notes         → "de quem" (pagador), texto livre opcional
//   category_id   → categoria de receita (INCOME), opcional
// ─────────────────────────────────────────────────────────────────────────────

export type Receita = {
  id: string;
  description: string;
  amountCents: number;
  isRecurring: boolean;
  pagador: string | null;
  categoryId: string | null;
  createdAt: string;
};

export type NovaReceita = {
  description: string;
  amountCents: number;
  isRecurring: boolean;
  pagador: string | null;
  categoryId: string | null;
};

type ReceitaRow = {
  id: string;
  description: string;
  amount_cents: number | null;
  is_recurring: number;
  notes: string | null;
  category_id: string | null;
  created_at: string;
};

function mapearLinha(r: ReceitaRow): Receita {
  return {
    id: r.id,
    description: r.description,
    amountCents: r.amount_cents ?? 0,
    isRecurring: r.is_recurring === 1,
    pagador: r.notes ?? null,
    categoryId: r.category_id ?? null,
    createdAt: r.created_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarReceitas(): Promise<Receita[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<ReceitaRow[]>(
    `SELECT id, description, amount_cents, is_recurring, notes, category_id, created_at
     FROM transactions
     WHERE type = 'INCOME' AND is_template = 1
     ORDER BY created_at DESC`
  );
  return rows.map(mapearLinha);
}

export async function criarReceita(dados: NovaReceita): Promise<void> {
  const sqlite = await getSqlite();
  const id = `inc_${crypto.randomUUID()}`;
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO transactions
       (id, type, status, description, amount_cents, is_template, is_recurring,
        notes, category_id, source, created_at, updated_at)
     VALUES (?, 'INCOME', 'ATIVO', ?, ?, 1, ?, ?, ?, 'MANUAL', ?, ?)`,
    [
      id,
      dados.description.trim(),
      dados.amountCents,
      dados.isRecurring ? 1 : 0,
      dados.pagador?.trim() || null,
      dados.categoryId,
      ts,
      ts,
    ]
  );
}

export async function editarReceita(id: string, dados: NovaReceita): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE transactions
     SET description = ?, amount_cents = ?, is_recurring = ?,
         notes = ?, category_id = ?, updated_at = ?
     WHERE id = ?`,
    [
      dados.description.trim(),
      dados.amountCents,
      dados.isRecurring ? 1 : 0,
      dados.pagador?.trim() || null,
      dados.categoryId,
      agora(),
      id,
    ]
  );
}

export async function excluirReceita(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function listarCategoriasReceita(): Promise<Category[]> {
  const db = await getDb();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.type, "INCOME"), eq(categories.archived, 0)));
}
