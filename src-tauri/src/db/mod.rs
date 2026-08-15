use rusqlite::Connection;
use tauri::Manager;

use crate::errors::AppError;

/// Caminho do banco conforme plataforma.
pub fn caminho_banco(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| AppError::Internal(format!("Não foi possível criar diretório de dados: {e}")))?;

    Ok(data_dir.join("quibo.db"))
}

/// Inicializa o banco SQLite:
/// - Ativa WAL (concorrência leitura/escrita)
/// - Ativa foreign keys
/// - Aplica migrações pendentes
pub async fn inicializar(app: &tauri::AppHandle) -> Result<(), AppError> {
    let caminho = caminho_banco(app)?;
    migrar(&caminho)?;
    println!("[quibo] Banco iniciado em: {}", caminho.display());
    Ok(())
}

/// Abre o banco no caminho indicado, ativa os PRAGMAs essenciais e aplica as
/// migrações pendentes. Reutilizável fora do Tauri (ex.: binário `migrate`).
pub fn migrar(caminho: &std::path::Path) -> Result<(), AppError> {
    if let Some(dir) = caminho.parent() {
        std::fs::create_dir_all(dir).map_err(|e| {
            AppError::Internal(format!("Não foi possível criar diretório de dados: {e}"))
        })?;
    }

    let conn = Connection::open(caminho)?;

    // Configurações essenciais
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
    ",
    )?;

    aplicar_migracoes(&conn)?;
    Ok(())
}

/// Aplica as migrações SQL embarcadas em ordem sequencial.
fn aplicar_migracoes(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    let versao_atual: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let migracoes: &[(&str, i64)] = &[
        (include_str!("../../migrations/0001_init.sql"), 1),
        (include_str!("../../migrations/0002_add_settings.sql"), 2),
        (include_str!("../../migrations/0003_add_persona_avatar.sql"), 3),
        (include_str!("../../migrations/0004_add_persona_self.sql"), 4),
        (include_str!("../../migrations/0005_add_income_modality.sql"), 5),
        (include_str!("../../migrations/0006_add_raw_json.sql"), 6),
        (include_str!("../../migrations/0007_add_pluggy_tx_status.sql"), 7),
        (include_str!("../../migrations/0008_contabil_base.sql"), 8),
        (include_str!("../../migrations/0009_obrigacoes.sql"), 9),
        (include_str!("../../migrations/0010_receitas_empresa.sql"), 10),
        (include_str!("../../migrations/0011_processos.sql"), 11),
    ];

    for (sql, versao) in migracoes {
        if *versao <= versao_atual {
            continue;
        }

        let ts = chrono::Utc::now().to_rfc3339();
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![versao, ts],
        )?;

        println!("[quibo] Migração {versao} aplicada");
    }

    Ok(())
}
