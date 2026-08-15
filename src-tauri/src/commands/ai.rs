use chrono::{Datelike, Local, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::ai::chat::{self, MensagemChat};
use crate::ai::contexto::{self, Permissoes};
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
    /// Permite enviar ao modelo os totais do mês e gastos por categoria.
    pub pode_ler_mes: bool,
    /// Permite enviar saldo das contas, custo de vida, dívidas e metas.
    pub pode_usar_contexto_de_vida: bool,
}

/// Retorna a integração de IA ativa (sem expor a chave), ou null.
#[tauri::command]
pub fn ai_obter_integracao(app: AppHandle) -> Result<Option<AiIntegracao>, String> {
    let conn = abrir_conexao(&app)?;

    let row = conn
        .query_row(
            "SELECT ai_provider, ai_model, ai_can_read_monthly, ai_can_use_life_context
               FROM integrations
              WHERE type = 'AI' AND is_active = 1
              ORDER BY updated_at DESC
              LIMIT 1",
            [],
            |r| {
                Ok((
                    r.get::<_, Option<String>>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, i64>(2)? != 0,
                    r.get::<_, i64>(3)? != 0,
                ))
            },
        )
        .ok();

    let Some((Some(provider), model, pode_ler_mes, pode_usar_contexto_de_vida)) = row else {
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
        pode_ler_mes,
        pode_usar_contexto_de_vida,
    }))
}

/// Atualiza o que a IA pode ler do banco local.
///
/// Os flags já existiam na tabela e já eram respeitados na montagem do contexto,
/// mas nada no app conseguia mudá-los: na prática a IA sempre recebia tudo, o
/// que contradiz a promessa de opt-in explícito do produto.
#[tauri::command]
pub fn ai_atualizar_permissoes(
    app: AppHandle,
    pode_ler_mes: bool,
    pode_usar_contexto_de_vida: bool,
) -> Result<(), String> {
    let conn = abrir_conexao(&app)?;
    let agora = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE integrations
            SET ai_can_read_monthly     = ?1,
                ai_can_use_life_context = ?2,
                updated_at              = ?3
          WHERE type = 'AI' AND is_active = 1",
        params![
            i64::from(pode_ler_mes),
            i64::from(pode_usar_contexto_de_vida),
            agora
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
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

// ─── Conversa ─────────────────────────────────────────────────────────────────

/// Resposta de uma rodada de conversa.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RespostaConversa {
    /// Texto devolvido pelo modelo.
    pub texto: String,
    /// Modelo que respondeu (para exibir na tela).
    pub modelo: String,
    /// true quando o resumo financeiro foi anexado ao pedido.
    pub contexto_incluido: bool,
}

/// Dados que precisam sair do banco ANTES de qualquer `await` — a conexão do
/// rusqlite não atravessa ponto de suspensão.
struct PreparoConversa {
    provider: Provider,
    modelo: String,
    api_key: String,
    sistema: String,
    contexto_incluido: bool,
}

/// Lê a integração ativa e monta o prompt de sistema (com o contexto autorizado).
fn preparar(app: &AppHandle, mes: i32, ano: i32) -> Result<PreparoConversa, String> {
    let conn = abrir_conexao(app)?;

    let linha = conn
        .query_row(
            "SELECT ai_provider, ai_model, ai_key_ref,
                    COALESCE(ai_can_read_monthly, 1),
                    COALESCE(ai_can_use_life_context, 1)
               FROM integrations
              WHERE type = 'AI' AND is_active = 1
              ORDER BY updated_at DESC
              LIMIT 1",
            [],
            |r| {
                Ok((
                    r.get::<_, Option<String>>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            },
        )
        .ok();

    let Some((Some(provider), Some(modelo), Some(api_key), ler_mes, contexto_vida)) = linha else {
        return Err("Nenhuma IA configurada. Vá em Perfil → Integrações → IA.".into());
    };

    let provider = Provider::from_str(&provider).map_err(|e| e.to_string())?;

    let permissoes = Permissoes {
        ler_mes: ler_mes != 0,
        usar_contexto_de_vida: contexto_vida != 0,
    };

    let resumo = contexto::montar(&conn, mes, ano, permissoes).map_err(|e| e.to_string())?;
    let contexto_incluido = resumo.is_some();
    let sistema = montar_prompt_sistema(mes, ano, resumo.as_deref());

    Ok(PreparoConversa {
        provider,
        modelo,
        api_key,
        sistema,
        contexto_incluido,
    })
}

/// Prompt de sistema. Princípio P8: a IA é a voz, não a calculadora — ela narra
/// os números que já vieram somados daqui e não inventa nenhum outro.
fn montar_prompt_sistema(mes: i32, ano: i32, resumo: Option<&str>) -> String {
    let mut p = String::from(
        "Você é o Quibo IA, o assistente financeiro do app Quibo — um app de finanças \
         pessoais local-first, em português do Brasil.\n\n\
         Como responder:\n\
         - Escreva em português do Brasil, direto ao ponto, em texto corrido curto. \
         Sem cabeçalhos nem listas longas quando uma ou duas frases bastam.\n\
         - Use SOMENTE os números do contexto abaixo. Nunca invente, estime, \
         projete ou recalcule valores — você é a voz, não a calculadora.\n\
         - Se o dado necessário não estiver no contexto, diga isso com franqueza e \
         indique em qual tela do app ele aparece (Mês, Extrato, Cartões, Dívidas, Contas).\n\
         - Não repita o contexto inteiro: cite só o que sustenta a resposta.\n\
         - Valores estão em reais (R$). \"Sobra do mês\" é entrou menos saiu.\n\
         - Não dê recomendação de investimento específica nem promessa de retorno.\n\n",
    );

    match resumo {
        Some(texto) => {
            p.push_str(&format!(
                "Contexto financeiro real do usuário (competência em foco: {mes:02}/{ano}):\n\n{texto}\n"
            ));
        }
        None => {
            p.push_str(
                "O usuário NÃO autorizou o acesso aos dados financeiros dele. Você não tem \
                 nenhum número deste app. Responda apenas com orientação geral e avise que, \
                 para análises com os dados reais, é preciso liberar as permissões em \
                 Perfil → Integrações → IA.\n",
            );
        }
    }

    p
}

/// Envia a conversa ao modelo configurado e devolve a resposta.
///
/// `mensagens` é o histórico completo da conversa (papel "user" ou "assistant").
/// `mes`/`ano` definem a competência do contexto; sem eles, usa o mês corrente.
#[tauri::command]
pub async fn ai_conversar(
    app: AppHandle,
    mensagens: Vec<MensagemChat>,
    mes: Option<i32>,
    ano: Option<i32>,
) -> Result<RespostaConversa, String> {
    // Fallback só para quando a UI não mandar a competência. Usa fuso LOCAL de
    // propósito: aqui "mês" é o mês do calendário do usuário, o mesmo que o
    // seletor da tela usa (app/mes-store.ts). Não é timestamp — timestamps
    // gravados no banco continuam em UTC, como no resto do projeto.
    let agora = Local::now();
    let mes = mes.unwrap_or_else(|| agora.month() as i32);
    let ano = ano.unwrap_or_else(|| agora.year());

    // A conexão do rusqlite não é `Send`: ela nasce e morre dentro de `preparar`,
    // antes de qualquer `await`.
    let preparo = preparar(&app, mes, ano)?;

    let texto = chat::conversar(
        preparo.provider,
        &preparo.api_key,
        &preparo.modelo,
        &preparo.sistema,
        &mensagens,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(RespostaConversa {
        texto,
        modelo: preparo.modelo,
        contexto_incluido: preparo.contexto_incluido,
    })
}
