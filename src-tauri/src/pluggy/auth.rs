use crate::errors::AppError;
use crate::secrets;

const PLUGGY_SERVICE: &str = "pluggy";

/// Obtém uma API Key da Pluggy usando CLIENT_ID/SECRET do keychain.
/// A API Key fica em memória (~2h de validade).
pub async fn obter_api_key() -> Result<String, AppError> {
    let credenciais_json = secrets::get(PLUGGY_SERVICE)?;
    let credenciais: PluggyCredentials = serde_json::from_str(&credenciais_json)
        .map_err(|_| AppError::Secret("Credenciais Pluggy malformadas".into()))?;

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.pluggy.ai/auth")
        .json(&serde_json::json!({
            "clientId": credenciais.client_id,
            "clientSecret": credenciais.client_secret,
        }))
        .send()
        .await
        .map_err(|e| AppError::Integration(e.to_string()))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| AppError::Integration(e.to_string()))?;

    resp["apiKey"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| AppError::Integration("API Key não encontrada na resposta".into()))
}

#[derive(serde::Deserialize)]
struct PluggyCredentials {
    client_id: String,
    client_secret: String,
}
