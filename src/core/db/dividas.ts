import { v4 as uuidv4 } from "uuid";
import { getDb } from "./client";
import { transactions } from "./schema";
import { eq, and, desc } from "drizzle-orm";
import { agora } from "@/utils/dates";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Divida = {
  id: string;
  description: string;
  status: string;
  amountCents: number | null;
  dbtSubType: string | null;
  dbtTotalCents: number | null;
  dbtTotalInstallments: number | null;
  dbtRemainingInstallments: number | null;
  dbtInstallmentDay: number | null;
  dbtInterestRate: number | null;
  createdAt: string;
};

export type NovaDivida = {
  description: string;
  amountCents: number;
  dbtSubType: string;
  dbtTotalInstallments: number;
  parcelasPagas: number;
  dbtInstallmentDay: number;
  dbtInterestRate: number | null;
};

export type EdicaoDivida = NovaDivida & { status: "ATIVO" | "PAGO" };

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listarDividas(): Promise<Divida[]> {
  const db = await getDb();
  return db
    .select({
      id: transactions.id,
      description: transactions.description,
      status: transactions.status,
      amountCents: transactions.amountCents,
      dbtSubType: transactions.dbtSubType,
      dbtTotalCents: transactions.dbtTotalCents,
      dbtTotalInstallments: transactions.dbtTotalInstallments,
      dbtRemainingInstallments: transactions.dbtRemainingInstallments,
      dbtInstallmentDay: transactions.dbtInstallmentDay,
      dbtInterestRate: transactions.dbtInterestRate,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(and(eq(transactions.type, "DEBT"), eq(transactions.isTemplate, 1)))
    .orderBy(desc(transactions.createdAt));
}

export async function criarDivida(dados: NovaDivida): Promise<void> {
  const db = await getDb();
  const ts = agora();
  const remaining = Math.max(0, dados.dbtTotalInstallments - dados.parcelasPagas);

  await db.insert(transactions).values({
    id: `dbt_${uuidv4()}`,
    type: "DEBT",
    status: remaining === 0 ? "PAGO" : "ATIVO",
    description: dados.description.trim(),
    amountCents: dados.amountCents,
    isTemplate: 1,
    isRecurring: 0,
    dbtSubType: dados.dbtSubType,
    dbtTotalCents: dados.amountCents * dados.dbtTotalInstallments,
    dbtTotalInstallments: dados.dbtTotalInstallments,
    dbtRemainingInstallments: remaining,
    dbtInstallmentDay: dados.dbtInstallmentDay,
    dbtInterestRate: dados.dbtInterestRate,
    source: "MANUAL",
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function editarDivida(id: string, dados: EdicaoDivida): Promise<void> {
  const db = await getDb();
  const ts = agora();
  const remaining = Math.max(0, dados.dbtTotalInstallments - dados.parcelasPagas);
  const statusFinal = remaining === 0 ? "PAGO" : dados.status;

  await db
    .update(transactions)
    .set({
      description: dados.description.trim(),
      amountCents: dados.amountCents,
      status: statusFinal,
      dbtSubType: dados.dbtSubType,
      dbtTotalCents: dados.amountCents * dados.dbtTotalInstallments,
      dbtTotalInstallments: dados.dbtTotalInstallments,
      dbtRemainingInstallments: remaining,
      dbtInstallmentDay: dados.dbtInstallmentDay,
      dbtInterestRate: dados.dbtInterestRate,
      updatedAt: ts,
    })
    .where(eq(transactions.id, id));
}

export async function excluirDivida(id: string): Promise<void> {
  const db = await getDb();
  // Remove parcelas filhas antes da dívida-mãe
  await db.delete(transactions).where(eq(transactions.parentId, id));
  await db.delete(transactions).where(eq(transactions.id, id));
}
