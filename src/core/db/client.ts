import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Retorna a instância singleton do cliente Drizzle conectado ao SQLite local.
 * O banco fica em: ~/Library/Application Support/app.quibo/quibo.db (macOS)
 */
export async function getDb() {
  if (_db) return _db;

  const sqlite = await Database.load("sqlite:quibo.db");

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

export type Db = Awaited<ReturnType<typeof getDb>>;
