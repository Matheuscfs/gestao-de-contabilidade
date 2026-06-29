import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Persona = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  avatar: string | null;
  /** Persona principal (o dono do app): sincroniza com o perfil e não pode ser excluída. */
  isSelf: boolean;
  archived: boolean;
  createdAt: string;
};

/** Persona acrescida dos totais de movimentação e contagens de vínculos. */
export type PersonaComTotais = Persona & {
  receitasCents: number;
  despesasCents: number;
  /** Quantidade de registros vinculados, por entidade. */
  contasCount: number;
  cartoesCount: number;
  lancamentosCount: number;
};

export type NovaPersona = {
  name: string;
  description: string | null;
  color: string;
  icon: string;
  avatar: string | null;
};

type PersonaRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  avatar: string | null;
  is_self: number;
  archived: number;
  created_at: string;
  receitas: number | null;
  despesas: number | null;
  contas: number | null;
  cartoes: number | null;
  lancamentos: number | null;
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
       p.id, p.name, p.description, p.color, p.icon, p.avatar, p.is_self, p.archived, p.created_at,
       COALESCE(SUM(CASE WHEN t.type IN ('INCOME','SALARY')
                         THEN t.amount_cents ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN t.type IN ('EXPENSE','LIVING_COST','DEBT_INSTALLMENT','INVOICE')
                         THEN t.amount_cents ELSE 0 END), 0) AS despesas,
       (SELECT COUNT(*) FROM accounts a WHERE a.persona_id = p.id) AS contas,
       (SELECT COUNT(*) FROM credit_cards c WHERE c.persona_id = p.id) AS cartoes,
       (SELECT COUNT(*) FROM transactions tx
         WHERE tx.persona_id = p.id AND tx.is_template = 0) AS lancamentos
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
    avatar: r.avatar ?? null,
    isSelf: r.is_self === 1,
    archived: r.archived === 1,
    createdAt: r.created_at,
    receitasCents: r.receitas ?? 0,
    despesasCents: r.despesas ?? 0,
    contasCount: r.contas ?? 0,
    cartoesCount: r.cartoes ?? 0,
    lancamentosCount: r.lancamentos ?? 0,
  }));
}

/**
 * Conta quantos registros de uma origem (`type` + `is_template` de
 * `transactions`) já estão vinculados a cada persona. Retorna `{ [personaId]: n }`.
 */
export async function contarPorPersona(
  origemType: string,
  isTemplate: boolean
): Promise<Record<string, number>> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ persona_id: string; n: number }[]>(
    `SELECT persona_id, COUNT(*) AS n
       FROM transactions
      WHERE type = ? AND is_template = ? AND persona_id IS NOT NULL
      GROUP BY persona_id`,
    [origemType, isTemplate ? 1 : 0]
  );
  const mapa: Record<string, number> = {};
  for (const r of rows) mapa[r.persona_id] = r.n;
  return mapa;
}

export async function criarPersona(dados: NovaPersona): Promise<void> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  await sqlite.execute(
    `INSERT INTO personas
       (id, name, description, color, icon, avatar, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, dados.name.trim(), dados.description?.trim() || null, dados.color, dados.icon, dados.avatar ?? null, ts, ts]
  );
}

export async function editarPersona(id: string, dados: NovaPersona): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(
    `UPDATE personas
     SET name = ?, description = ?, color = ?, icon = ?, avatar = ?, updated_at = ?
     WHERE id = ?`,
    [dados.name.trim(), dados.description?.trim() || null, dados.color, dados.icon, dados.avatar ?? null, agora(), id]
  );
}

/**
 * Exclui a persona. As referências em `transactions`/`accounts` usam
 * `ON DELETE SET NULL`, então os lançamentos e contas não são removidos —
 * apenas deixam de estar vinculados a ela.
 *
 * A persona principal (`is_self = 1`) não pode ser excluída.
 */
export async function excluirPersona(id: string): Promise<void> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ is_self: number }[]>(
    `SELECT is_self FROM personas WHERE id = ?`,
    [id]
  );
  if (rows[0]?.is_self === 1) {
    throw new Error("A persona principal não pode ser excluída.");
  }
  await sqlite.execute(`DELETE FROM personas WHERE id = ?`, [id]);
}

/**
 * Garante que exista a persona principal (o dono do app) e mantém o nome/foto
 * dela em sincronia com o perfil. Chamada no onboarding e sempre que o nome ou
 * a foto do perfil mudam.
 *
 * - Se a persona ainda não existe e há um nome, ela é criada (`is_self = 1`).
 * - Se já existe, apenas os campos informados são atualizados.
 *
 * Campos não informados (`undefined`) são preservados; passar `avatar: null`
 * remove a foto.
 */
export async function sincronizarPersonaPrincipal(dados: {
  name?: string;
  avatar?: string | null;
}): Promise<void> {
  const sqlite = await getSqlite();
  const ts = agora();

  const rows = await sqlite.select<{ id: string }[]>(
    `SELECT id FROM personas WHERE is_self = 1 LIMIT 1`
  );
  const existente = rows[0];

  if (existente) {
    const sets: string[] = [];
    const params: (string | null)[] = [];
    if (dados.name !== undefined) {
      sets.push("name = ?");
      params.push(dados.name.trim() || "Você");
    }
    if (dados.avatar !== undefined) {
      sets.push("avatar = ?");
      params.push(dados.avatar);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    params.push(ts, existente.id);
    await sqlite.execute(
      `UPDATE personas SET ${sets.join(", ")} WHERE id = ?`,
      params
    );
    return;
  }

  // Não cria sem um nome — evita gerar uma persona vazia antes do onboarding.
  const nome = dados.name?.trim();
  if (!nome) return;

  await sqlite.execute(
    `INSERT INTO personas
       (id, name, description, color, icon, avatar, is_self, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'user', ?, 1, 0, ?, ?)`,
    [crypto.randomUUID(), nome, "você · suas finanças pessoais", "#4078E6", dados.avatar ?? null, ts, ts]
  );
}
