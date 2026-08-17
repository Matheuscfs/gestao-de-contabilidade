/**
 * Ações do sistema operacional pedidas ao Rust.
 *
 * Abrir link mora aqui e não em `@tauri-apps/plugin-shell`: o backend registra
 * o `tauri_plugin_opener`, e a permissão concedida em `capabilities` é
 * `opener:allow-open-url`. Importar o plugin-shell no front compila e passa no
 * type-check, mas estoura em runtime — o plugin não existe do outro lado.
 */

import { invoke } from "@tauri-apps/api/core";

/** Abre a URL no navegador padrão do sistema. */
export async function abrirExterno(url: string): Promise<void> {
  await invoke("open_external", { url });
}
