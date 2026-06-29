import { eq, desc } from "drizzle-orm";
import { getDb } from "./client";
import { creditCards, type CreditCard, type NewCreditCard } from "./schema";

export async function listarCartoes(): Promise<CreditCard[]> {
  const db = await getDb();
  return db.select().from(creditCards).orderBy(desc(creditCards.createdAt));
}

export async function criarCartao(
  dados: Omit<NewCreditCard, "id" | "createdAt" | "updatedAt">
): Promise<CreditCard> {
  const db = await getDb();
  const agora = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(creditCards).values({ ...dados, id, createdAt: agora, updatedAt: agora });
  const [cartao] = await db
    .select()
    .from(creditCards)
    .where(eq(creditCards.id, id))
    .limit(1);
  return cartao;
}

export async function atualizarCartao(
  id: string,
  dados: Partial<Omit<NewCreditCard, "id" | "createdAt">>
): Promise<void> {
  const db = await getDb();
  await db
    .update(creditCards)
    .set({ ...dados, updatedAt: new Date().toISOString() })
    .where(eq(creditCards.id, id));
}

export async function deletarCartao(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(creditCards).where(eq(creditCards.id, id));
}
