import { getSqlite } from "./client";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoConta = "CHECKING" | "SAVINGS" | "INVESTMENT" | "CASH" | "OTHER";

export type Conta = {
  id: string;
  name: string;
  type: TipoConta;
  color: string;
  icon: string;
  isPrimary: boolean;
  isActive: boolean;
  balanceCents: number;
  source: string;
  createdAt: string;
};

export type NovaConta = {
  name: string;
  type: TipoConta;
  color: string;
  icon: string;
  isPrimary: boolean;
  balanceCents: number;
};

type ContaRow = {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  is_primary: number;
  is_active: number;
  balance_cents: number;
  source: string;
  created_at: string;
};

function mapearLinha(r: ContaRow): Conta {
  return {
    id: r.id,
    name: r.name,
    type: r.type as TipoConta,
    color: r.color,
    icon: r.icon,
    isPrimary: r.is_primary === 1,
    isActive: r.is_active === 1,
    balanceCents: r.balance_cents,
    source: r.source,
    createdAt: r.created_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarContas(): Promise<Conta[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<ContaRow[]>(
    `SELECT id, name, type, color, icon, is_primary, is_active, balance_cents, source, created_at
     FROM accounts
     WHERE archived = 0
     ORDER BY is_primary DESC, created_at ASC`
  );
  return rows.map(mapearLinha);
}

/**
 * Conta quantos registros de uma origem (`type` + `is_template` de
 * `transactions`) já estão vinculados a cada conta. Retorna `{ [accountId]: n }`.
 */
export async function contarPorConta(
  origemType: string,
  isTemplate: boolean
): Promise<Record<string, number>> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<{ account_id: string; n: number }[]>(
    `SELECT account_id, COUNT(*) AS n
       FROM transactions
      WHERE type = ? AND is_template = ? AND account_id IS NOT NULL
      GROUP BY account_id`,
    [origemType, isTemplate ? 1 : 0]
  );
  const mapa: Record<string, number> = {};
  for (const r of rows) mapa[r.account_id] = r.n;
  return mapa;
}

export async function criarConta(dados: NovaConta): Promise<void> {
  const sqlite = await getSqlite();
  const id = crypto.randomUUID();
  const ts = agora();
  // Garante uma única conta principal.
  if (dados.isPrimary) {
    await sqlite.execute(`UPDATE accounts SET is_primary = 0 WHERE is_primary = 1`);
  }
  await sqlite.execute(
    `INSERT INTO accounts
       (id, name, type, balance_cents, initial_balance_cents, color, icon,
        is_active, is_primary, archived, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'MANUAL', ?, ?)`,
    [
      id,
      dados.name.trim(),
      dados.type,
      dados.balanceCents,
      dados.balanceCents,
      dados.color,
      dados.icon,
      dados.isPrimary ? 1 : 0,
      ts,
      ts,
    ]
  );
}

export async function editarConta(id: string, dados: NovaConta): Promise<void> {
  const sqlite = await getSqlite();
  if (dados.isPrimary) {
    await sqlite.execute(
      `UPDATE accounts SET is_primary = 0 WHERE is_primary = 1 AND id != ?`,
      [id]
    );
  }
  await sqlite.execute(
    `UPDATE accounts
     SET name = ?, type = ?, color = ?, icon = ?, is_primary = ?, balance_cents = ?, updated_at = ?
     WHERE id = ?`,
    [
      dados.name.trim(),
      dados.type,
      dados.color,
      dados.icon,
      dados.isPrimary ? 1 : 0,
      dados.balanceCents,
      agora(),
      id,
    ]
  );
}

export async function excluirConta(id: string): Promise<void> {
  const sqlite = await getSqlite();
  await sqlite.execute(`DELETE FROM accounts WHERE id = ?`, [id]);
}
