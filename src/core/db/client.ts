import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database | null = null;

/**
 * Retorna a instância singleton do cliente Drizzle conectado ao SQLite local.
 * O banco fica em: ~/Library/Application Support/app.quibo/quibo.db (macOS)
 */
export async function getDb() {
  if (_db) return _db;

  const sqlite = await Database.load("sqlite:quibo.db");
  _sqlite = sqlite;

  _db = drizzle(
    async (sql, params, method) => {
      try {
        if (method === "run") {
          await sqlite.execute(sql, params);
          return { rows: [] };
        }
        const rows = await sqlite.select<Record<string, unknown>[]>(
          sql,
          params
        );
        return { rows: rows.map(Object.values) };
      } catch (error) {
        throw new Error(
          `Erro no banco de dados: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { schema }
  );

  return _db;
}

/**
 * Retorna a instância raw do plugin-sql para operações que precisam de SQL direto.
 * Garante que o banco foi inicializado antes de retornar.
 */
export async function getSqlite(): Promise<Database> {
  if (_sqlite) return _sqlite;
  await getDb();
  return _sqlite!;
}

export type Db = Awaited<ReturnType<typeof getDb>>;
