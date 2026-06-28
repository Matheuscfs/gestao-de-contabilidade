use chrono::{DateTime, Utc};

use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::items::checar_status_http;
use super::models::{Account, Identity, Investment, Loan, Paginado, Transaction};

const PLUGGY_API: &str = "https://api.pluggy.ai";
/// Pluggy retorna até 500 transações por página.
const PAGE_SIZE: u32 = 500;

// ─── Contas ───────────────────────────────────────────────────────────────────

/// Busca todas as contas bancárias e cartões de um Item.
pub async fn buscar_contas(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<Account>, AppError> {
    estado
        .com_retry(|api_key| {
            let item_id = item_id.to_string();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/accounts"))
                    .query(&[("itemId", &item_id)])
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET /accounts falhou: {e}")))?;

                checar_status_http(&resp, "/accounts").await?;

                resp.json::<Paginado<Account>>()
                    .await
                    .map(|p| p.results)
                    .map_err(|e| AppError::Integration(format!("JSON /accounts inválido: {e}")))
            }
        })
        .await
}

// ─── Transações (paginadas) ───────────────────────────────────────────────────

/// Busca transações de uma conta, desde `desde` (exclusive), com paginação completa.
/// Retorna todas as páginas concatenadas.
/// `desde`: se `None`, busca o histórico disponível (~12 meses).
pub async fn buscar_transacoes(
    estado: &EstadoAuth,
    account_id: &str,
    desde: Option<DateTime<Utc>>,
) -> Result<Vec<Transaction>, AppError> {
    let mut todas: Vec<Transaction> = Vec::new();
    let mut pagina = 1u32;

    loop {
        let lote = buscar_pagina_transacoes(estado, account_id, desde, pagina).await?;
        let total_paginas = lote.total_pages;
        todas.extend(lote.results);

        if pagina >= total_paginas || total_paginas == 0 {
            break;
        }
        pagina += 1;
    }

    Ok(todas)
}

async fn buscar_pagina_transacoes(
    estado: &EstadoAuth,
    account_id: &str,
    desde: Option<DateTime<Utc>>,
    pagina: u32,
) -> Result<Paginado<Transaction>, AppError> {
    estado
        .com_retry(|api_key| {
            let account_id = account_id.to_string();
            async move {
                let mut req = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/transactions"))
                    .query(&[
                        ("accountId", account_id.as_str()),
                        ("pageSize", &PAGE_SIZE.to_string()),
                        ("page", &pagina.to_string()),
                    ])
                    .header("X-API-KEY", &api_key);

                if let Some(data) = desde {
                    // Pluggy aceita ISO 8601 no parâmetro `from`
                    req = req.query(&[("from", data.format("%Y-%m-%d").to_string())]);
                }

                let resp = req
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET /transactions falhou: {e}")))?;

                checar_status_http(&resp, "/transactions").await?;

                resp.json::<Paginado<Transaction>>()
                    .await
                    .map_err(|e| {
                        AppError::Integration(format!("JSON /transactions inválido: {e}"))
                    })
            }
        })
        .await
}

// ─── Investimentos ────────────────────────────────────────────────────────────

/// Busca todos os investimentos de um Item.
pub async fn buscar_investimentos(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<Investment>, AppError> {
    estado
        .com_retry(|api_key| {
            let item_id = item_id.to_string();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/investments"))
                    .query(&[("itemId", &item_id)])
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET /investments falhou: {e}")))?;

                checar_status_http(&resp, "/investments").await?;

                resp.json::<Paginado<Investment>>()
                    .await
                    .map(|p| p.results)
                    .map_err(|e| {
                        AppError::Integration(format!("JSON /investments inválido: {e}"))
                    })
            }
        })
        .await
}

// ─── Identidade ───────────────────────────────────────────────────────────────

/// Busca dados de identidade do titular de um Item.
/// Usado no onboarding opcional — não é essencial ao fluxo de sync.
pub async fn buscar_identidade(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Identity, AppError> {
    estado
        .com_retry(|api_key| {
            let item_id = item_id.to_string();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/identity"))
                    .query(&[("itemId", &item_id)])
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET /identity falhou: {e}")))?;

                checar_status_http(&resp, "/identity").await?;

                resp.json::<Identity>()
                    .await
                    .map_err(|e| AppError::Integration(format!("JSON /identity inválido: {e}")))
            }
        })
        .await
}

// ─── Empréstimos ──────────────────────────────────────────────────────────────

/// Busca empréstimos e financiamentos de um Item.
/// Dados usados para reconciliar com `debts` no Quibo.
pub async fn buscar_emprestimos(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<Loan>, AppError> {
    estado
        .com_retry(|api_key| {
            let item_id = item_id.to_string();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/loans"))
                    .query(&[("itemId", &item_id)])
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET /loans falhou: {e}")))?;

                checar_status_http(&resp, "/loans").await?;

                resp.json::<Paginado<Loan>>()
                    .await
                    .map(|p| p.results)
                    .map_err(|e| AppError::Integration(format!("JSON /loans inválido: {e}")))
            }
        })
        .await
}
