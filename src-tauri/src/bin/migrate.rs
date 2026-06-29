// Binário utilitário: aplica as migrações pendentes no banco local SEM subir o
// app inteiro. Usado pelo `make migrate`.
//
//   cargo run --bin migrate -- "<caminho-do-banco.db>"
//
// As migrações já aplicadas (tabela schema_migrations) são puladas, então é
// seguro rodar quantas vezes quiser — não reseta nem apaga dados existentes.

use std::path::PathBuf;

fn main() {
    let Some(arg) = std::env::args().nth(1) else {
        eprintln!("Uso: migrate <caminho-do-banco.db>");
        std::process::exit(1);
    };

    let caminho = PathBuf::from(arg);

    match quibo_lib::db::migrar(&caminho) {
        Ok(()) => println!("[quibo] Migrações aplicadas em: {}", caminho.display()),
        Err(e) => {
            eprintln!("[quibo] Erro ao aplicar migrações: {e}");
            std::process::exit(1);
        }
    }
}
