use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::db;
use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::items;
use super::map::{
    conta_pluggy_para_quibo, decimal_para_centavos, e_cartao_de_credito,
    investimento_pluggy_para_quibo, transacao_para_entry,
};
use super::models::{Account, SubtipoConta, TipoConta};
use super::products;

// ─── Resultado de sincronização ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResultadoSync {
    pub pluggy_item_id: String,
    pub connector_name: Option<String>,
    pub status: String,
    pub entries_importados: u32,
    pub entries_atualizados: u32,
    pub investimentos_sincronizados: u32,
    pub erro: Option<String>,
    pub synced_at: String,
    pub proximo_sync: Option<String>,
}

// ─── Verificação de necessidade de sync ──────────────────────────────────────

/// Decide se deve sincronizar um Item agora.
/// Política conservadora: ≤ 1×/dia por item, alinhado ao `nextAutoSyncAt`.
pub fn deve_sincronizar(
    last_synced_at: Option<&str>,
    next_auto_sync_at: Option<&DateTime<Utc>>,
) -> bool {
    let agora = Utc::now();

    if let Some(proximo) = next_auto_sync_at {
        if agora < *proximo {
            return false;
        }
    }

    let ultimo = match last_synced_at {
        Some(s) => match s.parse::<DateTime<Utc>>() {
            Ok(dt) => dt,
            Err(_) => return true,
        },
        None => return true,
    };

    agora.signed_duration_since(ultimo).num_hours() >= 23
}

// ─── Engine principal ─────────────────────────────────────────────────────────

/// Sincroniza um Item específico pelo seu pluggy_item_id.
pub async fn sincronizar_item(
    app: &AppHandle,
    estado: &EstadoAuth,
    pluggy_item_id: &str,
    forcar: bool,
) -> ResultadoSync {
    let synced_at = Utc::now().to_rfc3339();

    match sincronizar_item_interno(app, estado, pluggy_item_id, forcar).await {
        Ok(resultado) => resultado,
        Err(e) => ResultadoSync {
            pluggy_item_id: pluggy_item_id.into(),
            connector_name: None,
            status: "ERROR".into(),
            entries_importados: 0,
            entries_atualizados: 0,
            investimentos_sincronizados: 0,
            erro: Some(e.to_string()),
            synced_at,
            proximo_sync: None,
        },
    }
}

async fn sincronizar_item_interno(
    app: &AppHandle,
    estado: &EstadoAuth,
    pluggy_item_id: &str,
    forcar: bool,
) -> Result<ResultadoSync, AppError> {
    let caminho_db = db::caminho_banco(app)?;
    let conn = Connection::open(&caminho_db)?;

    let registro = ler_registro_item(&conn, pluggy_item_id)?;
    let last_synced_at = registro.last_synced_at.as_deref();

    let item = items::buscar_item(estado, pluggy_item_id).await?;
    let connector_name = item.connector.as_ref().map(|c| c.name.clone());

    atualizar_status_item(
        &conn,
        pluggy_item_id,
        &item.status.to_string(),
        item.execution_status
            .as_ref()
            .map(|s| s.to_string())
            .as_deref(),
        item.next_auto_sync_at.as_ref(),
        item.error.as_ref().map(|e| e.code.as_str()),
        item.error.as_ref().map(|e| e.message.as_str()),
    )?;

    use super::models::StatusItem;
    if item.status == StatusItem::LoginError {
        return Ok(ResultadoSync {
            pluggy_item_id: pluggy_item_id.into(),
            connector_name,
            status: "LOGIN_ERROR".into(),
            entries_importados: 0,
            entries_atualizados: 0,
            investimentos_sincronizados: 0,
            erro: Some("Credenciais inválidas. Reconecte no MeuPluggy.".into()),
            synced_at: Utc::now().to_rfc3339(),
            proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        });
    }

    if item.status == StatusItem::WaitingUserInput {
        return Ok(ResultadoSync {
            pluggy_item_id: pluggy_item_id.into(),
            connector_name,
            status: "WAITING_USER_INPUT".into(),
            entries_importados: 0,
            entries_atualizados: 0,
            investimentos_sincronizados: 0,
            erro: Some("Ação necessária. Resolva no MeuPluggy.".into()),
            synced_at: Utc::now().to_rfc3339(),
            proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        });
    }

    if !forcar && !deve_sincronizar(last_synced_at, item.next_auto_sync_at.as_ref()) {
        return Ok(ResultadoSync {
            pluggy_item_id: pluggy_item_id.into(),
            connector_name,
            status: "SKIPPED".into(),
            entries_importados: 0,
            entries_atualizados: 0,
            investimentos_sincronizados: 0,
            erro: None,
            synced_at: Utc::now().to_rfc3339(),
            proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        });
    }

    let contas = products::buscar_contas(estado, pluggy_item_id).await?;

    let mut total_importados = 0u32;
    let mut total_atualizados = 0u32;

    let desde = last_synced_at.and_then(|s| s.parse::<DateTime<Utc>>().ok());

    for conta in &contas {
        upsert_conta_pluggy(&conn, &registro.item_id_local, conta, connector_name.as_deref())?;

        let (account_id_local, credit_card_id_local) =
            resolver_conta_local(&conn, &conta.id)?;

        let e_credito = e_cartao_de_credito(conta);

        let transacoes = products::buscar_transacoes(estado, &conta.id, desde).await?;

        let (importados, atualizados) = upsert_transacoes(
            &conn,
            &transacoes,
            &conta.id,
            account_id_local.as_deref(),
            credit_card_id_local.as_deref(),
            e_credito,
        )?;

        total_importados += importados;
        total_atualizados += atualizados;

        let conta_importada = conta_pluggy_para_quibo(conta, connector_name.as_deref());
        if let Some(ref acc_id) = account_id_local {
            atualizar_saldo_conta(&conn, acc_id, conta_importada.balance_cents)?;
        }
    }

    let investimentos = products::buscar_investimentos(estado, pluggy_item_id).await?;
    let total_inv = upsert_investimentos(&conn, &investimentos)?;

    let agora = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE pluggy_items
            SET last_synced_at = ?1,
                status         = 'UPDATED',
                updated_at     = ?1
          WHERE pluggy_item_id = ?2",
        params![agora, pluggy_item_id],
    )?;

    gravar_log_sync(
        &conn,
        pluggy_item_id,
        "SUCCESS",
        total_importados + total_atualizados,
        None,
    )?;

    Ok(ResultadoSync {
        pluggy_item_id: pluggy_item_id.into(),
        connector_name,
        status: "SUCCESS".into(),
        entries_importados: total_importados,
        entries_atualizados: total_atualizados,
        investimentos_sincronizados: total_inv,
        erro: None,
        synced_at: agora.clone(),
        proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
    })
}

/// Sincroniza todos os Items registrados no banco local.
pub async fn sincronizar_todos(
    app: &AppHandle,
    estado: &EstadoAuth,
    forcar: bool,
) -> Result<Vec<ResultadoSync>, AppError> {
    let caminho_db = db::caminho_banco(app)?;
    let conn = Connection::open(&caminho_db)?;

    let ids: Vec<String> = {
        let mut stmt =
            conn.prepare("SELECT pluggy_item_id FROM pluggy_items ORDER BY created_at")?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };

    let mut resultados = Vec::with_capacity(ids.len());
    for id in &ids {
        resultados.push(sincronizar_item(app, estado, id, forcar).await);
    }

    Ok(resultados)
}

// ─── Operações no banco ───────────────────────────────────────────────────────

struct RegistroItem {
    last_synced_at: Option<String>,
    /// ID interno (PK) da linha em `pluggy_items` — usado como FK em `pluggy_accounts`.
    item_id_local: String,
}

fn ler_registro_item(conn: &Connection, pluggy_item_id: &str) -> Result<RegistroItem, AppError> {
    conn.query_row(
        "SELECT last_synced_at, id FROM pluggy_items WHERE pluggy_item_id = ?1",
        params![pluggy_item_id],
        |row| {
            Ok(RegistroItem {
                last_synced_at: row.get(0)?,
                item_id_local: row.get(1)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Item Pluggy '{pluggy_item_id}' não encontrado no banco"))
        }
        outro => AppError::Database(outro),
    })
}

fn atualizar_status_item(
    conn: &Connection,
    pluggy_item_id: &str,
    status: &str,
    execution_status: Option<&str>,
    next_auto_sync_at: Option<&DateTime<Utc>>,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Result<(), AppError> {
    let next_sync_str = next_auto_sync_at.map(|d| d.to_rfc3339());
    let agora = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE pluggy_items
            SET status              = ?1,
                execution_status    = ?2,
                next_auto_sync_at   = ?3,
                error_code          = ?4,
                error_message       = ?5,
                updated_at          = ?6
          WHERE pluggy_item_id = ?7",
        params![
            status,
            execution_status,
            next_sync_str,
            error_code,
            error_message,
            agora,
            pluggy_item_id
        ],
    )?;

    Ok(())
}

/// Espelha uma conta Pluggy na tabela `pluggy_accounts` (upsert idempotente).
fn upsert_conta_pluggy(
    conn: &Connection,
    item_id_local: &str,
    conta: &Account,
    _connector_name: Option<&str>,
) -> Result<(), AppError> {
    let tipo_str = match conta.tipo {
        TipoConta::Bank   => "BANK",
        TipoConta::Credit => "CREDIT",
        TipoConta::Outro  => "OTHER",
    };
    let subtipo_str = match conta.subtype {
        SubtipoConta::CheckingAccount => "CHECKING_ACCOUNT",
        SubtipoConta::SavingsAccount  => "SAVINGS_ACCOUNT",
        SubtipoConta::CreditCard      => "CREDIT_CARD",
        SubtipoConta::Investment      => "INVESTMENT",
        SubtipoConta::Outro           => "OTHER",
    };

    let balance_cents = decimal_para_centavos(conta.balance);
    let agora = Utc::now().to_rfc3339();
    let id = format!("pa_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));

    conn.execute(
        "INSERT INTO pluggy_accounts (
             id, pluggy_account_id, pluggy_item_id,
             type, subtype, name, number,
             balance_cents, owner, tax_number,
             synced_at, created_at, updated_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)
         ON CONFLICT(pluggy_account_id) DO UPDATE SET
             balance_cents = excluded.balance_cents,
             synced_at     = excluded.synced_at,
             updated_at    = excluded.updated_at",
        params![
            id,
            conta.id,
            item_id_local,
            tipo_str,
            subtipo_str,
            conta.name,
            conta.number,
            balance_cents,
            conta.owner,
            conta.tax_number,
            agora,
        ],
    )?;

    Ok(())
}

/// Resolve os IDs locais (conta / cartão) mapeados para uma conta Pluggy.
/// Retorna `(None, None)` quando a conta ainda não foi vinculada.
fn resolver_conta_local(
    conn: &Connection,
    pluggy_account_id: &str,
) -> Result<(Option<String>, Option<String>), AppError> {
    match conn.query_row(
        "SELECT local_account_id, local_card_id
           FROM pluggy_accounts
          WHERE pluggy_account_id = ?1",
        params![pluggy_account_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
            ))
        },
    ) {
        Ok(ids) => Ok(ids),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok((None, None)),
        Err(e) => Err(AppError::Database(e)),
    }
}

/// Upsert em lote de transações na tabela central, garantindo idempotência
/// via `pluggy_transaction_id`. Retorna `(novos, atualizados)`.
fn upsert_transacoes(
    conn: &Connection,
    transacoes: &[super::models::Transaction],
    pluggy_account_id: &str,
    account_id: Option<&str>,
    credit_card_id: Option<&str>,
    e_credito: bool,
) -> Result<(u32, u32), AppError> {
    let mut novos = 0u32;
    let mut atualizados = 0u32;

    for tx in transacoes {
        let entry = transacao_para_entry(tx, account_id, credit_card_id, e_credito);

        let linhas = conn.execute(
            "INSERT INTO transactions (
                id, pluggy_transaction_id, pluggy_account_id,
                description, amount_cents, type, status,
                date, month, year,
                account_id, credit_card_id,
                tags, created_at, updated_at
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
             ON CONFLICT(pluggy_transaction_id) DO UPDATE SET
                description  = excluded.description,
                amount_cents = excluded.amount_cents,
                type         = excluded.type,
                updated_at   = excluded.updated_at",
            params![
                entry.id,
                entry.pluggy_transaction_id,
                pluggy_account_id,
                entry.description,
                entry.amount_cents,
                entry.tipo.to_str(),
                entry.status,
                entry.date,
                entry.month,
                entry.year,
                entry.account_id,
                entry.credit_card_id,
                entry.category_pluggy,
                entry.created_at,
                entry.updated_at,
            ],
        )?;

        if linhas == 1 {
            novos += 1;
        } else {
            atualizados += 1;
        }
    }

    Ok((novos, atualizados))
}

fn upsert_investimentos(
    conn: &Connection,
    investimentos: &[super::models::Investment],
) -> Result<u32, AppError> {
    let mut total = 0u32;

    for inv in investimentos {
        let mapeado = investimento_pluggy_para_quibo(inv);
        let agora = Utc::now().to_rfc3339();
        let sub_type_str = format!("{:?}", mapeado.tipo).to_uppercase();
        let purchase_date = inv
            .due_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

        conn.execute(
            "INSERT INTO transactions (
                id, type, status, description,
                amount_cents, date,
                inv_sub_type, inv_ticker, inv_quantity,
                inv_current_price_cents,
                created_at, updated_at
             ) VALUES (?1,'INVESTMENT','CONFIRMADO',?2,?3,?4,?5,?6,1.0,?7,?8,?8)
             ON CONFLICT(id) DO UPDATE SET
                inv_current_price_cents = excluded.inv_current_price_cents,
                updated_at              = excluded.updated_at",
            params![
                mapeado.pluggy_investment_id,
                mapeado.name,
                mapeado.purchase_price_cents,
                purchase_date,
                sub_type_str,
                mapeado.ticker,
                mapeado.balance_cents,
                agora,
            ],
        )?;

        total += 1;
    }

    Ok(total)
}

fn atualizar_saldo_conta(
    conn: &Connection,
    account_id: &str,
    balance_cents: i64,
) -> Result<(), AppError> {
    let agora = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE accounts SET balance_cents = ?1, updated_at = ?2 WHERE id = ?3",
        params![balance_cents, agora, account_id],
    )?;
    Ok(())
}

fn gravar_log_sync(
    conn: &Connection,
    pluggy_item_id: &str,
    status: &str,
    entries_total: u32,
    erro: Option<&str>,
) -> Result<(), AppError> {
    let agora = Utc::now().to_rfc3339();
    let id = format!("log_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));

    let item_id_local: Option<String> = conn
        .query_row(
            "SELECT id FROM pluggy_items WHERE pluggy_item_id = ?1",
            params![pluggy_item_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(item_id) = item_id_local {
        conn.execute(
            "INSERT INTO pluggy_sync_log
                (id, item_id, synced_at, status, entries_imported, error_message)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![id, item_id, agora, status, entries_total, erro],
        )?;
    }

    Ok(())
}

// ─── Registro de Item novo ────────────────────────────────────────────────────

/// Registra um novo Item no banco local após o usuário autorizar no MeuPluggy.
pub fn registrar_item(
    conn: &Connection,
    pluggy_item_id: &str,
    connector_name: Option<&str>,
) -> Result<String, AppError> {
    let id = format!("pi_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let agora = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO pluggy_items (id, pluggy_item_id, connector_name, status, created_at, updated_at)
         VALUES (?1,?2,?3,'PENDING',?4,?4)
         ON CONFLICT(pluggy_item_id) DO UPDATE SET
             connector_name = COALESCE(excluded.connector_name, pluggy_items.connector_name),
             updated_at     = excluded.updated_at",
        params![id, pluggy_item_id, connector_name, agora],
    )?;

    Ok(id)
}

/// Remove o registro local de um Item (não deleta na Pluggy).
pub fn remover_item_local(conn: &Connection, pluggy_item_id: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM pluggy_items WHERE pluggy_item_id = ?1",
        params![pluggy_item_id],
    )?;
    Ok(())
}
