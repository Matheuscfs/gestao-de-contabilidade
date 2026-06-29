pub mod ai;
pub mod commands;
pub mod db;
pub mod errors;
pub mod market;
pub mod pluggy;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Bloqueante de propósito: garante que as migrações terminem antes
            // do webview carregar e fazer qualquer chamada ao banco (sem corrida).
            // É rápido (SQLite local) e roda só uma vez na inicialização.
            if let Err(e) = tauri::async_runtime::block_on(db::inicializar(&app_handle)) {
                eprintln!("[quibo] Erro ao inicializar banco: {e}");
            }

            // Estado de auth do Pluggy precisa do handle para ler credenciais do banco.
            app.manage(pluggy::auth::EstadoAuth::novo(app_handle));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System
            commands::system::db_path,
            commands::system::open_external,
            commands::system::app_version,
            // Pluggy — credenciais
            commands::pluggy::pluggy_salvar_credenciais,
            commands::pluggy::pluggy_status_credenciais,
            commands::pluggy::pluggy_remover_credenciais,
            // Pluggy — items
            commands::pluggy::pluggy_listar_items,
            commands::pluggy::pluggy_descobrir_items,
            commands::pluggy::pluggy_registrar_item,
            commands::pluggy::pluggy_iniciar_conexao,
            commands::pluggy::pluggy_listar_contas_item,
            commands::pluggy::pluggy_salvar_mapeamento,
            commands::pluggy::pluggy_remover_item,
            commands::pluggy::pluggy_deletar_item_remoto,
            // Pluggy — sync
            commands::pluggy::pluggy_sincronizar_item,
            commands::pluggy::pluggy_sincronizar_todos,
            // Pluggy — intelligence
            commands::pluggy::pluggy_recorrentes,
            // IA — integração BYOK
            commands::ai::ai_verificar_chave,
            commands::ai::ai_obter_integracao,
            commands::ai::ai_salvar_integracao,
            commands::ai::ai_atualizar_modelo,
            commands::ai::ai_remover_integracao,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar o Quibo");
}
