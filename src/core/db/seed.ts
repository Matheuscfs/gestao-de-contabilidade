import { v4 as uuidv4 } from "uuid";
import { getDb } from "./client";
import {
  accounts,
  categories,
  personas,
  schemaMigrations,
} from "./schema";
import { agora } from "@/utils/dates";

const SCHEMA_VERSION = 1;

/**
 * Inicializa o banco: aplica migrações pendentes e semeie dados iniciais
 * se o banco estiver vazio. Chamado uma vez na inicialização do app.
 */
export async function inicializarBanco() {
  const db = await getDb();
  await aplicarMigracoes(db);
  await semeiarSeVazio(db);
}

async function aplicarMigracoes(db: Awaited<ReturnType<typeof getDb>>) {
  const migracoes = await db.select().from(schemaMigrations);
  const versaoAtual = migracoes.at(-1)?.version ?? 0;

  if (versaoAtual >= SCHEMA_VERSION) return;

  // Migrações aplicadas em ordem; cada uma é idempotente
  // As SQLs estão embarcadas em drizzle/ e aplicadas pelo plugin Tauri
  // Esta função registra apenas a versão após a aplicação externa

  const ts = new Date().toISOString();
  await db
    .insert(schemaMigrations)
    .values({ version: SCHEMA_VERSION, appliedAt: ts })
    .onConflictDoNothing();
}

async function semeiarSeVazio(db: Awaited<ReturnType<typeof getDb>>) {
  const contaExistente = await db.select().from(accounts).limit(1);
  if (contaExistente.length > 0) return;

  const ts = agora();
  const personaId = uuidv4();
  const contaId = uuidv4();

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
    id: contaId,
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

  const categoriasSeed: Array<{
    id: string;
    name: string;
    type: "INCOME" | "EXPENSE";
    icon: string;
    parentId: null;
    archived: 0;
    createdAt: string;
    updatedAt: string;
    color: string;
  }> = [
    { id: uuidv4(), name: "Salário", type: "INCOME", icon: "briefcase", color: "#12A06B", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Freelance", type: "INCOME", icon: "laptop", color: "#12A06B", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Moradia", type: "EXPENSE", icon: "home", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Mercado", type: "EXPENSE", icon: "shopping-cart", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Transporte", type: "EXPENSE", icon: "car", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Saúde", type: "EXPENSE", icon: "heart", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Lazer", type: "EXPENSE", icon: "smile", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Educação", type: "EXPENSE", icon: "book", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Assinaturas", type: "EXPENSE", icon: "repeat", color: "#4078E6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
    { id: uuidv4(), name: "Outros", type: "EXPENSE", icon: "dots", color: "#8C95A6", parentId: null, archived: 0, createdAt: ts, updatedAt: ts },
  ];

  await db.insert(categories).values(categoriasSeed);
}
