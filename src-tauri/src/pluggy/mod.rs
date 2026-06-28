/// Módulo Pluggy — integração bancária via BYOK.
///
/// O CLIENT_ID/CLIENT_SECRET ficam no keychain (crate secrets).
/// A UI nunca recebe os segredos; só recebe o connect_token de escopo reduzido.
///
/// Fluxo:
///   UI → IPC → pluggy::create_connect_token()
///     → lê segredo do keychain
///     → POST /auth → API Key (em memória, ~2h)
///     → POST /connect_token → token curto (~30min)
///     → devolve só o token para a UI
///
/// Comandos IPC (a implementar em commands/pluggy.rs):
///   - pluggy_create_connect_token
///   - pluggy_sync_item
///   - pluggy_list_items
///   - pluggy_disconnect_item

pub mod auth;
