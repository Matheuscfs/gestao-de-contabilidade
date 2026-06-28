use chrono::{DateTime, Duration, Utc};
use tokio::sync::Mutex;

use crate::errors::AppError;
use crate::secrets;

use super::models::CredenciaisPluggy;

const PLUGGY_SERVICE: &str = "pluggy";
const PLUGGY_API: &str = "https://api.pluggy.ai";
/// Margem de segurança: invalida o cache 15min antes do vencimento real (~2h).
const MARGEM_EXPIRACAO_MINS: i64 = 15;
/// API Key dura 2h na Pluggy; o cache é conservador (1h45m).
const DURACAO_CACHE_MINS: i64 = 120 - MARGEM_EXPIRACAO_MINS;

// ─── Cache de API Key ─────────────────────────────────────────────────────────

struct CacheApiKey {
    chave: String,
    expira_em: DateTime<Utc>,
}

impl CacheApiKey {
    fn valida(&self) -> bool {
        Utc::now() < self.expira_em
    }
}

/// Estado global da autenticação Pluggy, mantido em memória via Tauri State.
pub struct EstadoAuth {
    cache: Mutex<Option<CacheApiKey>>,
}

impl EstadoAuth {
    pub fn novo() -> Self {
        Self { cache: Mutex::new(None) }
    }

    /// Retorna uma API Key válida, usando o cache quando possível.
    /// Se o cache estiver vazio ou expirado, gera uma nova chave.
    pub async fn api_key(&self) -> Result<String, AppError> {
        let mut guard = self.cache.lock().await;

        if let Some(cached) = guard.as_ref() {
            if cached.valida() {
                return Ok(cached.chave.clone());
            }
        }

        let chave = gerar_api_key_remota().await?;
        *guard = Some(CacheApiKey {
            chave: chave.clone(),
            expira_em: Utc::now() + Duration::minutes(DURACAO_CACHE_MINS),
        });

        Ok(chave)
    }

    /// Invalida o cache imediatamente (chamado após receber 401).
    pub async fn invalidar_cache(&self) {
        *self.cache.lock().await = None;
    }

    /// Tenta a chamada `f`. Se receber 401, invalida o cache e retenta uma vez.
    pub async fn com_retry<F, Fut, T>(&self, f: F) -> Result<T, AppError>
    where
        F: Fn(String) -> Fut,
        Fut: std::future::Future<Output = Result<T, AppError>>,
    {
        let chave = self.api_key().await?;
        match f(chave).await {
            Err(AppError::Integration(ref msg)) if msg.contains("401") => {
                self.invalidar_cache().await;
                let chave_nova = self.api_key().await?;
                f(chave_nova).await
            }
            outro => outro,
        }
    }
}

// ─── Chamada remota ───────────────────────────────────────────────────────────

async fn gerar_api_key_remota() -> Result<String, AppError> {
    let credenciais = ler_credenciais()?;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{PLUGGY_API}/auth"))
        .json(&serde_json::json!({
            "clientId":     credenciais.client_id,
            "clientSecret": credenciais.client_secret,
        }))
        .send()
        .await
        .map_err(|e| AppError::Integration(format!("Falha ao contatar Pluggy /auth: {e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let corpo = resp.text().await.unwrap_or_default();
        return Err(AppError::Integration(format!(
            "Pluggy /auth retornou {status}: {corpo}"
        )));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Integration(format!("Resposta de /auth inválida: {e}")))?;

    json["apiKey"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| AppError::Integration("Campo 'apiKey' ausente na resposta".into()))
}

// ─── Credenciais ──────────────────────────────────────────────────────────────

pub fn salvar_credenciais(client_id: &str, client_secret: &str) -> Result<(), AppError> {
    let payload = serde_json::to_string(&CredenciaisPluggy {
        client_id: client_id.into(),
        client_secret: client_secret.into(),
    })
    .map_err(|e| AppError::Internal(e.to_string()))?;

    secrets::set(PLUGGY_SERVICE, &payload)
}

pub fn ler_credenciais() -> Result<CredenciaisPluggy, AppError> {
    let json = secrets::get(PLUGGY_SERVICE)?;
    serde_json::from_str(&json)
        .map_err(|_| AppError::Secret("Credenciais Pluggy malformadas no keychain".into()))
}

pub fn credenciais_existem() -> Result<bool, AppError> {
    secrets::exists(PLUGGY_SERVICE)
}

pub fn remover_credenciais() -> Result<(), AppError> {
    secrets::delete(PLUGGY_SERVICE)
}

/// Gera um Connect Token de uso limitado (~30min) para autorizar leitura do MeuPluggy.
/// `redirect_uri`: se fornecido, MeuPluggy redireciona para essa URI após conectar o banco,
/// passando `?itemId=<id>` como query param (usado no fluxo OAuth local).
pub async fn gerar_connect_token(
    estado: &EstadoAuth,
    client_user_id: Option<&str>,
    redirect_uri: Option<&str>,
) -> Result<String, AppError> {
    estado
        .com_retry(|api_key| {
            let client_user_id = client_user_id;
            let redirect_uri = redirect_uri;
            async move {
                let client = reqwest::Client::new();
                let mut body = serde_json::json!({});
                if let Some(uid) = client_user_id {
                    body["clientUserId"] = serde_json::Value::String(uid.into());
                }
                if let Some(uri) = redirect_uri {
                    body["options"] = serde_json::json!({ "redirectUri": uri });
                }

                let resp = client
                    .post(format!("{PLUGGY_API}/connect_token"))
                    .header("X-API-KEY", &api_key)
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("Falha ao gerar connect_token: {e}")))?;

                let status = resp.status().as_u16();
                if status == 401 {
                    return Err(AppError::Integration("401".into()));
                }
                if !resp.status().is_success() {
                    let corpo = resp.text().await.unwrap_or_default();
                    return Err(AppError::Integration(format!(
                        "connect_token retornou {status}: {corpo}"
                    )));
                }

                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| AppError::Integration(e.to_string()))?;

                json["accessToken"]
                    .as_str()
                    .map(String::from)
                    .ok_or_else(|| AppError::Integration("Campo 'accessToken' ausente".into()))
            }
        })
        .await
}
