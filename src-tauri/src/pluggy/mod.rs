/// Módulo Pluggy — engine de integração bancária via BYOK (Caminho B: MeuPluggy).
///
/// Arquitetura:
///   - `auth`         → credenciais no banco (app_settings) + cache de API Key (~2h)
///   - `models`       → tipos da API Pluggy (deserialização)
///   - `items`        → listar/consultar Items
///   - `products`     → contas, transações paginadas, investimentos, identidade, empréstimos
///   - `intelligence` → pagamentos recorrentes + enriquecimento de transações
///   - `map`          → Pluggy → Quibo (decimal→centavos, sinal→tipo)
///   - `categorias`   → de-para da taxonomia de categorias Pluggy → Quibo
///   - `sync`         → engine de polling idempotente alinhado ao nextAutoSyncAt
///
/// Estado Tauri registrado em lib.rs: `pluggy::auth::EstadoAuth`

pub mod auth;
pub mod categorias;
pub mod intelligence;
pub mod items;
pub mod map;
pub mod models;
pub mod products;
pub mod sync;
