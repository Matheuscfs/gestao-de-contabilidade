use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::ai::providers::{self, ModeloDisponivel, Provider};
use crate::db;

/// Chave em app_settings onde a lista de modelos disponíveis é persistida (JSON).
const CHAVE_MODELOS: &str = "ai_modelos_disponiveis";

fn abrir_conexao(app: &AppHandle) -> Result<Connection, String> {
    let caminho = db::caminho_banco(app).map_err(|e| e.to_string())?;
    Connection::open(&caminho).map_err(|e| e.to_string())
}

// ─── Verificação + listagem de modelos ────────────────────────────────────────

/// Valida a chave junto ao provedor e devolve os modelos disponíveis.
/// A chave não é gravada — só é usada para a chamada de verificação.
#[tauri::command]
pub async fn ai_verificar_chave(
    provider: String,
    api_key: String,
) -> Result<Vec<ModeloDisponivel>, String> {
    let p = Provider::from_str(&provider).map_err(|e| e.to_string())?;
    providers::listar_modelos(p, &api_key)
        .await
        .map_err(|e| e.to_string())
}

// ─── Estado atual ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiIntegracao {
    /// ANTHROPIC | OPENAI | GOOGLE | OPENROUTER
    pub provider: String,
    /// modelo selecionado para uso
    pub model: Option<String>,
    /// modelos disponíveis salvos na última verificação
    pub modelos: Vec<ModeloDisponivel>,
}

/// Retorna a integração de IA ativa (sem expor a chave), ou null.
#[tauri::command]
pub fn ai_obter_integracao(app: AppHandle) -> Result<Option<AiIntegracao>, String> {
    let conn = abrir_conexao(&app)?;

    let row = conn
        .query_row(
            "SELECT ai_provider, ai_model
               FROM integrations
              WHERE type = 'AI' AND is_active = 1
              ORDER BY updated_at DESC
              LIMIT 1",
            [],
            |r| Ok((r.get::<_, Option<String>>(0)?, r.get::<_, Option<String>>(1)?)),
        )
        .ok();

    let Some((Some(provider), model)) = row else {
        return Ok(None);
    };

    let modelos_json: Option<String> = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![CHAVE_MODELOS],
            |r| r.get(0),
        )
        .ok();

    let modelos: Vec<ModeloDisponivel> = modelos_json
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();

    Ok(Some(AiIntegracao {
        provider,
        model,
        modelos,
    }))
}

// ─── Salvar ──────────────────────────────────────────────────────────────────

/// Grava a integração de IA. Só pode existir uma — qualquer integração de IA
/// anterior é removida antes de inserir a nova. A chave fica em ai_key_ref.
#[tauri::command]
pub fn ai_salvar_integracao(
    app: AppHandle,
    provider: String,
    api_key: String,
    model: String,
    modelos: Vec<ModeloDisponivel>,
) -> Result<(), String> {
    // valida o nome do provedor antes de gravar
    Provider::from_str(&provider).map_err(|e| e.to_string())?;

    let conn = abrir_conexao(&app)?;
    let agora = Utc::now().to_rfc3339();
    let id = format!("int_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));

    // Apenas uma integração de IA: remove a anterior antes de inserir.
    conn.execute("DELETE FROM integrations WHERE type = 'AI'", [])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO integrations (
             id, type, is_active, ai_provider, ai_model, ai_key_ref,
             created_at, updated_at
         ) VALUES (?1, 'AI', 1, ?2, ?3, ?4, ?5, ?5)",
        params![id, provider.to_uppercase(), model, api_key.trim(), agora],
    )
    .map_err(|e| e.to_string())?;

    // Persiste a lista de modelos disponíveis (JSON) em app_settings.
    let modelos_json = serde_json::to_string(&modelos).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![CHAVE_MODELOS, modelos_json, agora],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Trocar apenas o modelo ─────────────────────────────────────────────────--

/// Atualiza o modelo selecionado da integração de IA ativa, sem mexer na chave.
#[tauri::command]
pub fn ai_atualizar_modelo(app: AppHandle, model: String) -> Result<(), String> {
    let conn = abrir_conexao(&app)?;
    let agora = Utc::now().to_rfc3339();
    let n = conn
        .execute(
            "UPDATE integrations SET ai_model = ?1, updated_at = ?2
              WHERE type = 'AI' AND is_active = 1",
            params![model, agora],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Nenhuma integração de IA ativa para atualizar.".into());
    }
    Ok(())
}

// ─── Remover ──────────────────────────────────────────────────────────────────

/// Remove a integração de IA e a lista de modelos guardada.
#[tauri::command]
pub fn ai_remover_integracao(app: AppHandle) -> Result<(), String> {
    let conn = abrir_conexao(&app)?;
    conn.execute("DELETE FROM integrations WHERE type = 'AI'", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM app_settings WHERE key = ?1",
        params![CHAVE_MODELOS],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
