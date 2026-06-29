use serde::{Deserialize, Serialize};

use crate::errors::AppError;

/// Provedores de IA suportados (BYOK — bring your own key).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Provider {
    Anthropic,
    OpenAI,
    Google,
    OpenRouter,
}

impl Provider {
    /// Converte o identificador vindo da UI ("ANTHROPIC", "OPENAI", …).
    pub fn from_str(s: &str) -> Result<Self, AppError> {
        match s.to_uppercase().as_str() {
            "ANTHROPIC" => Ok(Provider::Anthropic),
            "OPENAI" => Ok(Provider::OpenAI),
            "GOOGLE" => Ok(Provider::Google),
            "OPENROUTER" => Ok(Provider::OpenRouter),
            outro => Err(AppError::Integration(format!("Provedor desconhecido: {outro}"))),
        }
    }
}

/// Um modelo disponível para o provedor + chave informados.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModeloDisponivel {
    /// Identificador técnico usado nas chamadas (ex.: "claude-sonnet-4-5").
    pub id: String,
    /// Rótulo amigável para exibição (ex.: "Claude Sonnet 4.5").
    pub label: String,
}

fn http() -> reqwest::Client {
    reqwest::Client::new()
}

/// Mensagem de erro amigável para falhas de autenticação.
fn erro_status(status: reqwest::StatusCode, corpo: &str) -> AppError {
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        AppError::Integration("Chave inválida ou sem permissão. Confira e tente de novo.".into())
    } else {
        AppError::Integration(format!(
            "O provedor respondeu {status}. {}",
            corpo.chars().take(160).collect::<String>()
        ))
    }
}

/// Verifica a chave chamando o endpoint de modelos e retorna a lista disponível.
/// Um 200 confirma que a chave é válida; qualquer outro status vira erro amigável.
pub async fn listar_modelos(
    provider: Provider,
    api_key: &str,
) -> Result<Vec<ModeloDisponivel>, AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::Integration("Cole a chave antes de verificar.".into()));
    }

    match provider {
        Provider::Anthropic => listar_anthropic(api_key).await,
        Provider::OpenAI => listar_openai(api_key).await,
        Provider::Google => listar_google(api_key).await,
        Provider::OpenRouter => listar_openrouter(api_key).await,
    }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async fn listar_anthropic(api_key: &str) -> Result<Vec<ModeloDisponivel>, AppError> {
    #[derive(Deserialize)]
    struct Resp {
        data: Vec<Modelo>,
    }
    #[derive(Deserialize)]
    struct Modelo {
        id: String,
        display_name: Option<String>,
    }

    let resp = http()
        .get("https://api.anthropic.com/v1/models?limit=100")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| AppError::Integration(format!("Falha ao contatar a Anthropic: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(status, &corpo));
    }

    let parsed: Resp = resp
        .json()
        .await
        .map_err(|e| AppError::Integration(format!("Resposta inesperada da Anthropic: {e}")))?;

    Ok(parsed
        .data
        .into_iter()
        .map(|m| ModeloDisponivel {
            label: m.display_name.unwrap_or_else(|| m.id.clone()),
            id: m.id,
        })
        .collect())
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async fn listar_openai(api_key: &str) -> Result<Vec<ModeloDisponivel>, AppError> {
    #[derive(Deserialize)]
    struct Resp {
        data: Vec<Modelo>,
    }
    #[derive(Deserialize)]
    struct Modelo {
        id: String,
    }

    let resp = http()
        .get("https://api.openai.com/v1/models")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| AppError::Integration(format!("Falha ao contatar a OpenAI: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(status, &corpo));
    }

    let parsed: Resp = resp
        .json()
        .await
        .map_err(|e| AppError::Integration(format!("Resposta inesperada da OpenAI: {e}")))?;

    // Mantém apenas modelos de chat/raciocínio; ignora embeddings, tts, whisper, etc.
    let mut modelos: Vec<ModeloDisponivel> = parsed
        .data
        .into_iter()
        .filter(|m| {
            let id = m.id.to_lowercase();
            (id.starts_with("gpt")
                || id.starts_with("o1")
                || id.starts_with("o3")
                || id.starts_with("o4")
                || id.starts_with("chatgpt"))
                && !id.contains("audio")
                && !id.contains("realtime")
                && !id.contains("transcribe")
                && !id.contains("tts")
                && !id.contains("image")
                && !id.contains("embedding")
        })
        .map(|m| ModeloDisponivel {
            label: m.id.clone(),
            id: m.id,
        })
        .collect();
    modelos.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(modelos)
}

// ─── Google Gemini ──────────────────────────────────────────────────────────--

async fn listar_google(api_key: &str) -> Result<Vec<ModeloDisponivel>, AppError> {
    #[derive(Deserialize)]
    struct Resp {
        models: Vec<Modelo>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Modelo {
        name: String,
        display_name: Option<String>,
        #[serde(default)]
        supported_generation_methods: Vec<String>,
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=200"
    );
    let resp = http()
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Integration(format!("Falha ao contatar o Google: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(status, &corpo));
    }

    let parsed: Resp = resp
        .json()
        .await
        .map_err(|e| AppError::Integration(format!("Resposta inesperada do Google: {e}")))?;

    Ok(parsed
        .models
        .into_iter()
        .filter(|m| {
            m.supported_generation_methods
                .iter()
                .any(|met| met == "generateContent")
        })
        .map(|m| {
            let id = m.name.strip_prefix("models/").unwrap_or(&m.name).to_string();
            ModeloDisponivel {
                label: m.display_name.unwrap_or_else(|| id.clone()),
                id,
            }
        })
        .collect())
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

async fn listar_openrouter(api_key: &str) -> Result<Vec<ModeloDisponivel>, AppError> {
    #[derive(Deserialize)]
    struct Resp {
        data: Vec<Modelo>,
    }
    #[derive(Deserialize)]
    struct Modelo {
        id: String,
        name: Option<String>,
    }

    let resp = http()
        .get("https://openrouter.ai/api/v1/models")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| AppError::Integration(format!("Falha ao contatar o OpenRouter: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(status, &corpo));
    }

    let parsed: Resp = resp
        .json()
        .await
        .map_err(|e| AppError::Integration(format!("Resposta inesperada do OpenRouter: {e}")))?;

    let mut modelos: Vec<ModeloDisponivel> = parsed
        .data
        .into_iter()
        .map(|m| ModeloDisponivel {
            label: m.name.unwrap_or_else(|| m.id.clone()),
            id: m.id,
        })
        .collect();
    modelos.sort_by(|a, b| a.label.to_lowercase().cmp(&b.label.to_lowercase()));
    Ok(modelos)
}
