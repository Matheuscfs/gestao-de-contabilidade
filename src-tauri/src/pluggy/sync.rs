use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::AppHandle;

use crate::db;
use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::items;
use super::map::{
    cartao_pluggy_para_quibo, conta_pluggy_para_quibo, decimal_para_centavos, e_cartao_de_credito,
    investimento_pluggy_para_quibo, transacao_para_entry,
};
use super::models::{Account, SubtipoConta};
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
    pub faturas_sincronizadas: u32,
    pub erro: Option<String>,
    pub synced_at: String,
    pub proximo_sync: Option<String>,
}

// ─── Verificação de necessidade de sync ──────────────────────────────────────

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
            faturas_sincronizadas: 0,
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
            faturas_sincronizadas: 0,
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
            faturas_sincronizadas: 0,
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
            faturas_sincronizadas: 0,
            erro: None,
            synced_at: Utc::now().to_rfc3339(),
            proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
        });
    }

    let contas = products::buscar_contas(estado, pluggy_item_id).await?;

    let mut total_importados = 0u32;
    let mut total_atualizados = 0u32;
    let mut total_faturas = 0u32;

    let desde = last_synced_at.and_then(|s| s.parse::<DateTime<Utc>>().ok());

    for conta in &contas {
        // Espelha a conta no banco local (accounts ou credit_cards).
        upsert_conta_pluggy(&conn, conta, connector_name.as_deref())?;

        let (account_id_local, credit_card_id_local) =
            resolver_conta_local(&conn, &conta.id)?;

        let e_credito = e_cartao_de_credito(conta);
        let transacoes = products::buscar_transacoes(estado, &conta.id, desde).await?;

        let (importados, atualizados) = upsert_transacoes(
            &conn,
            &transacoes,
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

        // Cartão: regenera as faturas (uma INVOICE por competência) a partir
        // dos gastos importados, preservando o status de pagamento existente.
        if e_credito {
            if let Some(ref card_id) = credit_card_id_local {
                total_faturas += regenerar_faturas_cartao(&conn, card_id)?;
            }
        }
    }

    let investimentos = products::buscar_investimentos(estado, pluggy_item_id).await?;
    let total_inv = upsert_investimentos(&conn, &investimentos)?;

    let agora = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE integrations
            SET pluggy_last_synced_at = ?1,
                pluggy_status         = 'UPDATED',
                updated_at            = ?1
          WHERE type = 'PLUGGY' AND pluggy_item_id = ?2",
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
        faturas_sincronizadas: total_faturas,
        erro: None,
        synced_at: agora.clone(),
        proximo_sync: item.next_auto_sync_at.map(|d| d.to_rfc3339()),
    })
}

pub async fn sincronizar_todos(
    app: &AppHandle,
    estado: &EstadoAuth,
    forcar: bool,
) -> Result<Vec<ResultadoSync>, AppError> {
    let caminho_db = db::caminho_banco(app)?;
    let conn = Connection::open(&caminho_db)?;

    let ids: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT pluggy_item_id FROM integrations WHERE type='PLUGGY' ORDER BY created_at",
        )?;
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
}

fn ler_registro_item(conn: &Connection, pluggy_item_id: &str) -> Result<RegistroItem, AppError> {
    conn.query_row(
        "SELECT pluggy_last_synced_at
           FROM integrations
          WHERE type = 'PLUGGY' AND pluggy_item_id = ?1",
        params![pluggy_item_id],
        |row| {
            Ok(RegistroItem {
                last_synced_at: row.get(0)?,
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
        "UPDATE integrations
            SET pluggy_status           = ?1,
                pluggy_execution_status = ?2,
                pluggy_next_sync_at     = ?3,
                pluggy_error_code       = ?4,
                pluggy_error_message    = ?5,
                updated_at              = ?6
          WHERE type = 'PLUGGY' AND pluggy_item_id = ?7",
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

/// Upsert de uma conta Pluggy diretamente em `accounts` ou `credit_cards`.
/// Cartão de crédito (SubtipoConta::CreditCard) → `credit_cards`
/// Demais subtipos → `accounts`
fn upsert_conta_pluggy(
    conn: &Connection,
    conta: &Account,
    connector_name: Option<&str>,
) -> Result<(), AppError> {
    let balance_cents = decimal_para_centavos(conta.balance);
    let agora = Utc::now().to_rfc3339();
    let id = format!("acc_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));

    match conta.subtype {
        SubtipoConta::CreditCard => {
            // Enriquece com o creditData da Pluggy (bandeira, limite, vencimento).
            // ON CONFLICT não funciona com índice parcial — INSERT OR IGNORE + UPDATE explícito.
            let cartao = cartao_pluggy_para_quibo(conta);
            conn.execute(
                "INSERT OR IGNORE INTO credit_cards (
                     id, name, brand, limit_cents, closing_day, due_day,
                     source, pluggy_id, pluggy_synced_at,
                     is_active, created_at, updated_at
                 ) VALUES (
                     ?1, ?2, COALESCE(?3,'OTHER'), ?4, COALESCE(?5,1), COALESCE(?6,10),
                     'PLUGGY', ?7, ?8, 1, ?8, ?8
                 )",
                params![
                    id,
                    conta.name,
                    cartao.brand,
                    cartao.limit_cents,
                    cartao.closing_day,
                    cartao.due_day,
                    conta.id,
                    agora,
                ],
            )?;
            conn.execute(
                "UPDATE credit_cards SET
                     name             = ?1,
                     brand            = COALESCE(?2, brand),
                     limit_cents      = ?3,
                     closing_day      = COALESCE(?4, closing_day),
                     due_day          = COALESCE(?5, due_day),
                     pluggy_synced_at = ?6,
                     updated_at       = ?6
                 WHERE pluggy_id = ?7",
                params![
                    conta.name,
                    cartao.brand,
                    cartao.limit_cents,
                    cartao.closing_day,
                    cartao.due_day,
                    agora,
                    conta.id,
                ],
            )?;
        }
        _ => {
            let tipo_str = match conta.subtype {
                SubtipoConta::CheckingAccount => "CHECKING",
                SubtipoConta::SavingsAccount  => "SAVINGS",
                SubtipoConta::Investment      => "INVESTMENT",
                _                             => "OTHER",
            };
            conn.execute(
                "INSERT OR IGNORE INTO accounts (
                     id, name, type, bank,
                     balance_cents, source, pluggy_id, pluggy_synced_at,
                     is_active, created_at, updated_at
                 ) VALUES (?1,?2,?3,?4,?5,'PLUGGY',?6,?7,1,?8,?8)",
                params![
                    id,
                    conta.name,
                    tipo_str,
                    connector_name,
                    balance_cents,
                    conta.id,
                    agora,
                    agora,
                ],
            )?;
            conn.execute(
                "UPDATE accounts SET
                     balance_cents    = ?1,
                     pluggy_synced_at = ?2,
                     updated_at       = ?2
                 WHERE pluggy_id = ?3",
                params![balance_cents, agora, conta.id],
            )?;
        }
    }

    Ok(())
}

/// Resolve IDs locais a partir do pluggy_id armazenado em accounts/credit_cards.
/// Retorna `(account_id, credit_card_id)` — no máximo um deles será Some.
fn resolver_conta_local(
    conn: &Connection,
    pluggy_account_id: &str,
) -> Result<(Option<String>, Option<String>), AppError> {
    let account_id: Option<String> = conn
        .query_row(
            "SELECT id FROM accounts WHERE pluggy_id = ?1",
            params![pluggy_account_id],
            |row| row.get(0),
        )
        .ok();

    let card_id: Option<String> = conn
        .query_row(
            "SELECT id FROM credit_cards WHERE pluggy_id = ?1",
            params![pluggy_account_id],
            |row| row.get(0),
        )
        .ok();

    Ok((account_id, card_id))
}

/// Upsert em lote de transações da Pluggy na tabela central.
/// Idempotente via `pluggy_id`. Retorna `(novos, atualizados)`.
fn upsert_transacoes(
    conn: &Connection,
    transacoes: &[super::models::Transaction],
    account_id: Option<&str>,
    credit_card_id: Option<&str>,
    e_credito: bool,
) -> Result<(u32, u32), AppError> {
    let mut novos = 0u32;
    let mut atualizados = 0u32;
    let agora = Utc::now().to_rfc3339();

    for tx in transacoes {
        let entry = transacao_para_entry(tx, account_id, credit_card_id, e_credito);

        // ON CONFLICT não funciona com índice parcial — INSERT OR IGNORE + UPDATE explícito.
        // conn.changes() == 1 indica linha nova; 0 indica que já existia.
        conn.execute(
            "INSERT OR IGNORE INTO transactions (
                id, pluggy_id, source, pluggy_synced_at,
                description, amount_cents, type, status,
                date, month, year,
                account_id, credit_card_id,
                tags, created_at, updated_at
             ) VALUES (?1,?2,'PLUGGY',?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                entry.id,
                entry.pluggy_transaction_id,
                agora,
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
        let inserido = conn.changes() == 1;

        conn.execute(
            "UPDATE transactions SET
                description      = ?1,
                amount_cents     = ?2,
                type             = ?3,
                pluggy_synced_at = ?4,
                updated_at       = ?4
             WHERE pluggy_id = ?5",
            params![
                entry.description,
                entry.amount_cents,
                entry.tipo.to_str(),
                agora,
                entry.pluggy_transaction_id,
            ],
        )?;

        if inserido {
            novos += 1;
        } else {
            atualizados += 1;
        }
    }

    Ok((novos, atualizados))
}

/// Regenera as faturas de um cartão a partir dos gastos importados.
///
/// Para cada competência (ano/mês) com gastos, mantém UMA transação
/// `type = 'INVOICE'` cujo valor é a soma dos `EXPENSE` daquele mês. Atualiza a
/// fatura existente (preservando status/pagamento) ou cria uma nova. Retorna a
/// quantidade de faturas tocadas.
fn regenerar_faturas_cartao(conn: &Connection, credit_card_id: &str) -> Result<u32, AppError> {
    // Dia de vencimento do cartão para datar a fatura.
    let due_day: i32 = conn
        .query_row(
            "SELECT due_day FROM credit_cards WHERE id = ?1",
            params![credit_card_id],
            |row| row.get(0),
        )
        .unwrap_or(10);
    let dia_venc = due_day.clamp(1, 28);

    // Soma dos gastos por competência.
    let competencias: Vec<(i32, i32, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT year, month, COALESCE(SUM(amount_cents), 0) AS total
               FROM transactions
              WHERE credit_card_id = ?1
                AND type = 'EXPENSE'
                AND year IS NOT NULL
                AND month IS NOT NULL
              GROUP BY year, month",
        )?;
        let linhas: Vec<(i32, i32, i64)> = stmt
            .query_map(params![credit_card_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })?
            .filter_map(|r| r.ok())
            .collect();
        linhas
    };

    let agora = Utc::now().to_rfc3339();
    let mut total = 0u32;

    for (ano, mes, valor) in competencias {
        let due_date = format!("{ano:04}-{mes:02}-{dia_venc:02}");
        let descricao = format!("Fatura {mes:02}/{ano}");

        let existente: Option<String> = conn
            .query_row(
                "SELECT id FROM transactions
                  WHERE credit_card_id = ?1 AND type = 'INVOICE' AND year = ?2 AND month = ?3
                  LIMIT 1",
                params![credit_card_id, ano, mes],
                |row| row.get(0),
            )
            .ok();

        match existente {
            // Atualiza só o valor/descrição — não mexe em status nem paid_at,
            // preservando faturas já marcadas como pagas.
            Some(inv_id) => {
                conn.execute(
                    "UPDATE transactions
                        SET amount_cents = ?1, description = ?2, due_date = ?3, updated_at = ?4
                      WHERE id = ?5",
                    params![valor, descricao, due_date, agora, inv_id],
                )?;
            }
            None => {
                let inv_id = format!("inv_{credit_card_id}_{ano:04}{mes:02}");
                conn.execute(
                    "INSERT INTO transactions (
                         id, type, status, description, amount_cents, due_date, date,
                         month, year, credit_card_id, is_template, is_recurring,
                         source, created_at, updated_at
                     ) VALUES (?1,'INVOICE','CONFIRMADO',?2,?3,?4,?4,?5,?6,?7,0,0,'PLUGGY',?8,?8)",
                    params![inv_id, descricao, valor, due_date, mes, ano, credit_card_id, agora],
                )?;
            }
        }

        total += 1;
    }

    Ok(total)
}

fn upsert_investimentos(
    conn: &Connection,
    investimentos: &[super::models::Investment],
) -> Result<u32, AppError> {
    let mut total = 0u32;

    for inv in investimentos {
        let mapeado = investimento_pluggy_para_quibo(inv);
        let agora = Utc::now().to_rfc3339();
        let sub_type_str = mapeado.tipo.to_str();
        let purchase_date = inv
            .due_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

        conn.execute(
            "INSERT INTO transactions (
                id, type, status, source,
                description, amount_cents, date,
                inv_sub_type, inv_ticker, inv_quantity,
                inv_current_price_cents,
                created_at, updated_at
             ) VALUES (?1,'INVESTMENT','CONFIRMADO','PLUGGY',?2,?3,?4,?5,?6,1.0,?7,?8,?8)
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

    let integration_id: Option<String> = conn
        .query_row(
            "SELECT id FROM integrations WHERE type='PLUGGY' AND pluggy_item_id = ?1",
            params![pluggy_item_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(int_id) = integration_id {
        conn.execute(
            "INSERT INTO integration_sync_log
                (id, integration_id, synced_at, status, entries_imported, error_message)
             VALUES (?1,?2,?3,?4,?5,?6)",
            params![id, int_id, agora, status, entries_total, erro],
        )?;
    }

    Ok(())
}

// ─── Registro de Item novo ────────────────────────────────────────────────────

/// Registra um novo item Pluggy em `integrations` após o usuário autorizar no MeuPluggy.
pub fn registrar_item(
    conn: &Connection,
    pluggy_item_id: &str,
    connector_name: Option<&str>,
) -> Result<String, AppError> {
    let id = format!("int_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let agora = Utc::now().to_rfc3339();

    // ON CONFLICT não funciona com índice parcial (WHERE pluggy_item_id IS NOT NULL),
    // então usamos INSERT OR IGNORE seguido de UPDATE explícito.
    conn.execute(
        "INSERT OR IGNORE INTO integrations (
             id, type, pluggy_item_id, pluggy_connector_name, pluggy_status,
             created_at, updated_at
         ) VALUES (?1,'PLUGGY',?2,?3,'PENDING',?4,?4)",
        params![id, pluggy_item_id, connector_name, agora],
    )?;

    conn.execute(
        "UPDATE integrations
         SET pluggy_connector_name = COALESCE(?1, pluggy_connector_name),
             updated_at            = ?2
         WHERE pluggy_item_id = ?3",
        params![connector_name, agora, pluggy_item_id],
    )?;

    Ok(id)
}

/// Remove o registro local de um item Pluggy (não deleta na Pluggy).
pub fn remover_item_local(conn: &Connection, pluggy_item_id: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM integrations WHERE type='PLUGGY' AND pluggy_item_id = ?1",
        params![pluggy_item_id],
    )?;
    Ok(())
}

/// Remove o item e todos os dados locais associados (cascade completo).
///
/// Ordem: transactions → accounts/credit_cards → integration.
/// `pluggy_account_ids` são os IDs de conta/cartão retornados pela API Pluggy.
pub fn remover_item_completo(
    conn: &Connection,
    pluggy_item_id: &str,
    pluggy_account_ids: &[String],
) -> Result<(), AppError> {
    if !pluggy_account_ids.is_empty() {
        let placeholders = pluggy_account_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(",");

        // Transações vinculadas a contas bancárias do item
        conn.execute(
            &format!(
                "DELETE FROM transactions WHERE account_id IN (
                    SELECT id FROM accounts WHERE pluggy_id IN ({placeholders})
                )"
            ),
            rusqlite::params_from_iter(pluggy_account_ids.iter()),
        )?;

        // Transações vinculadas a cartões de crédito do item
        conn.execute(
            &format!(
                "DELETE FROM transactions WHERE credit_card_id IN (
                    SELECT id FROM credit_cards WHERE pluggy_id IN ({placeholders})
                )"
            ),
            rusqlite::params_from_iter(pluggy_account_ids.iter()),
        )?;

        // Contas bancárias
        conn.execute(
            &format!("DELETE FROM accounts WHERE pluggy_id IN ({placeholders})"),
            rusqlite::params_from_iter(pluggy_account_ids.iter()),
        )?;

        // Cartões de crédito
        conn.execute(
            &format!("DELETE FROM credit_cards WHERE pluggy_id IN ({placeholders})"),
            rusqlite::params_from_iter(pluggy_account_ids.iter()),
        )?;
    }

    // Registro de integração
    conn.execute(
        "DELETE FROM integrations WHERE type='PLUGGY' AND pluggy_item_id = ?1",
        params![pluggy_item_id],
    )?;

    Ok(())
}
