use chrono::{DateTime, Utc};

use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::items::checar_status_http;
use super::models::{
    Account, Identity, Investment, Loan, Paginado, PaginadoCursor, Transaction,
};

const PLUGGY_API: &str = "https://api.pluggy.ai";

/// Converte uma lista de `Value` em pares `(T, Value)`, descartando os itens que
/// não desserializam para `T` — mantém o sync resiliente a campos novos/ausentes.
fn emparelhar_raw<T: serde::de::DeserializeOwned>(
    valores: Vec<serde_json::Value>,
) -> Vec<(T, serde_json::Value)> {
    valores
        .into_iter()
        .filter_map(|v| serde_json::from_value::<T>(v.clone()).ok().map(|t| (t, v)))
        .collect()
}

// ─── Contas ───────────────────────────────────────────────────────────────────

/// Busca todas as contas bancárias e cartões de um Item, com o JSON cru de cada
/// conta ao lado do modelo tipado (para persistir em `raw`).
pub async fn buscar_contas_raw(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<(Account, serde_json::Value)>, AppError> {
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

                let pagina = resp
                    .json::<Paginado<serde_json::Value>>()
                    .await
                    .map_err(|e| AppError::Integration(format!("JSON /accounts inválido: {e}")))?;

                Ok(emparelhar_raw::<Account>(pagina.results))
            }
        })
        .await
}

/// Busca todas as contas bancárias e cartões de um Item (somente tipado).
pub async fn buscar_contas(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<Account>, AppError> {
    Ok(buscar_contas_raw(estado, item_id)
        .await?
        .into_iter()
        .map(|(c, _)| c)
        .collect())
}

// ─── Transações (paginadas) ───────────────────────────────────────────────────

/// Busca transações de uma conta com o JSON cru de cada transação ao lado do
/// modelo tipado (para persistir em `raw`). Percorre todas as páginas do cursor.
/// `desde`: se `None`, busca o histórico disponível (~12 meses).
pub async fn buscar_transacoes_raw(
    estado: &EstadoAuth,
    account_id: &str,
    desde: Option<DateTime<Utc>>,
) -> Result<Vec<(Transaction, serde_json::Value)>, AppError> {
    let mut todas: Vec<(Transaction, serde_json::Value)> = Vec::new();
    let mut cursor: Option<String> = None;

    loop {
        let lote = buscar_pagina_transacoes(estado, account_id, desde, cursor.as_deref()).await?;
        todas.extend(emparelhar_raw::<Transaction>(lote.results));

        match lote.next.as_deref().and_then(extrair_cursor) {
            Some(proximo) => cursor = Some(proximo),
            None => break,
        }
    }

    Ok(todas)
}

/// A Pluggy devolve `next` como a URL completa da próxima página; o cursor é o
/// valor do parâmetro `after`. Retorna `None` se a URL não trouxer o parâmetro.
fn extrair_cursor(next: &str) -> Option<String> {
    let query = next.split_once('?').map(|(_, q)| q)?;
    query.split('&').find_map(|par| {
        par.strip_prefix("after=")
            .map(|v| percent_decode(v))
            .filter(|v| !v.is_empty())
    })
}

/// Decodifica percent-encoding em um valor de query string (`%XX` e `+`).
fn percent_decode(valor: &str) -> String {
    let bytes = valor.as_bytes();
    let mut saida = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
                match hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                    Some(b) => {
                        saida.push(b);
                        i += 3;
                    }
                    None => {
                        saida.push(bytes[i]);
                        i += 1;
                    }
                }
            }
            b'+' => {
                saida.push(b' ');
                i += 1;
            }
            b => {
                saida.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&saida).into_owned()
}

/// Busca transações de uma conta (somente tipado).
pub async fn buscar_transacoes(
    estado: &EstadoAuth,
    account_id: &str,
    desde: Option<DateTime<Utc>>,
) -> Result<Vec<Transaction>, AppError> {
    Ok(buscar_transacoes_raw(estado, account_id, desde)
        .await?
        .into_iter()
        .map(|(t, _)| t)
        .collect())
}

/// Uma página de `GET /v2/transactions`. O endpoint antigo (`/transactions`,
/// paginado por `page`/`pageSize`) foi descontinuado e responde 410.
/// A v2 não aceita parâmetro de tamanho de página — o servidor define o lote.
async fn buscar_pagina_transacoes(
    estado: &EstadoAuth,
    account_id: &str,
    desde: Option<DateTime<Utc>>,
    cursor: Option<&str>,
) -> Result<PaginadoCursor<serde_json::Value>, AppError> {
    estado
        .com_retry(|api_key| {
            let account_id = account_id.to_string();
            let cursor = cursor.map(str::to_string);
            async move {
                let mut req = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/v2/transactions"))
                    .query(&[("accountId", account_id.as_str())])
                    .header("X-API-KEY", &api_key);

                if let Some(data) = desde {
                    req = req.query(&[("dateFrom", data.format("%Y-%m-%d").to_string())]);
                }

                if let Some(ref c) = cursor {
                    req = req.query(&[("after", c.as_str())]);
                }

                let resp = req.send().await.map_err(|e| {
                    AppError::Integration(format!("GET /v2/transactions falhou: {e}"))
                })?;

                checar_status_http(&resp, "/v2/transactions").await?;

                resp.json::<PaginadoCursor<serde_json::Value>>()
                    .await
                    .map_err(|e| {
                        AppError::Integration(format!("JSON /v2/transactions inválido: {e}"))
                    })
            }
        })
        .await
}

// ─── Transação individual (JSON cru) ──────────────────────────────────────────

/// Busca UMA transação pelo ID e devolve o JSON exatamente como a Pluggy retorna
/// (sem mapear para os modelos internos). Usado para inspeção/cópia no extrato.
pub async fn buscar_transacao_raw(
    estado: &EstadoAuth,
    transaction_id: &str,
) -> Result<serde_json::Value, AppError> {
    let path = format!("/transactions/{transaction_id}");
    estado
        .com_retry(|api_key| {
            let path = path.clone();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}{path}"))
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("GET {path} falhou: {e}")))?;

                checar_status_http(&resp, &path).await?;

                resp.json::<serde_json::Value>()
                    .await
                    .map_err(|e| AppError::Integration(format!("JSON {path} inválido: {e}")))
            }
        })
        .await
}

// ─── Investimentos ────────────────────────────────────────────────────────────

/// Busca todos os investimentos de um Item com o JSON cru ao lado do tipado.
pub async fn buscar_investimentos_raw(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<(Investment, serde_json::Value)>, AppError> {
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

                let pagina = resp
                    .json::<Paginado<serde_json::Value>>()
                    .await
                    .map_err(|e| {
                        AppError::Integration(format!("JSON /investments inválido: {e}"))
                    })?;

                Ok(emparelhar_raw::<Investment>(pagina.results))
            }
        })
        .await
}

/// Busca todos os investimentos de um Item (somente tipado).
pub async fn buscar_investimentos(
    estado: &EstadoAuth,
    item_id: &str,
) -> Result<Vec<Investment>, AppError> {
    Ok(buscar_investimentos_raw(estado, item_id)
        .await?
        .into_iter()
        .map(|(i, _)| i)
        .collect())
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

#[cfg(test)]
mod testes {
    use super::extrair_cursor;

    #[test]
    fn extrai_cursor_da_url_next() {
        let next = "https://api.pluggy.ai/v2/transactions?accountId=abc&after=eyJpZCI6IjEyMyJ9";
        assert_eq!(extrair_cursor(next).as_deref(), Some("eyJpZCI6IjEyMyJ9"));
    }

    #[test]
    fn decodifica_percent_encoding_no_cursor() {
        let next = "https://api.pluggy.ai/v2/transactions?after=a%2Bb%3Dc&accountId=x";
        assert_eq!(extrair_cursor(next).as_deref(), Some("a+b=c"));
    }

    #[test]
    fn sem_parametro_after_encerra_a_paginacao() {
        assert_eq!(extrair_cursor("https://api.pluggy.ai/v2/transactions?accountId=x"), None);
        assert_eq!(extrair_cursor("https://api.pluggy.ai/v2/transactions"), None);
        assert_eq!(extrair_cursor("https://api.pluggy.ai/v2/transactions?after="), None);
    }
}
