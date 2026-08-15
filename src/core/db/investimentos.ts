import { getSqlite } from "./client";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// Um investimento é uma linha de `transactions` com `type = 'INVESTMENT'`.
// O sync da Pluggy grava uma linha por posição da carteira, preenchendo:
//   description             → nome da posição ("Tesouro Selic 2029", "PETR4"…)
//   amount_cents            → valor APLICADO (custo de aquisição)
//   inv_current_price_cents → SALDO ATUAL da posição
//   inv_sub_type            → FIXED_INCOME | STOCK | ETF | PENSION | OTHER
//   inv_ticker / inv_quantity / inv_broker → detalhes da posição
//
// O saldo atual pode vir nulo (posição ainda não avaliada pelo provedor); nesse
// caso o valor aplicado é usado como saldo, o que zera o rendimento em vez de
// inventar lucro/prejuízo.
// ─────────────────────────────────────────────────────────────────────────────

export type Investimento = {
  id: string;
  description: string;
  /** FIXED_INCOME | STOCK | ETF | PENSION | OTHER (ou o que o provedor mandar). */
  subTipo: string | null;
  ticker: string | null;
  quantidade: number | null;
  /** Valor aplicado, em centavos. */
  aplicadoCents: number;
  /** Saldo atual da posição, em centavos. Null quando ainda não veio do sync. */
  saldoAtualCents: number | null;
  corretora: string | null;
  /** MANUAL | PLUGGY */
  source: string;
  date: string | null;
};

type InvestimentoRow = {
  id: string;
  description: string;
  inv_sub_type: string | null;
  inv_ticker: string | null;
  inv_quantity: number | null;
  amount_cents: number | null;
  inv_current_price_cents: number | null;
  inv_broker: string | null;
  source: string;
  date: string | null;
};

function mapearLinha(r: InvestimentoRow): Investimento {
  return {
    id: r.id,
    description: r.description,
    subTipo: r.inv_sub_type ?? null,
    ticker: r.inv_ticker ?? null,
    quantidade: r.inv_quantity ?? null,
    aplicadoCents: r.amount_cents ?? 0,
    saldoAtualCents: r.inv_current_price_cents ?? null,
    corretora: r.inv_broker ?? null,
    source: r.source,
    date: r.date ?? null,
  };
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

/** Saldo da posição: o preço atual, caindo para o valor aplicado quando nulo. */
export function saldoInvestimento(i: Investimento): number {
  return i.saldoAtualCents ?? i.aplicadoCents;
}

/** Rendimento acumulado da posição (saldo atual − aplicado), em centavos. */
export function rendimentoInvestimento(i: Investimento): number {
  return saldoInvestimento(i) - i.aplicadoCents;
}

/** Rentabilidade da posição em %, ou null quando não há base de cálculo. */
export function rentabilidadeInvestimento(i: Investimento): number | null {
  if (i.aplicadoCents <= 0) return null;
  return (rendimentoInvestimento(i) / i.aplicadoCents) * 100;
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Lista as posições da carteira (manuais e importadas do Open Finance), da
 * maior para a menor. Modelos recorrentes (is_template = 1) ficam de fora:
 * são regras, não posições.
 */
export async function listarInvestimentos(): Promise<Investimento[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<InvestimentoRow[]>(
    `SELECT
        t.id, t.description,
        t.inv_sub_type, t.inv_ticker, t.inv_quantity,
        t.amount_cents, t.inv_current_price_cents, t.inv_broker,
        t.source, t.date
       FROM transactions t
      WHERE t.type = 'INVESTMENT'
        AND t.is_template = 0
      ORDER BY COALESCE(t.inv_current_price_cents, t.amount_cents, 0) DESC,
               t.description ASC`
  );
  return rows.map(mapearLinha);
}
