//! Motor de inferência — envia a conversa ao provedor escolhido e devolve o texto.
//!
//! A chave chega por parâmetro, é usada na chamada e some. Ela NUNCA é impressa,
//! logada ou anexada a mensagem de erro.
//!
//! Todos os quatro provedores declarados no schema estão implementados:
//!   ANTHROPIC  → POST /v1/messages           (formato próprio)
//!   OPENAI     → POST /v1/chat/completions
//!   GOOGLE     → POST /v1beta/models/{m}:generateContent
//!   OPENROUTER → POST /api/v1/chat/completions (compatível com OpenAI)

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::errors::AppError;

use super::providers::Provider;

/// Uma fala da conversa. `papel` é "user" ou "assistant".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MensagemChat {
    pub papel: String,
    pub texto: String,
}

impl MensagemChat {
    /// Normaliza o papel: qualquer coisa que não seja "assistant" vira "user".
    fn papel_normalizado(&self) -> &'static str {
        if self.papel.eq_ignore_ascii_case("assistant") {
            "assistant"
        } else {
            "user"
        }
    }
}

/// Teto de tokens da resposta. Modelos do Google gastam parte do orçamento
/// pensando, então recebem uma folga maior para não devolverem texto vazio.
const MAX_TOKENS: u32 = 2000;
const MAX_TOKENS_GOOGLE: u32 = 4000;

fn http() -> reqwest::Client {
    reqwest::Client::new()
}

fn nome_provedor(p: Provider) -> &'static str {
    match p {
        Provider::Anthropic => "Anthropic",
        Provider::OpenAI => "OpenAI",
        Provider::Google => "Google",
        Provider::OpenRouter => "OpenRouter",
    }
}

/// Traduz falhas de rede em português, sem vazar a chave.
fn erro_rede(provedor: &str, e: reqwest::Error) -> AppError {
    if e.is_timeout() {
        AppError::Integration(format!(
            "A {provedor} demorou demais para responder. Tente de novo."
        ))
    } else if e.is_connect() {
        AppError::Integration(format!(
            "Não foi possível falar com a {provedor}. Verifique sua conexão com a internet."
        ))
    } else {
        AppError::Integration(format!("Falha ao contatar a {provedor}."))
    }
}

/// Traduz o status HTTP do provedor em mensagem acionável em português.
fn erro_status(provedor: &str, status: reqwest::StatusCode, corpo: &str) -> AppError {
    let msg = match status.as_u16() {
        401 | 403 => format!(
            "A chave da {provedor} foi recusada. Confira em Perfil → Integrações → IA."
        ),
        402 => format!(
            "Sua conta na {provedor} está sem crédito. Recarregue e tente de novo."
        ),
        404 => format!(
            "O modelo selecionado não existe mais na {provedor}. Escolha outro em Perfil → Integrações → IA."
        ),
        413 => format!("A conversa ficou grande demais para o modelo da {provedor}."),
        429 => format!(
            "Limite de uso da {provedor} atingido (ou sem crédito). Aguarde um pouco e tente de novo."
        ),
        500..=599 => format!("A {provedor} está fora do ar no momento. Tente de novo em instantes."),
        _ => format!(
            "A {provedor} respondeu {status}. {}",
            detalhe_do_corpo(corpo)
        ),
    };
    AppError::Integration(msg)
}

/// Extrai a mensagem de erro do corpo JSON (quando houver), truncada.
fn detalhe_do_corpo(corpo: &str) -> String {
    let texto = serde_json::from_str::<Value>(corpo)
        .ok()
        .and_then(|v| {
            v.pointer("/error/message")
                .or_else(|| v.pointer("/message"))
                .and_then(|m| m.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| corpo.to_string());
    texto.chars().take(200).collect()
}

fn erro_resposta_vazia(provedor: &str) -> AppError {
    AppError::Integration(format!(
        "A {provedor} devolveu uma resposta vazia. Tente reformular a pergunta."
    ))
}

// ─── Entrada pública ──────────────────────────────────────────────────────────

/// Envia `sistema` + `mensagens` ao provedor e devolve o texto da resposta.
pub async fn conversar(
    provider: Provider,
    api_key: &str,
    modelo: &str,
    sistema: &str,
    mensagens: &[MensagemChat],
) -> Result<String, AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::Integration(
            "Nenhuma chave de IA configurada. Vá em Perfil → Integrações → IA.".into(),
        ));
    }
    if modelo.trim().is_empty() {
        return Err(AppError::Integration(
            "Nenhum modelo selecionado. Escolha um em Perfil → Integrações → IA.".into(),
        ));
    }
    if mensagens.is_empty() {
        return Err(AppError::Integration("Nenhuma pergunta para enviar.".into()));
    }

    match provider {
        Provider::Anthropic => conversar_anthropic(api_key, modelo, sistema, mensagens).await,
        Provider::OpenAI => {
            conversar_openai_compat(
                "https://api.openai.com/v1/chat/completions",
                "OpenAI",
                api_key,
                modelo,
                sistema,
                mensagens,
                // A família o-series/gpt-5 rejeita `max_tokens`; `max_completion_tokens`
                // é o campo atual e vale para todos os modelos de chat.
                "max_completion_tokens",
            )
            .await
        }
        Provider::OpenRouter => {
            conversar_openai_compat(
                "https://openrouter.ai/api/v1/chat/completions",
                "OpenRouter",
                api_key,
                modelo,
                sistema,
                mensagens,
                "max_tokens",
            )
            .await
        }
        Provider::Google => conversar_google(api_key, modelo, sistema, mensagens).await,
    }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async fn conversar_anthropic(
    api_key: &str,
    modelo: &str,
    sistema: &str,
    mensagens: &[MensagemChat],
) -> Result<String, AppError> {
    let provedor = nome_provedor(Provider::Anthropic);

    let msgs: Vec<Value> = mensagens
        .iter()
        .map(|m| json!({ "role": m.papel_normalizado(), "content": m.texto }))
        .collect();

    let corpo = json!({
        "model": modelo,
        "max_tokens": MAX_TOKENS,
        "system": sistema,
        "messages": msgs,
    });

    let resp = http()
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&corpo)
        .send()
        .await
        .map_err(|e| erro_rede(provedor, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(provedor, status, &corpo));
    }

    let json: Value = resp
        .json()
        .await
        .map_err(|_| AppError::Integration(format!("Resposta inesperada da {provedor}.")))?;

    // Classificadores de segurança podem recusar: vem 200 com stop_reason "refusal".
    if json.get("stop_reason").and_then(|s| s.as_str()) == Some("refusal") {
        return Err(AppError::Integration(
            "O modelo recusou responder a essa pergunta. Tente reformular.".into(),
        ));
    }

    // `content` é uma lista de blocos; só os de texto interessam.
    let texto = json
        .get("content")
        .and_then(|c| c.as_array())
        .map(|blocos| {
            blocos
                .iter()
                .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    let texto = texto.trim().to_string();
    if texto.is_empty() {
        return Err(erro_resposta_vazia(provedor));
    }
    Ok(texto)
}

// ─── OpenAI / OpenRouter (mesmo formato) ──────────────────────────────────────

#[allow(clippy::too_many_arguments)]
async fn conversar_openai_compat(
    url: &str,
    provedor: &str,
    api_key: &str,
    modelo: &str,
    sistema: &str,
    mensagens: &[MensagemChat],
    campo_limite: &str,
) -> Result<String, AppError> {
    let mut msgs: Vec<Value> = vec![json!({ "role": "system", "content": sistema })];
    msgs.extend(
        mensagens
            .iter()
            .map(|m| json!({ "role": m.papel_normalizado(), "content": m.texto })),
    );

    let mut corpo = json!({ "model": modelo, "messages": msgs });
    corpo[campo_limite] = json!(MAX_TOKENS);

    let mut req = http().post(url).bearer_auth(api_key).json(&corpo);
    if provedor == "OpenRouter" {
        // O OpenRouter usa esses cabeçalhos só para atribuição do app.
        req = req
            .header("HTTP-Referer", "https://quibo.app")
            .header("X-Title", "Gestão de Contabilidade");
    }

    let resp = req.send().await.map_err(|e| erro_rede(provedor, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(provedor, status, &corpo));
    }

    let json: Value = resp
        .json()
        .await
        .map_err(|_| AppError::Integration(format!("Resposta inesperada da {provedor}.")))?;

    // O OpenRouter entrega erros de upstream com HTTP 200 e um campo `error`.
    if let Some(msg) = json.pointer("/error/message").and_then(|m| m.as_str()) {
        return Err(AppError::Integration(format!(
            "A {provedor} recusou o pedido. {}",
            msg.chars().take(200).collect::<String>()
        )));
    }

    let texto = json
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .unwrap_or_default()
        .trim()
        .to_string();

    if texto.is_empty() {
        return Err(erro_resposta_vazia(provedor));
    }
    Ok(texto)
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async fn conversar_google(
    api_key: &str,
    modelo: &str,
    sistema: &str,
    mensagens: &[MensagemChat],
) -> Result<String, AppError> {
    let provedor = nome_provedor(Provider::Google);

    // O id pode vir com ou sem o prefixo "models/".
    let modelo = modelo.strip_prefix("models/").unwrap_or(modelo);
    let url =
        format!("https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent");

    // No Gemini o papel do assistente chama-se "model".
    let contents: Vec<Value> = mensagens
        .iter()
        .map(|m| {
            let papel = if m.papel_normalizado() == "assistant" {
                "model"
            } else {
                "user"
            };
            json!({ "role": papel, "parts": [{ "text": m.texto }] })
        })
        .collect();

    let corpo = json!({
        "systemInstruction": { "parts": [{ "text": sistema }] },
        "contents": contents,
        "generationConfig": { "maxOutputTokens": MAX_TOKENS_GOOGLE },
    });

    // A chave vai no cabeçalho (e não na query) para não acabar em log de URL.
    let resp = http()
        .post(&url)
        .header("x-goog-api-key", api_key)
        .json(&corpo)
        .send()
        .await
        .map_err(|e| erro_rede(provedor, e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let corpo = resp.text().await.unwrap_or_default();
        return Err(erro_status(provedor, status, &corpo));
    }

    let json: Value = resp
        .json()
        .await
        .map_err(|_| AppError::Integration(format!("Resposta inesperada da {provedor}.")))?;

    let texto = json
        .pointer("/candidates/0/content/parts")
        .and_then(|p| p.as_array())
        .map(|partes| {
            partes
                .iter()
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
        .trim()
        .to_string();

    if texto.is_empty() {
        // Bloqueio por filtro de segurança vem com finishReason SAFETY.
        let motivo = json
            .pointer("/candidates/0/finishReason")
            .and_then(|f| f.as_str())
            .unwrap_or("");
        if motivo == "SAFETY" || motivo == "PROHIBITED_CONTENT" {
            return Err(AppError::Integration(
                "O modelo recusou responder a essa pergunta. Tente reformular.".into(),
            ));
        }
        return Err(erro_resposta_vazia(provedor));
    }
    Ok(texto)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn normaliza_papel_da_mensagem() {
        let user = MensagemChat {
            papel: "user".into(),
            texto: "oi".into(),
        };
        let assistente = MensagemChat {
            papel: "ASSISTANT".into(),
            texto: "olá".into(),
        };
        let estranho = MensagemChat {
            papel: "system".into(),
            texto: "x".into(),
        };
        assert_eq!(user.papel_normalizado(), "user");
        assert_eq!(assistente.papel_normalizado(), "assistant");
        assert_eq!(estranho.papel_normalizado(), "user");
    }

    #[test]
    fn extrai_mensagem_do_corpo_de_erro() {
        let corpo = r#"{"error":{"message":"invalid api key","type":"auth"}}"#;
        assert_eq!(detalhe_do_corpo(corpo), "invalid api key");
        assert_eq!(detalhe_do_corpo("texto solto"), "texto solto");
    }

    /// Mensagens de erro precisam ser acionáveis e em português — e jamais
    /// carregar a chave.
    #[test]
    fn traduz_status_http_em_portugues() {
        let e = erro_status("OpenAI", reqwest::StatusCode::UNAUTHORIZED, "");
        assert!(e.to_string().contains("recusada"), "{e}");

        let e = erro_status("Anthropic", reqwest::StatusCode::TOO_MANY_REQUESTS, "");
        assert!(e.to_string().contains("Limite de uso"), "{e}");

        let e = erro_status("Google", reqwest::StatusCode::INTERNAL_SERVER_ERROR, "");
        assert!(e.to_string().contains("fora do ar"), "{e}");
    }
}
