use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Erro de banco de dados: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Erro de segredo: {0}")]
    Secret(String),

    #[error("Erro de integração: {0}")]
    Integration(String),

    #[error("Não encontrado: {0}")]
    NotFound(String),

    #[error("Erro interno: {0}")]
    Internal(String),
}

// Serializa erros para a UI via IPC
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
