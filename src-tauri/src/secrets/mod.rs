use keyring::Entry;

use crate::errors::AppError;

const APP_NAME: &str = "app.quibo";

fn entrada(service: &str) -> Result<Entry, AppError> {
    Entry::new(APP_NAME, service).map_err(|e| AppError::Secret(e.to_string()))
}

/// Grava um segredo no keychain do SO.
pub fn set(service: &str, value: &str) -> Result<(), AppError> {
    entrada(service)?
        .set_password(value)
        .map_err(|e| AppError::Secret(e.to_string()))
}

/// Lê um segredo do keychain — uso interno apenas.
pub fn get(service: &str) -> Result<String, AppError> {
    entrada(service)?
        .get_password()
        .map_err(|e| AppError::Secret(format!("Segredo '{service}' não encontrado: {e}")))
}

/// Verifica se o segredo existe sem expor o valor.
pub fn exists(service: &str) -> Result<bool, AppError> {
    match entrada(service)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(AppError::Secret(e.to_string())),
    }
}

/// Remove um segredo do keychain.
pub fn delete(service: &str) -> Result<(), AppError> {
    entrada(service)?
        .delete_credential()
        .map_err(|e| AppError::Secret(e.to_string()))
}
