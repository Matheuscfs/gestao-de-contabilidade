import { getDb, getSqlite } from "./client";
import { categories } from "./schema";
import type { Category } from "./schema";
import { eq, and } from "drizzle-orm";
import { agora, diasUteisNoMes, mesAnoAtual } from "@/utils/dates";
import type { Modalidade } from "@/consts/clt";

// ─── Tipos ────────────────────────────────────────────────────────────────────
//
// Uma "receita" é uma fonte de renda, modelada como template de transação:
//   type = 'INCOME', is_template = 1, is_recurring = 1 (entra todo mês)
//
// Mapeamento de colunas:
//   description           → nome da fonte
//   notes                 → descrição (texto livre opcional)
//   account_id            → conta em que o valor cai
//   category_id           → categoria de receita (INCOME), opcional
//   sal_calculation_type  → 'FIXED' (valor fixo) | 'HOURLY' (valor por hora)
//   amount_cents          → valor mensal (digitado no fixo, calculado no por hora)
//   sal_hourly_rate_cents → valor da hora (somente por hora)
//   sal_hours_per_day     → horas trabalhadas por dia (somente por hora)
//   sal_payment_day       → dia do mês em que o valor cai na conta
//   income_modality       → 'PJ' | 'CLT' | 'OUTRO' (CLT: valor é o bruto)
//   start_date            → data de início
//   end_date              → data de finalização (null = sem data de fim)
//
// Os dias úteis NÃO são armazenados: são contados por mês específico
// (dias de semana − feriados nacionais) em `diasUteisNoMes`.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoReceita = "FIXO" | "HORA";

export type Receita = {
  id: string;
  name: string;
  descricao: string | null;
  accountId: string | null;
  categoryId: string | null;
  modalidade: Modalidade;
  tipo: TipoReceita;
  /**
   * Valor mensal de referência: digitado (fixo) ou calculado para o mês
   * corrente (por hora). Receitas por hora variam conforme os dias úteis de
   * cada mês — recalcule com `calcularValorMensal` quando precisar de outro mês.
   */
  amountCents: number;
  hourlyRateCents: number | null;
  hoursPerDay: number | null;
  paymentDay: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type NovaReceita = {
  name: string;
  descricao: string | null;
  accountId: string | null;
  categoryId: string | null;
  modalidade: Modalidade;
  tipo: TipoReceita;
  /** Valor mensal informado quando o tipo é FIXO. Ignorado no tipo HORA. */
  amountCents: number;
  hourlyRateCents: number | null;
  hoursPerDay: number | null;
  paymentDay: number | null;
  startDate: string | null;
  endDate: string | null;
};

type ReceitaRow = {
  id: string;
  description: string;
  notes: string | null;
  account_id: string | null;
  category_id: string | null;
  income_modality: string | null;
  sal_calculation_type: string | null;
  amount_cents: number | null;
  sal_hourly_rate_cents: number | null;
  sal_hours_per_day: number | null;
  sal_payment_day: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

/**
 * Valor mensal de uma receita.
 *  - FIXO: o próprio `amountCents`.
 *  - HORA: valor/hora × horas/dia × `diasUteis` do mês em questão.
 *
 * `diasUteis` deve vir de `diasUteisNoMes(mes, ano)` para o mês desejado, já que
 * cada mês tem uma quantidade diferente de dias úteis (descontando feriados).
 */
export function calcularValorMensal(
  dados: {
    tipo: TipoReceita;
    amountCents: number;
    hourlyRateCents: number | null;
    hoursPerDay: number | null;
  },
  diasUteis: number
): number {
  if (dados.tipo === "HORA") {
    const rate = dados.hourlyRateCents ?? 0;
    const horas = dados.hoursPerDay ?? 0;
    return Math.round(rate * horas * diasUteis);
  }
  return dados.amountCents;
}

function mapearLinha(r: ReceitaRow): Receita {
  const tipo: TipoReceita = r.sal_calculation_type === "HOURLY" ? "HORA" : "FIXO";
  return {
    id: r.id,
    name: r.description,
    descricao: r.notes ?? null,
    accountId: r.account_id ?? null,
    categoryId: r.category_id ?? null,
    modalidade: (r.income_modality as Modalidade) ?? "PJ",
    tipo,
    amountCents: r.amount_cents ?? 0,
    hourlyRateCents: r.sal_hourly_rate_cents ?? null,
    hoursPerDay: r.sal_hours_per_day ?? null,
    paymentDay: r.sal_payment_day ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
    createdAt: r.created_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarReceitas(): Promise<Receita[]> {
  const sqlite = await getSqlite();
  const rows = await sqlite.select<ReceitaRow[]>(
    `SELECT id, description, notes, account_id, category_id, income_modality,
            sal_calculation_type, amount_cents, sal_hourly_rate_cents,
            sal_hours_per_day, sal_payment_day,
            start_date, end_date, created_at
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
  const { mes, ano } = mesAnoAtual();
  const amountCents = calcularValorMensal(dados, diasUteisNoMes(mes, ano));
  const ehHora = dados.tipo === "HORA";
  await sqlite.execute(
    `INSERT INTO transactions
       (id, type, status, description, notes, account_id, category_id, income_modality,
        sal_calculation_type, amount_cents, sal_hourly_rate_cents,
        sal_hours_per_day, sal_payment_day,
        start_date, end_date, is_template, is_recurring, source,
        created_at, updated_at)
     VALUES (?, 'INCOME', 'ATIVO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'MANUAL', ?, ?)`,
    [
      id,
      dados.name.trim(),
      dados.descricao?.trim() || null,
      dados.accountId,
      dados.categoryId,
      dados.modalidade,
      ehHora ? "HOURLY" : "FIXED",
      amountCents,
      ehHora ? dados.hourlyRateCents : null,
      ehHora ? dados.hoursPerDay : null,
      dados.paymentDay,
      dados.startDate,
      dados.endDate,
      ts,
      ts,
    ]
  );
}

export async function editarReceita(id: string, dados: NovaReceita): Promise<void> {
  const sqlite = await getSqlite();
  const { mes, ano } = mesAnoAtual();
  const amountCents = calcularValorMensal(dados, diasUteisNoMes(mes, ano));
  const ehHora = dados.tipo === "HORA";
  await sqlite.execute(
    `UPDATE transactions
     SET description = ?, notes = ?, account_id = ?, category_id = ?, income_modality = ?,
         sal_calculation_type = ?, amount_cents = ?, sal_hourly_rate_cents = ?,
         sal_hours_per_day = ?, sal_work_days = NULL, sal_payment_day = ?,
         start_date = ?, end_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      dados.name.trim(),
      dados.descricao?.trim() || null,
      dados.accountId,
      dados.categoryId,
      dados.modalidade,
      ehHora ? "HOURLY" : "FIXED",
      amountCents,
      ehHora ? dados.hourlyRateCents : null,
      ehHora ? dados.hoursPerDay : null,
      dados.paymentDay,
      dados.startDate,
      dados.endDate,
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
