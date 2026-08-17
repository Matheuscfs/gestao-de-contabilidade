//! Consulta pública de CNPJ na BrasilAPI (espelho dos dados abertos da RFB).
//!
//! Mora no Rust por dois motivos: o CSP do webview bloqueia chamadas a hosts
//! externos, e é aqui que dá para distinguir "CNPJ não existe" de "a API está
//! fora do ar" — o usuário precisa saber a diferença antes de digitar tudo na
//! mão.
//!
//! O corpo volta cru para a UI: quem interpreta e mapeia para os campos da
//! empresa é o TypeScript (`src/core/ipc/cnpj.ts`), onde o mapeamento pode ser
//! testado sem rede. Mesmo arranjo de `pluggy_transacao_raw` e
//! `ai_interpretar_kanban`.

use crate::errors::AppError;

const BASE_URL: &str = "https://brasilapi.com.br/api/v1/cnpj";

/// Consulta o CNPJ e devolve o JSON cru da BrasilAPI.
///
/// `cnpj` pode vir formatado — os separadores são descartados aqui para a UI
/// não precisar se preocupar com isso.
#[tauri::command]
pub async fn consultar_cnpj(cnpj: String) -> Result<String, AppError> {
    let digitos: String = cnpj.chars().filter(|c| c.is_ascii_digit()).collect();
    if digitos.len() != 14 {
        return Err(AppError::Integration(
            "CNPJ precisa ter 14 dígitos.".to_string(),
        ));
    }

    let resposta = reqwest::Client::new()
        .get(format!("{BASE_URL}/{digitos}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            AppError::Integration(format!(
                "Não foi possível falar com a BrasilAPI — verifique a conexão. ({e})"
            ))
        })?;

    let status = resposta.status();
    if status.is_success() {
        return resposta
            .text()
            .await
            .map_err(|e| AppError::Integration(format!("Resposta ilegível da BrasilAPI: {e}")));
    }

    // A BrasilAPI responde 404 tanto para CNPJ inexistente quanto para CNPJ
    // que ainda não entrou no dump da Receita; a mensagem cobre os dois.
    Err(match status.as_u16() {
        404 => AppError::NotFound(
            "CNPJ não encontrado na base da Receita Federal.".to_string(),
        ),
        429 => AppError::Integration(
            "Muitas consultas seguidas — a BrasilAPI limitou o acesso. Tente de novo em alguns minutos."
                .to_string(),
        ),
        c => AppError::Integration(format!("A BrasilAPI respondeu com erro {c}.")),
    })
}
