import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoCategoria = "INCOME" | "EXPENSE";

export type Categoria = {
  id: string;
  name: string;
  type: TipoCategoria;
  color: string;
  icon: string;
  archived: boolean;
  createdAt: string;
};

/** Categoria acrescida da contagem de lançamentos que a usam. */
export type CategoriaComUso = Categoria & {
  lancamentos: number;
  usadaEsteMes: boolean;
};

export type NovaCategoria = {
  name: string;
  type: TipoCategoria;
  color: string;
  icon: string;
};

type CategoriaRow = {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  archived: number;
  created_at: string;
  lancamentos: number | null;
  usados_mes: number | null;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lista categorias não-arquivadas com a contagem de lançamentos efetivos
 * vinculados (`is_template = 0`) e se foram usadas na competência informada.
 */
export async function listarCategorias(
  mes: number,
  ano: number
): Promise<CategoriaComUso[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<CategoriaRow[]>(
    `SELECT
       c.id, c.name, c.type, c.color, c.icon, c.archived, c.created_at,
       COUNT(CASE WHEN t.is_template = 0 THEN t.id END) AS lancamentos,
       COUNT(CASE WHEN t.is_template = 0 AND t.month = ? AND t.year = ?
                  THEN t.id END) AS usados_mes
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id
     WHERE c.archived = 0
     GROUP BY c.id
     ORDER BY c.type ASC, c.name ASC`,
    [mes, ano]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: (r.type === "INCOME" ? "INCOME" : "EXPENSE") as TipoCategoria,
    color: r.color,
    icon: r.icon,
    archived: r.archived === 1,
    createdAt: r.created_at,
    lancamentos: r.lancamentos ?? 0,
    usadaEsteMes: (r.usados_mes ?? 0) > 0,
  }));
}

export async function criarCategoria(dados: NovaCategoria): Promise<void> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO categories
       (id, name, type, color, icon, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, dados.name.trim(), dados.type, dados.color, dados.icon, ts, ts]
  );
}

export async function editarCategoria(id: string, dados: NovaCategoria): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE categories
     SET name = ?, type = ?, color = ?, icon = ?, updated_at = ?
     WHERE id = ?`,
    [dados.name.trim(), dados.type, dados.color, dados.icon, agora(), id]
  );
}

/**
 * Exclui a categoria. Lançamentos que a referenciam têm `category_id` zerado
 * (`ON DELETE SET NULL`) — nenhum lançamento é removido.
 */
export async function excluirCategoria(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM categories WHERE id = ?`, [id]);
}
