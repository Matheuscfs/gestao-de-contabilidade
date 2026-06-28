pub mod ai;
pub mod commands;
pub mod db;
pub mod errors;
pub mod market;
pub mod pluggy;
pub mod secrets;

use tauri::Manager;

pub use errors::AppError;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Inicializa o banco SQLite (WAL + FK + migrações)
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::inicializar(&app_handle).await {
                    eprintln!("[quibo] Erro ao inicializar banco: {e}");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::secrets::secret_set,
            commands::secrets::secret_get_status,
            commands::secrets::secret_delete,
            commands::system::db_path,
            commands::system::open_external,
            commands::system::app_version,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Quibo");
}
