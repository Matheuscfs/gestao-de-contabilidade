import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database | null = null;
let _connString: Promise<string> | null = null;

/**
 * Resolve a connection string do SQLite a partir do caminho ABSOLUTO do banco,
 * que é a fonte única de verdade exposta pelo Rust (comando `db_path`) — o mesmo
 * arquivo que o runner de migrações usa.
 *
 * Por que absoluto: o plugin-sql resolve caminhos relativos contra
 * `app_config_dir()`, enquanto o lado Rust (migrações) usa `app_data_dir()`.
 * No macOS/Windows esses diretórios coincidem, mas no Linux divergem
 * (`~/.config` vs `~/.local/share`) — o que abriria DOIS bancos diferentes.
 * Passar o caminho absoluto faz o plugin ignorar o diretório-base e abrir
 * exatamente o mesmo arquivo em todas as plataformas.
 */
async function resolverConnString(): Promise<string> {
  const abs = await invoke<string>("db_path");
  // SQLite/sqlx aceitam barras normais inclusive no Windows (C:/Users/...).
  return `sqlite:${abs.replace(/\\/g, "/")}`;
}

/**
 * Retorna a instância singleton do cliente Drizzle conectado ao SQLite local.
 * Caminho do arquivo (mesmo nos dois lados, via `db_path`):
 *   macOS   → ~/Library/Application Support/app.quibo/quibo.db
 *   Linux   → ~/.local/share/app.quibo/quibo.db
 *   Windows → %APPDATA%\app.quibo\quibo.db
 */
export async function getDb() {
  if (_db) return _db;

  if (!_connString) _connString = resolverConnString();
  const sqlite = await Database.load(await _connString);
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
