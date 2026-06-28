// Ponto de entrada do binário Tauri.
// Toda a lógica está em lib.rs para permitir testes.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    quibo_lib::run();
}
