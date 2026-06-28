use crate::errors::AppError;
use crate::secrets as keychain;

/// Grava um segredo no keychain do sistema operacional.
/// A UI nunca recebe o valor — só o status.
#[tauri::command]
pub async fn secret_set(service: String, value: String) -> Result<(), AppError> {
    keychain::set(&service, &value)
}

/// Retorna se um segredo está configurado (true/false).
/// O valor nunca sai do core Rust.
#[tauri::command]
pub async fn secret_get_status(service: String) -> Result<bool, AppError> {
    keychain::exists(&service)
}

/// Remove um segredo do keychain.
#[tauri::command]
pub async fn secret_delete(service: String) -> Result<(), AppError> {
    keychain::delete(&service)
}
