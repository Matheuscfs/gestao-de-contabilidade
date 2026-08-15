use crate::errors::AppError;

use super::auth::EstadoAuth;
use super::models::{Item, Paginado};

const PLUGGY_API: &str = "https://api.pluggy.ai";

/// Lista todos os Items vinculados às credenciais de desenvolvimento.
/// No Caminho B (MeuPluggy), cada Item corresponde a um banco autorizado.
pub async fn listar_items(estado: &EstadoAuth) -> Result<Vec<Item>, AppError> {
    estado
        .com_retry(|api_key| async move {
            let resp = reqwest::Client::new()
                .get(format!("{PLUGGY_API}/items"))
                .header("X-API-KEY", &api_key)
                .send()
                .await
                .map_err(|e| AppError::Integration(format!("GET /items falhou: {e}")))?;

            checar_status_http(&resp, "/items").await?;

            resp.json::<Paginado<Item>>()
                .await
                .map(|p| p.results)
                .map_err(|e| AppError::Integration(format!("JSON /items inválido: {e}")))
        })
        .await
}

/// Busca um Item pelo seu ID e retorna status + nextAutoSyncAt.
pub async fn buscar_item(estado: &EstadoAuth, item_id: &str) -> Result<Item, AppError> {
    let path = format!("/items/{item_id}");
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

                resp.json::<Item>()
                    .await
                    .map_err(|e| AppError::Integration(format!("JSON {path} inválido: {e}")))
            }
        })
        .await
}

/// Remove um Item — apaga a conexão e todos os dados associados na Pluggy.
/// O Quibo mantém os entries já importados localmente.
pub async fn deletar_item(estado: &EstadoAuth, item_id: &str) -> Result<(), AppError> {
    let path = format!("/items/{item_id}");
    estado
        .com_retry(|api_key| {
            let path = path.clone();
            async move {
                let resp = reqwest::Client::new()
                    .delete(format!("{PLUGGY_API}{path}"))
                    .header("X-API-KEY", &api_key)
                    .send()
                    .await
                    .map_err(|e| AppError::Integration(format!("DELETE {path} falhou: {e}")))?;

                checar_status_http(&resp, &path).await
            }
        })
        .await
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

/// Verifica o status HTTP e retorna erro descritivo (incluindo "401" para retry).
pub async fn checar_status_http(
    resp: &reqwest::Response,
    path: &str,
) -> Result<(), AppError> {
    let status = resp.status();
    if status.is_success() {
        return Ok(());
    }
    // "401" como string para que EstadoAuth::com_retry detecte e invalide o cache.
    if status.as_u16() == 401 {
        return Err(AppError::Integration("401".into()));
    }
    if status.as_u16() == 429 {
        return Err(AppError::Integration(
            "Limite de requisições Pluggy atingido. Tente mais tarde.".into(),
        ));
    }
    // 403 com credenciais válidas = o produto não está liberado para a aplicação.
    // Acontece com recursos de plano superior (recorrentes, enriquecimento).
    if status.as_u16() == 403 {
        return Err(AppError::Integration(format!(
            "A Pluggy não liberou {path} para a sua aplicação — \
             esse recurso costuma exigir um plano superior."
        )));
    }
    // 410 = endpoint descontinuado. Mensagem explícita para não virar um
    // "retornou 410" genérico: já perdemos tempo com isso em /transactions.
    if status.as_u16() == 410 {
        return Err(AppError::Integration(format!(
            "O endpoint {path} foi descontinuado pela Pluggy. \
             O Quibo precisa ser atualizado para a nova versão da API."
        )));
    }
    Err(AppError::Integration(format!(
        "Pluggy {path} retornou {status}"
    )))
}
