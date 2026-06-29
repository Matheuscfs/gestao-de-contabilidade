import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Persona = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  archived: boolean;
  createdAt: string;
};

/** Persona acrescida dos totais de movimentação atribuídos a ela. */
export type PersonaComTotais = Persona & {
  receitasCents: number;
  despesasCents: number;
};

export type NovaPersona = {
  name: string;
  description: string | null;
  color: string;
  icon: string;
};

type PersonaRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  archived: number;
  created_at: string;
  receitas: number | null;
  despesas: number | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lista as personas com os totais de receitas/despesas atribuídas — somando
 * apenas lançamentos efetivos (ocorrências, `is_template = 0`), não os templates
 * de configuração.
 */
export async function listarPersonas(): Promise<PersonaComTotais[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<PersonaRow[]>(
    `SELECT
       p.id, p.name, p.description, p.color, p.icon, p.archived, p.created_at,
       COALESCE(SUM(CASE WHEN t.type IN ('INCOME','SALARY')
                         THEN t.amount_cents ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN t.type IN ('EXPENSE','LIVING_COST','DEBT_INSTALLMENT','INVOICE')
                         THEN t.amount_cents ELSE 0 END), 0) AS despesas
     FROM personas p
     LEFT JOIN transactions t
       ON t.persona_id = p.id AND t.is_template = 0
     GROUP BY p.id
     ORDER BY p.created_at ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    color: r.color,
    icon: r.icon,
    archived: r.archived === 1,
    createdAt: r.created_at,
    receitasCents: r.receitas ?? 0,
    despesasCents: r.despesas ?? 0,
  }));
}

export async function criarPersona(dados: NovaPersona): Promise<void> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO personas
       (id, name, description, color, icon, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, dados.name.trim(), dados.description?.trim() || null, dados.color, dados.icon, ts, ts]
  );
}

export async function editarPersona(id: string, dados: NovaPersona): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE personas
     SET name = ?, description = ?, color = ?, icon = ?, updated_at = ?
     WHERE id = ?`,
    [dados.name.trim(), dados.description?.trim() || null, dados.color, dados.icon, agora(), id]
  );
}

/**
 * Exclui a persona. As referências em `transactions`/`accounts` usam
 * `ON DELETE SET NULL`, então os lançamentos e contas não são removidos —
 * apenas deixam de estar vinculados a ela.
 */
export async function excluirPersona(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM personas WHERE id = ?`, [id]);
}
