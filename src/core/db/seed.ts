import { v4 as uuidv4 } from "uuid";
import { getDb } from "./client";
import { accounts, categories, personas } from "./schema";
import { agora } from "@/utils/dates";

/**
 * Semeia os dados iniciais do app quando o banco está vazio.
 *
 * As migrações de schema são responsabilidade do lado Rust
 * (`src-tauri/src/db/mod.rs`, bloqueante no setup). Aqui só populamos os
 * registros-base que a UI precisa para funcionar de cara: uma persona, uma
 * conta e o conjunto de categorias.
 *
 * Cada bloco é idempotente (só insere se a tabela correspondente estiver
 * vazia), então uma execução parcial anterior se auto-corrige no próximo boot.
 * Chamado uma vez na inicialização do app (`main.tsx`).
 */
export async function semearSeNecessario(): Promise<void> {
  const db = await getDb();
  await semearBaseSeVazio(db);
  await semearCategoriasSeVazio(db);
}

async function semearBaseSeVazio(
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  const contaExistente = await db.select().from(accounts).limit(1);
  if (contaExistente.length > 0) return;

  const ts = agora();
  const personaId = uuidv4();

  await db.insert(personas).values({
    id: personaId,
    name: "Pessoal",
    description: "Finanças pessoais",
    color: "#4078E6",
    icon: "user",
    archived: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(accounts).values({
    id: uuidv4(),
    name: "Conta corrente",
    type: "CHECKING",
    balanceCents: 0,
    initialBalanceCents: 0,
    color: "#4078E6",
    icon: "building-bank",
    isActive: 1,
    isPrimary: 1,
    archived: 0,
    personaId,
    createdAt: ts,
    updatedAt: ts,
  });
}

async function semearCategoriasSeVazio(
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  const categoriaExistente = await db.select().from(categories).limit(1);
  if (categoriaExistente.length > 0) return;

  const ts = agora();

  const base: Array<{
    name: string;
    type: "INCOME" | "EXPENSE";
    icon: string;
    color: string;
  }> = [
    { name: "Salário", type: "INCOME", icon: "briefcase", color: "#12A06B" },
    { name: "Freelance", type: "INCOME", icon: "laptop", color: "#12A06B" },
    { name: "Moradia", type: "EXPENSE", icon: "home", color: "#4078E6" },
    { name: "Mercado", type: "EXPENSE", icon: "shopping-cart", color: "#4078E6" },
    { name: "Transporte", type: "EXPENSE", icon: "car", color: "#4078E6" },
    { name: "Saúde", type: "EXPENSE", icon: "heart", color: "#4078E6" },
    { name: "Lazer", type: "EXPENSE", icon: "smile", color: "#4078E6" },
    { name: "Educação", type: "EXPENSE", icon: "book", color: "#4078E6" },
    { name: "Assinaturas", type: "EXPENSE", icon: "repeat", color: "#4078E6" },
    { name: "Outros", type: "EXPENSE", icon: "dots", color: "#8C95A6" },
  ];

  await db.insert(categories).values(
    base.map((c) => ({
      id: uuidv4(),
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
      parentId: null,
      archived: 0,
      createdAt: ts,
      updatedAt: ts,
    }))
  );
}
