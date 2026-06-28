use tauri::Manager;
use tauri_plugin_shell::ShellExt;

use crate::errors::AppError;

/// Retorna o caminho do arquivo do banco SQLite no sistema do usuário.
#[tauri::command]
pub async fn db_path(app: tauri::AppHandle) -> Result<String, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(data_dir.join("quibo.db").to_string_lossy().to_string())
}

/// Abre uma URL no navegador padrão do sistema.
#[tauri::command]
pub async fn open_external(url: String, app: tauri::AppHandle) -> Result<(), AppError> {
    app.shell()
        .open(&url, None)
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// Retorna a versão do app.
#[tauri::command]
pub async fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}
