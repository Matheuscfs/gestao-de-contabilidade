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
 * Soma, em centavos, o total de faturas dos cartões de crédito na competência
 * informada — a "fatura deste mês". Considera as faturas (`INVOICE`) e parcelas
 * de dívida (`DEBT_INSTALLMENT`) vinculadas a algum cartão.
 *
 * Os gastos individuais (`EXPENSE`) importados pela Pluggy NÃO entram aqui: eles
 * já são consolidados em uma `INVOICE` por competência durante o sync. Somá-los
 * junto contaria o mesmo valor duas vezes.
 */
export async function faturaDoMes(mes: number, ano: number): Promise<number> {
  const conn = await db();
  const rows = await conn.select<{ total: number | null }[]>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM transactions
      WHERE credit_card_id IS NOT NULL
        AND type IN ('INVOICE', 'DEBT_INSTALLMENT')
        AND month = $1
        AND year = $2`,
    [mes, ano]
  );
  return rows[0]?.total ?? 0;
}

// ─── Faturas por cartão ─────────────────────────────────────────────────────────
//
// A fatura de um cartão num mês é modelada como UMA transação:
//   type = 'INVOICE', status = 'CONFIRMADO', credit_card_id = <cartão>,
//   month/year = competência, amount_cents = valor digitado.
//
// O valor entra automaticamente na "fatura deste mês" (faturaDoMes) por já
// considerar transações INVOICE vinculadas a cartão.
// ─────────────────────────────────────────────────────────────────────────────

export type FaturaCartao = { id: string; amountCents: number; paga: boolean };

/** Uma fatura é considerada paga quando o status é PAGO ou há data de pagamento. */
function ehPaga(status: string | null, paidAt: string | null): boolean {
  return status === "PAGO" || paidAt != null;
}

/** Retorna a fatura registrada de um cartão na competência, ou null. */
export async function faturaDoCartao(
  cartaoId: string,
  mes: number,
  ano: number
): Promise<FaturaCartao | null> {
  const conn = await db();
  const rows = await conn.select<
    { id: string; amount_cents: number | null; status: string | null; paid_at: string | null }[]
  >(
    `SELECT id, amount_cents, status, paid_at
       FROM transactions
      WHERE credit_card_id = $1
        AND type = 'INVOICE'
        AND month = $2
        AND year = $3
      ORDER BY created_at ASC
      LIMIT 1`,
    [cartaoId, mes, ano]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    amountCents: r.amount_cents ?? 0,
    paga: ehPaga(r.status, r.paid_at),
  };
}

/** Estado de cada fatura registrada de um cartão. Chave: `${ano}-${mes}`. */
export type EstadoFatura = { amountCents: number; paga: boolean };

export async function statusFaturasCartao(
  cartaoId: string
): Promise<Record<string, EstadoFatura>> {
  const conn = await db();
  const rows = await conn.select<
    { month: number; year: number; amount_cents: number | null; status: string | null; paid_at: string | null }[]
  >(
    `SELECT month, year, amount_cents, status, paid_at
       FROM transactions
      WHERE credit_card_id = $1 AND type = 'INVOICE'`,
    [cartaoId]
  );
  const mapa: Record<string, EstadoFatura> = {};
  for (const r of rows) {
    if (r.month == null || r.year == null) continue;
    mapa[`${r.year}-${r.month}`] = {
      amountCents: r.amount_cents ?? 0,
      paga: ehPaga(r.status, r.paid_at),
    };
  }
  return mapa;
}

/** Marca/desmarca a fatura de um cartão como paga na competência informada. */
export async function marcarFaturaPaga(
  cartaoId: string,
  mes: number,
  ano: number,
  paga: boolean
): Promise<void> {
  const conn = await db();
  const ts = new Date().toISOString();
  const atual = await faturaDoCartao(cartaoId, mes, ano);
  if (!atual) return;
  await conn.execute(
    `UPDATE transactions
        SET status = $1, paid_at = $2, paid_cents = $3, updated_at = $4
      WHERE id = $5`,
    [
      paga ? "PAGO" : "CONFIRMADO",
      paga ? ts : null,
      paga ? atual.amountCents : null,
      ts,
      atual.id,
    ]
  );
}

/**
 * Cria ou atualiza a fatura de um cartão na competência informada.
 * Retorna o id da transação resultante.
 */
export async function salvarFaturaCartao(
  cartaoId: string,
  mes: number,
  ano: number,
  valorCents: number
): Promise<string> {
  const conn = await db();
  const ts = new Date().toISOString();

  // Dados do cartão para descrição e data de vencimento da fatura.
  const cartoes = await conn.select<{ name: string; due_day: number }[]>(
    "SELECT name, due_day FROM credit_cards WHERE id = $1 LIMIT 1",
    [cartaoId]
  );
  const cartao = cartoes[0];
  const nome = cartao?.name ?? "Cartão";
  const diaVenc = Math.min(Math.max(cartao?.due_day ?? 1, 1), 28);
  const dueDate = `${ano.toString().padStart(4, "0")}-${mes
    .toString()
    .padStart(2, "0")}-${diaVenc.toString().padStart(2, "0")}`;
  const descricao = `Fatura ${nome} · ${mes.toString().padStart(2, "0")}/${ano}`;

  const existente = await faturaDoCartao(cartaoId, mes, ano);
  if (existente) {
    await conn.execute(
      `UPDATE transactions
          SET amount_cents = $1, description = $2, due_date = $3, updated_at = $4
        WHERE id = $5`,
      [valorCents, descricao, dueDate, ts, existente.id]
    );
    return existente.id;
  }

  const id = `inv_${crypto.randomUUID()}`;
  await conn.execute(
    `INSERT INTO transactions
       (id, type, status, description, amount_cents, due_date, date, month, year,
        credit_card_id, is_template, is_recurring, source, created_at, updated_at)
     VALUES ($1, 'INVOICE', 'CONFIRMADO', $2, $3, $4, $5, $6, $7, $8, 0, 0, 'MANUAL', $9, $10)`,
    [id, descricao, valorCents, dueDate, dueDate, mes, ano, cartaoId, ts, ts]
  );
  return id;
}

/** Remove a fatura de um cartão na competência informada (se existir). */
export async function excluirFaturaCartao(
  cartaoId: string,
  mes: number,
  ano: number
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `DELETE FROM transactions
      WHERE credit_card_id = $1 AND type = 'INVOICE' AND month = $2 AND year = $3`,
    [cartaoId, mes, ano]
  );
}
