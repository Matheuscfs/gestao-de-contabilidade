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
use super::models::{Account, Loan, SubtipoConta};
use super::products;

// ─── Catálogo de categorias ───────────────────────────────────────────────────

/// Índice nome → id das categorias do Quibo, carregado uma vez por sincronização.
/// O de-para em `categorias.rs` devolve o *nome* da categoria; é aqui que ele
/// vira a chave estrangeira gravada em `transactions.category_id`.
struct CatalogoCategorias(std::collections::HashMap<String, String>);

impl CatalogoCategorias {
    fn carregar(conn: &Connection) -> Result<Self, AppError> {
        let mut stmt = conn.prepare("SELECT name, id FROM categories WHERE archived = 0")?;
        let pares = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(Self(pares))
    }

    /// `None` quando a Pluggy não classificou a transação ou quando o usuário
    /// apagou/renomeou a categoria padrão correspondente.
    fn id_de(&self, nome: Option<&str>) -> Option<&str> {
        self.0.get(nome?).map(String::as_str)
    }
}

/// Extrai `(ano, mês)` de uma data "YYYY-MM-DD". Cai no mês corrente se a data
/// vier num formato inesperado, para nunca gravar competência nula.
fn competencia_de(data: &str) -> (i32, i32) {
    let mut partes = data.split('-');
    let ano = partes.next().and_then(|a| a.parse::<i32>().ok());
    let mes = partes
        .next()
        .and_then(|m| m.parse::<i32>().ok())
        .filter(|m| (1..=12).contains(m));

    match (ano, mes) {
        (Some(a), Some(m)) => (a, m),
        _ => {
            let hoje = Utc::now();
            (
                hoje.format("%Y").to_string().parse().unwrap_or(2026),
                hoje.format("%m").to_string().parse().unwrap_or(1),
            )
        }
    }
}

/// Persona dona da conta ou do cartão — herdada pelas transações importadas,
/// para que os recortes por persona incluam o que veio do Open Finance.
fn persona_da_origem(
    conn: &Connection,
    account_id: Option<&str>,
    credit_card_id: Option<&str>,
) -> Option<String> {
    let (tabela, id) = match (account_id, credit_card_id) {
        (Some(id), _) => ("accounts", id),
        (_, Some(id)) => ("credit_cards", id),
        _ => return None,
    };

    conn.query_row(
        &format!("SELECT persona_id FROM {tabela} WHERE id = ?1"),
        params![id],
        |row| row.get::<_, Option<String>>(0),
    )
    .ok()
    .flatten()
}

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
        Err(e) => {
            let mensagem = e.to_string();
            eprintln!("[pluggy] sync de {pluggy_item_id} falhou: {mensagem}");

            // Registra a falha em integration_sync_log. Antes o log só era
            // gravado no caminho de sucesso, então uma sincronização quebrada
            // não deixava rastro nenhum para diagnóstico.
            if let Ok(caminho) = db::caminho_banco(app) {
                if let Ok(conn) = Connection::open(&caminho) {
                    let _ = gravar_log_sync(&conn, pluggy_item_id, "ERROR", 0, Some(&mensagem));
                }
            }

            ResultadoSync {
                pluggy_item_id: pluggy_item_id.into(),
                connector_name: None,
                status: "ERROR".into(),
                entries_importados: 0,
                entries_atualizados: 0,
                investimentos_sincronizados: 0,
                faturas_sincronizadas: 0,
                erro: Some(mensagem),
                synced_at,
                proximo_sync: None,
            }
        }
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

    let contas = products::buscar_contas_raw(estado, pluggy_item_id).await?;

    let mut total_importados = 0u32;
    let mut total_atualizados = 0u32;
    let mut total_faturas = 0u32;

    let desde = last_synced_at.and_then(|s| s.parse::<DateTime<Utc>>().ok());
    let catalogo = CatalogoCategorias::carregar(&conn)?;

    for (conta, conta_raw) in &contas {
        // Espelha a conta no banco local (accounts ou credit_cards), guardando o
        // JSON cru da Pluggy em `raw`.
        upsert_conta_pluggy(&conn, conta, conta_raw, connector_name.as_deref())?;

        let (account_id_local, credit_card_id_local) =
            resolver_conta_local(&conn, &conta.id)?;

        let e_credito = e_cartao_de_credito(conta);
        let transacoes = products::buscar_transacoes_raw(estado, &conta.id, desde).await?;

        let persona_id = persona_da_origem(
            &conn,
            account_id_local.as_deref(),
            credit_card_id_local.as_deref(),
        );

        let (importados, atualizados) = upsert_transacoes(
            &conn,
            &transacoes,
            account_id_local.as_deref(),
            credit_card_id_local.as_deref(),
            e_credito,
            &catalogo,
            persona_id.as_deref(),
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

    let investimentos = products::buscar_investimentos_raw(estado, pluggy_item_id).await?;
    let total_inv = upsert_investimentos(&conn, &investimentos)?;

    // Empréstimos e financiamentos alimentam a tela de Dívidas. Falha aqui não
    // derruba a sincronização: nem todo banco expõe o produto `/loans`, e o que
    // já foi importado de contas e transações continua valendo.
    match products::buscar_emprestimos(estado, pluggy_item_id).await {
        Ok(emprestimos) => {
            if let Err(e) = upsert_emprestimos(&conn, &emprestimos) {
                eprintln!("[pluggy] falha ao gravar empréstimos de {pluggy_item_id}: {e}");
            }
        }
        Err(e) => eprintln!("[pluggy] /loans indisponível para {pluggy_item_id}: {e}"),
    }

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

/// Nome da instituição a exibir na conta.
///
/// No modelo MeuPluggy o `connector` é sempre o proxy — literalmente
/// "MeuPluggy" — e não o banco de onde o dado veio. Usar isso como rótulo faz
/// toda conta importada aparecer com a mesma marca e perder o logo. O nome da
/// conta, por outro lado, carrega a instituição real ("Sicredi", "Nu Pagamentos
/// S.A. ..."), então ele é a melhor fonte nesse caso.
fn nome_do_banco<'a>(connector_name: Option<&'a str>, nome_conta: &'a str) -> &'a str {
    match connector_name {
        Some(c) if !c.trim().is_empty() && !c.eq_ignore_ascii_case("meupluggy") => c,
        _ => nome_conta,
    }
}

/// Persona a atribuir ao que vem do banco: a principal (o dono do app).
/// Sem isso os recortes por persona ignoram tudo que foi importado — era o
/// caso antes, com 100% das transações sincronizadas sem persona.
const PERSONA_PRINCIPAL: &str =
    "(SELECT id FROM personas WHERE is_self = 1 AND archived = 0 LIMIT 1)";

/// Upsert de uma conta Pluggy diretamente em `accounts` ou `credit_cards`.
/// Cartão de crédito (SubtipoConta::CreditCard) → `credit_cards`
/// Demais subtipos → `accounts`
fn upsert_conta_pluggy(
    conn: &Connection,
    conta: &Account,
    conta_raw: &serde_json::Value,
    connector_name: Option<&str>,
) -> Result<(), AppError> {
    let balance_cents = decimal_para_centavos(conta.balance);
    let agora = Utc::now().to_rfc3339();
    let id = format!("acc_{}", Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let raw_str = serde_json::to_string(conta_raw).unwrap_or_default();

    match conta.subtype {
        SubtipoConta::CreditCard => {
            // Enriquece com o creditData da Pluggy (bandeira, limite, vencimento).
            // ON CONFLICT não funciona com índice parcial — INSERT OR IGNORE + UPDATE explícito.
            let cartao = cartao_pluggy_para_quibo(conta);
            conn.execute(
                &format!(
                    "INSERT OR IGNORE INTO credit_cards (
                         id, name, brand, limit_cents, closing_day, due_day,
                         persona_id, source, pluggy_id, pluggy_synced_at, raw,
                         is_active, created_at, updated_at
                     ) VALUES (
                         ?1, ?2, COALESCE(?3,'OTHER'), ?4, COALESCE(?5,1), COALESCE(?6,10),
                         {PERSONA_PRINCIPAL}, 'PLUGGY', ?7, ?8, ?9, 1, ?8, ?8
                     )"
                ),
                params![
                    id,
                    conta.name,
                    cartao.brand,
                    cartao.limit_cents,
                    cartao.closing_day,
                    cartao.due_day,
                    conta.id,
                    agora,
                    raw_str,
                ],
            )?;
            conn.execute(
                &format!(
                    "UPDATE credit_cards SET
                         name             = ?1,
                         brand            = COALESCE(?2, brand),
                         limit_cents      = ?3,
                         closing_day      = COALESCE(?4, closing_day),
                         due_day          = COALESCE(?5, due_day),
                         persona_id       = COALESCE(persona_id, {PERSONA_PRINCIPAL}),
                         pluggy_synced_at = ?6,
                         raw              = ?7,
                         updated_at       = ?6
                     WHERE pluggy_id = ?8"
                ),
                params![
                    conta.name,
                    cartao.brand,
                    cartao.limit_cents,
                    cartao.closing_day,
                    cartao.due_day,
                    agora,
                    raw_str,
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
            let banco = nome_do_banco(connector_name, &conta.name);
            conn.execute(
                &format!(
                    "INSERT OR IGNORE INTO accounts (
                         id, name, type, bank, persona_id,
                         balance_cents, source, pluggy_id, pluggy_synced_at, raw,
                         is_active, created_at, updated_at
                     ) VALUES (?1,?2,?3,?4,{PERSONA_PRINCIPAL},?5,'PLUGGY',?6,?7,?9,1,?8,?8)"
                ),
                params![
                    id,
                    conta.name,
                    tipo_str,
                    banco,
                    balance_cents,
                    conta.id,
                    agora,
                    agora,
                    raw_str,
                ],
            )?;
            // `bank` e saldo são propriedade do sync (o UPDATE corrige contas já
            // importadas com o rótulo errado do proxy). A persona usa COALESCE:
            // preenche se estiver vazia, mas respeita quem o usuário escolheu.
            conn.execute(
                &format!(
                    "UPDATE accounts SET
                         balance_cents    = ?1,
                         bank             = ?5,
                         persona_id       = COALESCE(persona_id, {PERSONA_PRINCIPAL}),
                         pluggy_synced_at = ?2,
                         raw              = ?3,
                         updated_at       = ?2
                     WHERE pluggy_id = ?4"
                ),
                params![balance_cents, agora, raw_str, conta.id, banco],
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
    transacoes: &[(super::models::Transaction, serde_json::Value)],
    account_id: Option<&str>,
    credit_card_id: Option<&str>,
    e_credito: bool,
    catalogo: &CatalogoCategorias,
    persona_id: Option<&str>,
) -> Result<(u32, u32), AppError> {
    let mut novos = 0u32;
    let mut atualizados = 0u32;
    let agora = Utc::now().to_rfc3339();

    for (tx, tx_raw) in transacoes {
        let entry = transacao_para_entry(tx, account_id, credit_card_id, e_credito);
        let raw_str = serde_json::to_string(tx_raw).unwrap_or_default();
        let category_id = catalogo.id_de(entry.categoria_quibo);

        // ON CONFLICT não funciona com índice parcial — INSERT OR IGNORE + UPDATE explícito.
        // conn.changes() == 1 indica linha nova; 0 indica que já existia.
        conn.execute(
            "INSERT OR IGNORE INTO transactions (
                id, pluggy_id, source, pluggy_synced_at,
                description, amount_cents, type, status,
                date, month, year,
                account_id, credit_card_id, category_id, persona_id,
                tags, raw, pluggy_status, created_at, updated_at
             ) VALUES (?1,?2,'PLUGGY',?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?19,?17,?18)",
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
                category_id,
                persona_id,
                entry.category_pluggy,
                raw_str,
                entry.created_at,
                entry.updated_at,
                entry.status_pluggy,
            ],
        )?;
        let inserido = conn.changes() == 1;

        // `COALESCE` em category_id/persona_id: se o usuário recategorizou ou
        // atribuiu a persona manualmente, a escolha dele sobrevive ao próximo sync.
        //
        // O status só avança de PREVISTO para CONFIRMADO — é a liquidação de um
        // lançamento que estava pendente no banco. Nunca volta atrás nem mexe em
        // linha que o usuário já confirmou, pagou ou cancelou à mão.
        conn.execute(
            "UPDATE transactions SET
                description      = ?1,
                amount_cents     = ?2,
                type             = ?3,
                pluggy_synced_at = ?4,
                raw              = ?5,
                category_id      = COALESCE(category_id, ?7),
                persona_id       = COALESCE(persona_id, ?8),
                status           = CASE
                                     WHEN status = 'PREVISTO' AND ?9 = 'CONFIRMADO'
                                       THEN 'CONFIRMADO'
                                     ELSE status
                                   END,
                pluggy_status    = ?10,
                updated_at       = ?4
             WHERE pluggy_id = ?6",
            params![
                entry.description,
                entry.amount_cents,
                entry.tipo.to_str(),
                agora,
                raw_str,
                entry.pluggy_transaction_id,
                category_id,
                persona_id,
                entry.status,
                entry.status_pluggy,
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
    investimentos: &[(super::models::Investment, serde_json::Value)],
) -> Result<u32, AppError> {
    let mut total = 0u32;

    for (inv, inv_raw) in investimentos {
        let mapeado = investimento_pluggy_para_quibo(inv);
        let agora = Utc::now().to_rfc3339();
        let sub_type_str = mapeado.tipo.to_str();
        let raw_str = serde_json::to_string(inv_raw).unwrap_or_default();
        let data = inv
            .due_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

        // Sem month/year o investimento escapa de todo filtro por competência —
        // derivamos a competência da própria data de referência.
        let (ano, mes) = competencia_de(&data);

        conn.execute(
            "INSERT INTO transactions (
                id, type, status, source,
                description, amount_cents, date, month, year,
                inv_sub_type, inv_ticker, inv_quantity,
                inv_current_price_cents, raw,
                created_at, updated_at
             ) VALUES (?1,'INVESTMENT','CONFIRMADO','PLUGGY',?2,?3,?4,?10,?11,?5,?6,1.0,?7,?9,?8,?8)
             ON CONFLICT(id) DO UPDATE SET
                inv_current_price_cents = excluded.inv_current_price_cents,
                month                   = excluded.month,
                year                    = excluded.year,
                raw                     = excluded.raw,
                updated_at              = excluded.updated_at",
            params![
                mapeado.pluggy_investment_id,
                mapeado.name,
                mapeado.purchase_price_cents,
                data,
                sub_type_str,
                mapeado.ticker,
                mapeado.balance_cents,
                agora,
                raw_str,
                mes,
                ano,
            ],
        )?;

        total += 1;
    }

    Ok(total)
}

/// Espelha os empréstimos/financiamentos da Pluggy como dívidas do Quibo
/// (`type='DEBT'`, `is_template = 1`), que é o formato que a tela de Dívidas lê.
///
/// Importante: estas dívidas **não geram parcelas automáticas**. O pagamento da
/// parcela já chega como transação normal do banco (a Pluggy classifica em
/// "Loans and financing"); gerar também uma `DEBT_INSTALLMENT` contaria o mesmo
/// dinheiro duas vezes. Aqui a dívida serve para mostrar saldo devedor e
/// parcelas restantes — o realizado vem pelo extrato.
fn upsert_emprestimos(conn: &Connection, emprestimos: &[Loan]) -> Result<u32, AppError> {
    let agora = Utc::now().to_rfc3339();
    let mut total = 0u32;

    for loan in emprestimos {
        let id = format!("dbt_{}", loan.id);
        let descricao = loan
            .tipo
            .clone()
            .unwrap_or_else(|| "Empréstimo".to_string());

        let parcela_cents = loan.installment_value.map(decimal_para_centavos);
        let restantes = match (loan.total_installments, loan.paid_installments) {
            (Some(total), Some(pagas)) => Some((total - pagas).max(0)),
            (Some(total), None) => Some(total),
            _ => None,
        };
        let dia_parcela = loan
            .due_date
            .map(|d| d.format("%d").to_string())
            .and_then(|d| d.parse::<i32>().ok())
            .filter(|d| (1..=31).contains(d));

        // `COALESCE` nos campos editáveis: o usuário pode ajustar descrição e
        // dia de vencimento sem que o próximo sync desfaça a alteração.
        conn.execute(
            "INSERT INTO transactions (
                 id, type, status, source, pluggy_id, pluggy_synced_at,
                 description, amount_cents,
                 dbt_total_cents, dbt_total_installments, dbt_remaining_installments,
                 dbt_installment_day, is_template, is_recurring,
                 created_at, updated_at
             ) VALUES (?1,'DEBT','ATIVO','PLUGGY',?2,?3,?4,?5,?6,?7,?8,?9,1,1,?3,?3)
             ON CONFLICT(id) DO UPDATE SET
                 amount_cents               = excluded.amount_cents,
                 dbt_total_cents            = excluded.dbt_total_cents,
                 dbt_remaining_installments = excluded.dbt_remaining_installments,
                 dbt_installment_day        = COALESCE(dbt_installment_day, excluded.dbt_installment_day),
                 pluggy_synced_at           = excluded.pluggy_synced_at,
                 updated_at                 = excluded.updated_at",
            params![
                id,
                loan.id,
                agora,
                descricao,
                parcela_cents,
                decimal_para_centavos(loan.contracted_amount),
                loan.total_installments,
                restantes,
                dia_parcela,
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

#[cfg(test)]
mod testes {
    use super::{competencia_de, nome_do_banco};

    #[test]
    fn proxy_meupluggy_nao_vira_nome_de_banco() {
        // Via MeuPluggy o conector é sempre o proxy: o banco real está no nome
        // da conta. Sem isso toda conta importada ficava rotulada "MeuPluggy".
        assert_eq!(nome_do_banco(Some("MeuPluggy"), "Sicredi"), "Sicredi");
        assert_eq!(nome_do_banco(Some("meupluggy"), "Nu Pagamentos S.A."), "Nu Pagamentos S.A.");
        assert_eq!(nome_do_banco(None, "Sicredi"), "Sicredi");
        assert_eq!(nome_do_banco(Some("  "), "Sicredi"), "Sicredi");
    }

    #[test]
    fn conector_real_tem_prioridade_sobre_o_nome_da_conta() {
        // No caminho de conector direto, o conector é a instituição de fato.
        assert_eq!(nome_do_banco(Some("Nubank"), "Conta de pagamento"), "Nubank");
    }

    #[test]
    fn competencia_sai_da_data_e_cai_no_mes_atual_quando_invalida() {
        assert_eq!(competencia_de("2026-07-15"), (2026, 7));
        assert_eq!(competencia_de("2025-12-01"), (2025, 12));
        // Formato inesperado não pode gravar competência nula.
        let (ano, mes) = competencia_de("sem-data");
        assert!(ano >= 2024 && (1..=12).contains(&mes));
        // Mês fora de faixa também cai no fallback.
        let (_, m) = competencia_de("2026-13-01");
        assert!((1..=12).contains(&m));
    }
}
