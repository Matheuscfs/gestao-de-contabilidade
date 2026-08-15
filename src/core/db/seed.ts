import { v4 as uuidv4 } from "uuid";
import { getDb } from "./client";
import { accounts, categories, personas } from "./schema";
import { agora } from "@/utils/dates";

/** Conjunto de categorias padrão de um app de finanças pessoais (BR). */
export const CATEGORIAS_PADRAO: Array<{
  name: string;
  type: "INCOME" | "EXPENSE";
  icon: string;
  color: string;
}> = [
  // ── Receitas (6) ────────────────────────────────────────────────────────────
  { name: "Salário", type: "INCOME", icon: "briefcase", color: "#12A06B" },
  { name: "Renda extra", type: "INCOME", icon: "laptop", color: "#0EA5A0" },
  { name: "Investimentos", type: "INCOME", icon: "trending-up", color: "#16A34A" },
  { name: "Vendas", type: "INCOME", icon: "tag", color: "#65A30D" },
  { name: "Reembolsos", type: "INCOME", icon: "rotate-ccw", color: "#0D9488" },
  { name: "Presentes", type: "INCOME", icon: "gift", color: "#22C55E" },

  // ── Despesas (16) ───────────────────────────────────────────────────────────
  { name: "Moradia", type: "EXPENSE", icon: "home", color: "#4078E6" },
  { name: "Mercado", type: "EXPENSE", icon: "shopping-cart", color: "#E8A020" },
  { name: "Alimentação", type: "EXPENSE", icon: "utensils", color: "#E0533D" },
  { name: "Transporte", type: "EXPENSE", icon: "car", color: "#7C3AED" },
  { name: "Combustível", type: "EXPENSE", icon: "fuel", color: "#DB6E1E" },
  { name: "Saúde", type: "EXPENSE", icon: "heart", color: "#D74A45" },
  { name: "Educação", type: "EXPENSE", icon: "book", color: "#2563EB" },
  { name: "Lazer", type: "EXPENSE", icon: "smile", color: "#EC4899" },
  { name: "Assinaturas", type: "EXPENSE", icon: "repeat", color: "#8B5CF6" },
  { name: "Contas", type: "EXPENSE", icon: "receipt", color: "#0891B2" },
  { name: "Telefone & Internet", type: "EXPENSE", icon: "smartphone", color: "#0EA5E9" },
  { name: "Vestuário", type: "EXPENSE", icon: "shirt", color: "#DB2777" },
  { name: "Pets", type: "EXPENSE", icon: "paw", color: "#CA8A04" },
  { name: "Beleza & Cuidados", type: "EXPENSE", icon: "scissors", color: "#E11D8F" },
  { name: "Impostos & Taxas", type: "EXPENSE", icon: "landmark", color: "#64748B" },
  // Destino das transações que a Pluggy classifica em "Loans and financing"
  // (financiamento imobiliário/veicular, crédito estudantil, empréstimos).
  { name: "Empréstimos & Financiamentos", type: "EXPENSE", icon: "landmark", color: "#9333EA" },
  // PIX/TED/boleto para terceiros vindos do Open Finance: é dinheiro que saiu
  // de fato, mas sem finalidade declarada. Transferência entre contas do próprio
  // usuário não vem para cá — aquela vira type='TRANSFER' e não conta como gasto.
  { name: "Transferências", type: "EXPENSE", icon: "rotate-ccw", color: "#0891B2" },
  { name: "Outros", type: "EXPENSE", icon: "dots", color: "#8C95A6" },
];

/**
 * Semeia os dados iniciais do app.
 *
 * As migrações de schema são responsabilidade do lado Rust
 * (`src-tauri/src/db/mod.rs`, bloqueante no setup). Aqui só populamos os
 * registros-base que a UI precisa para funcionar de cara: uma persona, uma
 * conta e as categorias padrão.
 *
 * Idempotente e não-destrutivo: a base só é criada se não houver conta, e as
 * categorias padrão são inseridas por **nome** apenas quando ainda não existem
 * — nunca apaga nem sobrescreve categorias do usuário. Chamado uma vez na
 * inicialização (`main.tsx`).
 */
export async function semearSeNecessario(): Promise<void> {
  const db = await getDb();
  await semearBaseSeVazio(db);
  await semearCategoriasFaltantes(db);
}

async function semearBaseSeVazio(
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  const contaExistente = await db.select().from(accounts).limit(1);
  if (contaExistente.length > 0) return;

  const ts = agora();
  const personaId = uuidv4();

  // Persona principal (o dono do app). É criada provisoriamente como "Você" e
  // recebe nome/foto reais no onboarding (via sincronizarPersonaPrincipal).
  await db.insert(personas).values({
    id: personaId,
    name: "Você",
    description: "você · suas finanças pessoais",
    color: "#4078E6",
    icon: "user",
    isSelf: 1,
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

async function semearCategoriasFaltantes(
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  const existentes = await db.select({ name: categories.name }).from(categories);
  const nomes = new Set(existentes.map((c) => c.name));

  const faltantes = CATEGORIAS_PADRAO.filter((c) => !nomes.has(c.name));
  if (faltantes.length === 0) return;

  const ts = agora();
  await db.insert(categories).values(
    faltantes.map((c) => ({
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
