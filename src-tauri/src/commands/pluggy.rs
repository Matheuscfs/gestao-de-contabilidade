use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::db;
use crate::errors::AppError;
use crate::pluggy::{
    auth::{self, EstadoAuth},
    intelligence,
    items,
    map::conta_pluggy_para_quibo,
    sync::{self, ResultadoSync},
};

// ─── Credenciais ──────────────────────────────────────────────────────────────

/// Salva CLIENT_ID e CLIENT_SECRET no banco local e valida gerando uma API Key.
/// A UI só recebe confirmação — os segredos nunca saem do Rust.
#[tauri::command]
pub async fn pluggy_salvar_credenciais(
    app: AppHandle,
    client_id: String,
    client_secret: String,
    estado: State<'_, EstadoAuth>,
) -> Result<(), String> {
    auth::salvar_credenciais(&app, &client_id, &client_secret)
        .map_err(|e| e.to_string())?;

    // Valida gerando uma API Key — se falhar, as credenciais são inválidas.
    estado.api_key().await.map_err(|e| {
        let _ = auth::remover_credenciais(&app);
        format!("Credenciais inválidas: {e}")
    })?;

    Ok(())
}

/// Retorna se as credenciais estão configuradas (sem expor os valores).
#[tauri::command]
pub fn pluggy_status_credenciais(app: AppHandle) -> Result<StatusCredenciais, String> {
    let configurado = auth::credenciais_existem(&app).map_err(|e| e.to_string())?;
    Ok(StatusCredenciais { configurado })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusCredenciais {
    pub configurado: bool,
}

/// Remove as credenciais do banco local e invalida o cache de API Key.
#[tauri::command]
pub async fn pluggy_remover_credenciais(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
) -> Result<(), String> {
    estado.invalidar_cache().await;
    auth::remover_credenciais(&app).map_err(|e| e.to_string())
}

// ─── Items ────────────────────────────────────────────────────────────────────

fn query_items_db(conn: &Connection) -> rusqlite::Result<Vec<ItemResumo>> {
    let mut stmt = conn.prepare(
        "SELECT pluggy_item_id, pluggy_connector_name, pluggy_status,
                pluggy_last_synced_at, pluggy_next_sync_at,
                pluggy_error_code, pluggy_error_message
           FROM integrations
          WHERE type = 'PLUGGY'
          ORDER BY created_at",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ItemResumo {
            pluggy_item_id: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
            connector_name: row.get(1)?,
            status: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            last_synced_at: row.get(3)?,
            next_auto_sync_at: row.get(4)?,
            error_code: row.get(5)?,
            error_message: row.get(6)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Lista os Items registrados no banco local com status atualizado.
#[tauri::command]
pub async fn pluggy_listar_items(
    app: AppHandle,
    _estado: State<'_, EstadoAuth>,
) -> Result<Vec<ItemResumo>, String> {
    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;
    query_items_db(&conn).map_err(|e| e.to_string())
}

/// Descobre Items vinculados às credenciais na API Pluggy e os registra no banco local.
/// Idempotente: ítens já registrados são ignorados (ON CONFLICT DO NOTHING).
/// Retorna a lista atualizada do banco local.
#[tauri::command]
pub async fn pluggy_descobrir_items(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
) -> Result<Vec<ItemResumo>, String> {
    let items_api = items::listar_items(&estado)
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[pluggy] descobrir_items: {} item(s) na API", items_api.len());

    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;

    for item in &items_api {
        let connector_name = item.connector.as_ref().map(|c| c.name.clone());
        eprintln!("[pluggy] registrando item {} ({})", item.id, connector_name.as_deref().unwrap_or("?"));
        sync::registrar_item(&conn, &item.id, connector_name.as_deref())
            .map_err(|e| e.to_string())?;
    }

    query_items_db(&conn).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemResumo {
    pub pluggy_item_id: String,
    pub connector_name: Option<String>,
    pub status: String,
    pub last_synced_at: Option<String>,
    pub next_auto_sync_at: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

/// Registra um Item no banco local após autorização OAuth no MeuPluggy.
/// Chamado pelo wizard de configuração após o usuário obter o pluggy_item_id.
#[tauri::command]
pub async fn pluggy_registrar_item(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
    pluggy_item_id: String,
) -> Result<ItemResumo, String> {
    // Valida que o item existe na Pluggy antes de registrar localmente.
    let item = items::buscar_item(&estado, &pluggy_item_id)
        .await
        .map_err(|e| e.to_string())?;

    let connector_name = item.connector.as_ref().map(|c| c.name.clone());

    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;

    sync::registrar_item(&conn, &pluggy_item_id, connector_name.as_deref())
        .map_err(|e| e.to_string())?;

    Ok(ItemResumo {
        pluggy_item_id,
        connector_name,
        status: item.status.to_string(),
        last_synced_at: None,
        next_auto_sync_at: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        error_code: item.error.as_ref().map(|e| e.code.clone()),
        error_message: item.error.as_ref().map(|e| e.message.clone()),
    })
}

// ─── Mapeamento de contas ─────────────────────────────────────────────────────

/// Retorna a lista de contas Pluggy de um Item para o wizard de mapeamento.
#[tauri::command]
pub async fn pluggy_listar_contas_item(
    estado: State<'_, EstadoAuth>,
    pluggy_item_id: String,
) -> Result<Vec<ContaPluggyResumo>, String> {
    use crate::pluggy::products;

    let contas = products::buscar_contas(&estado, &pluggy_item_id)
        .await
        .map_err(|e| e.to_string())?;

    let resumo = contas
        .iter()
        .map(|c| {
            let mapeada = conta_pluggy_para_quibo(c, None);
            ContaPluggyResumo {
                pluggy_account_id: c.id.clone(),
                name: c.name.clone(),
                tipo: format!("{:?}", mapeada.tipo),
                balance_cents: mapeada.balance_cents,
                account_number: c.number.clone(),
            }
        })
        .collect();

    Ok(resumo)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContaPluggyResumo {
    pub pluggy_account_id: String,
    pub name: String,
    pub tipo: String,
    pub balance_cents: i64,
    pub account_number: Option<String>,
}

/// Vincula contas/cartões existentes no Quibo às suas contrapartes na Pluggy.
/// O mapa recebido é `{ pluggy_account_id: local_entity_id }`.
/// Seta `pluggy_id` e `source='PLUGGY'` na entidade local correspondente.
#[tauri::command]
pub async fn pluggy_salvar_mapeamento(
    app: AppHandle,
    _pluggy_item_id: String,
    mapeamento: std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;
    let agora = chrono::Utc::now().to_rfc3339();

    for (pluggy_account_id, local_id) in &mapeamento {
        // Tenta atualizar em accounts primeiro.
        let rows = conn
            .execute(
                "UPDATE accounts
                    SET pluggy_id = ?1, source = 'PLUGGY', updated_at = ?3
                  WHERE id = ?2",
                rusqlite::params![pluggy_account_id, local_id, agora],
            )
            .map_err(|e| e.to_string())?;

        // Se não achou em accounts, tenta credit_cards.
        if rows == 0 {
            conn.execute(
                "UPDATE credit_cards
                    SET pluggy_id = ?1, source = 'PLUGGY', updated_at = ?3
                  WHERE id = ?2",
                rusqlite::params![pluggy_account_id, local_id, agora],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// ─── Sincronização ────────────────────────────────────────────────────────────

/// Sincroniza um Item específico.
/// `forcar = true` ignora o intervalo mínimo de 23h.
#[tauri::command]
pub async fn pluggy_sincronizar_item(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
    pluggy_item_id: String,
    forcar: bool,
) -> Result<ResultadoSync, String> {
    Ok(sync::sincronizar_item(&app, &estado, &pluggy_item_id, forcar).await)
}

/// Sincroniza todos os Items registrados.
/// Chamado ao abrir o app (sem forçar) ou pelo botão "Atualizar tudo".
#[tauri::command]
pub async fn pluggy_sincronizar_todos(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
    forcar: bool,
) -> Result<Vec<ResultadoSync>, String> {
    sync::sincronizar_todos(&app, &estado, forcar)
        .await
        .map_err(|e| e.to_string())
}

// ─── Remoção ──────────────────────────────────────────────────────────────────

/// Remove o Item do banco local. Não deleta na Pluggy.
/// Para deletar na Pluggy também, use `pluggy_deletar_item_remoto`.
#[tauri::command]
pub async fn pluggy_remover_item(
    app: AppHandle,
    pluggy_item_id: String,
) -> Result<(), String> {
    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;

    sync::remover_item_local(&conn, &pluggy_item_id)
        .map_err(|e| e.to_string())
}

/// Deleta o Item na Pluggy E remove do banco local.
/// Aviso: remove todos os dados associados na Pluggy permanentemente.
#[tauri::command]
pub async fn pluggy_deletar_item_remoto(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
    pluggy_item_id: String,
) -> Result<(), String> {
    items::deletar_item(&estado, &pluggy_item_id)
        .await
        .map_err(|e| e.to_string())?;

    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;

    sync::remover_item_local(&conn, &pluggy_item_id)
        .map_err(|e| e.to_string())
}

// ─── Intelligence ─────────────────────────────────────────────────────────────

/// Retorna pagamentos recorrentes de um Item (assinaturas, contas fixas).
/// Usado pelo motor de insights para calcular "gasto recorrente mensal".
#[tauri::command]
pub async fn pluggy_recorrentes(
    _app: AppHandle,
    estado: State<'_, EstadoAuth>,
    pluggy_item_id: String,
) -> Result<RecorrentesResumo, String> {
    use crate::pluggy::products;

    let contas = products::buscar_contas(&estado, &pluggy_item_id)
        .await
        .map_err(|e| e.to_string())?;

    let account_ids: Vec<String> = contas.iter().map(|c| c.id.clone()).collect();

    let recorrentes = intelligence::buscar_recorrentes_de_contas(&estado, &account_ids)
        .await
        .map_err(|e| e.to_string())?;

    let total_centavos = intelligence::total_recorrentes_centavos(&recorrentes);

    Ok(RecorrentesResumo {
        quantidade: recorrentes.len() as u32,
        total_mensal_centavos: total_centavos,
        itens: recorrentes
            .iter()
            .map(|r| RecorrenteItem {
                description: r.description.clone(),
                amount_cents: crate::pluggy::map::decimal_para_centavos(r.amount.abs()),
                frequency: r.frequency.clone(),
                category: r.category.clone(),
                next_transaction: r.next_transaction.map(|d| d.to_rfc3339()),
            })
            .collect(),
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecorrentesResumo {
    pub quantidade: u32,
    pub total_mensal_centavos: i64,
    pub itens: Vec<RecorrenteItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecorrenteItem {
    pub description: String,
    pub amount_cents: i64,
    pub frequency: Option<String>,
    pub category: Option<String>,
    pub next_transaction: Option<String>,
}

// ─── Conexão via OAuth local (MeuPluggy) ──────────────────────────────────────

/// Inicia o fluxo completo de conexão com um banco via MeuPluggy:
/// 1. Sobe servidor HTTP local numa porta livre.
/// 2. Gera Connect Token com `redirectUri` apontando para esse servidor.
/// 3. Abre `meu.pluggy.ai?connectToken=...` no browser.
/// 4. Aguarda o browser redirecionar para localhost com `?itemId=...`.
/// 5. Valida e registra o item no banco local.
#[tauri::command]
pub async fn pluggy_iniciar_conexao(
    app: AppHandle,
    estado: State<'_, EstadoAuth>,
) -> Result<ItemResumo, String> {
    // 1. Bind em porta livre (SO escolhe)
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Erro ao iniciar servidor local: {e}"))?;

    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}/pluggy-callback");

    // 2. Gera Connect Token com redirectUri
    let token = auth::gerar_connect_token(&estado, Some("quibo-local"), Some(&redirect_uri))
        .await
        .map_err(|e| e.to_string())?;

    // 3. Abre MeuPluggy no browser padrão
    let url = format!("https://meu.pluggy.ai?connectToken={token}");
    app.opener()
        .open_url(&url, None::<String>)
        .map_err(|e| format!("Erro ao abrir navegador: {e}"))?;

    // 4. Aguarda callback (timeout: 5 min)
    let item_id = aguardar_callback_http(listener)
        .await
        .map_err(|e| e.to_string())?;

    eprintln!("[pluggy] callback recebido: itemId={item_id}");

    // 5. Valida que o item existe na Pluggy
    let item = items::buscar_item(&estado, &item_id)
        .await
        .map_err(|e| e.to_string())?;

    let connector_name = item.connector.as_ref().map(|c| c.name.clone());

    // 6. Registra no banco local
    let caminho = db::caminho_banco(&app).map_err(|e| e.to_string())?;
    let conn = Connection::open(&caminho).map_err(|e| e.to_string())?;
    sync::registrar_item(&conn, &item_id, connector_name.as_deref())
        .map_err(|e| e.to_string())?;

    Ok(ItemResumo {
        pluggy_item_id: item_id,
        connector_name,
        status: item.status.to_string(),
        last_synced_at: None,
        next_auto_sync_at: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        error_code: item.error.as_ref().map(|e| e.code.clone()),
        error_message: item.error.as_ref().map(|e| e.message.clone()),
    })
}

/// Mini servidor HTTP que aguarda uma única requisição GET no caminho `/pluggy-callback`.
/// Extrai `itemId` dos query params e responde com HTML de sucesso.
async fn aguardar_callback_http(
    listener: tokio::net::TcpListener,
) -> Result<String, AppError> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let timeout = tokio::time::Duration::from_secs(300); // 5 min

    let (mut socket, _) = tokio::time::timeout(timeout, listener.accept())
        .await
        .map_err(|_| {
            AppError::Integration(
                "Tempo esgotado (5 min). Nenhum banco foi conectado. Tente adicionar manualmente."
                    .into(),
            )
        })?
        .map_err(|e| AppError::Integration(e.to_string()))?;

    let mut buf = vec![0u8; 8192];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| AppError::Integration(e.to_string()))?;

    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next().unwrap_or("");

    // "GET /pluggy-callback?itemId=xxx&... HTTP/1.1"
    let item_id = first_line
        .split_whitespace()
        .nth(1) // caminho
        .and_then(|path| path.split('?').nth(1)) // query string
        .and_then(|query| {
            query.split('&').find_map(|kv| {
                let mut parts = kv.splitn(2, '=');
                match (parts.next(), parts.next()) {
                    (Some("itemId"), Some(id)) if !id.is_empty() => Some(id.to_string()),
                    _ => None,
                }
            })
        });

    let html = r#"<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Quibo — Conectado!</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F4F5F7}
.card{background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);max-width:360px}
h2{color:#0E1116;margin:0 0 8px}p{color:#5B616E;margin:0}</style></head>
<body><div class="card"><div style="font-size:40px;margin-bottom:16px">✅</div>
<h2>Banco conectado!</h2><p>Pode fechar esta janela e voltar ao Quibo.</p></div></body></html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = socket.write_all(response.as_bytes()).await;

    item_id.ok_or_else(|| {
        AppError::Integration(
            "itemId não encontrado no callback. Adicione o banco manualmente.".into(),
        )
    })
}
