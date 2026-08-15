use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::items::checar_status_http;
use super::models::{Paginado, PagamentoRecorrente, TransacaoEnriquecida};

const PLUGGY_API: &str = "https://api.pluggy.ai";

// ─── Pagamentos Recorrentes ───────────────────────────────────────────────────

/// Busca pagamentos recorrentes detectados pela Pluggy para uma conta.
/// Útil para alimentar o motor de insights (assinaturas, contas fixas).
/// Alimenta o estado "Apertado" com "N assinaturas somam R$ X".
pub async fn buscar_recorrentes(
    estado: &EstadoAuth,
    account_id: &str,
) -> Result<Vec<PagamentoRecorrente>, AppError> {
    estado
        .com_retry(|api_key| {
            let account_id = account_id.to_string();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}/recurring-payments"))
                    .query(&[("accountId", &account_id)])
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| {
                        AppError::Integration(format!("GET /recurring-payments falhou: {e}"))
                    })?;

                checar_status_http(&resp, "/recurring-payments").await?;

                resp.json::<Paginado<PagamentoRecorrente>>()
                    .await
                    .map(|p| p.results)
                    .map_err(|e| {
                        AppError::Integration(format!(
                            "JSON /recurring-payments inválido: {e}"
                        ))
                    })
            }
        })
        .await
}

/// Busca todos os pagamentos recorrentes de múltiplas contas e os agrega.
/// Entrada: lista de account_ids de contas bancárias (não cartão).
pub async fn buscar_recorrentes_de_contas(
    estado: &EstadoAuth,
    account_ids: &[String],
) -> Result<Vec<PagamentoRecorrente>, AppError> {
    let mut todos: Vec<PagamentoRecorrente> = Vec::new();

    for account_id in account_ids {
        match buscar_recorrentes(estado, account_id).await {
            Ok(recorrentes) => todos.extend(recorrentes),
            // Endpoint pode não estar disponível em todos os conectores; ignora graciosamente.
            Err(AppError::Integration(msg)) if msg.contains("404") => continue,
            Err(e) => return Err(e),
        }
    }

    Ok(todos)
}

// ─── Enriquecimento de Transação ─────────────────────────────────────────────

/// Enriquece uma transação com merchant, categoria e descrição melhorada.
/// Reduz trabalho manual de categorização no Gestão de Contabilidade.
pub async fn enriquecer_transacao(
    estado: &EstadoAuth,
    transaction_id: &str,
) -> Result<TransacaoEnriquecida, AppError> {
    let path = format!("/transactions/{transaction_id}/enriched");
    estado
        .com_retry(|api_key| {
            let path = path.clone();
            async move {
                let resp = reqwest::Client::new()
                    .get(format!("{PLUGGY_API}{path}"))
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| {
                        AppError::Integration(format!("GET {path} falhou: {e}"))
                    })?;

                checar_status_http(&resp, &path).await?;

                resp.json::<TransacaoEnriquecida>()
                    .await
                    .map_err(|e| AppError::Integration(format!("JSON {path} inválido: {e}")))
            }
        })
        .await
}

// ─── Soma para insights ───────────────────────────────────────────────────────

/// Calcula o total mensal dos pagamentos recorrentes em centavos.
/// Usado pelo motor de insights para calcular "N assinaturas = R$ X/mês".
pub fn total_recorrentes_centavos(recorrentes: &[PagamentoRecorrente]) -> i64 {
    recorrentes
        .iter()
        .map(|r| super::map::decimal_para_centavos(r.amount.abs()))
        .sum()
}
