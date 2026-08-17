# ─── Gestão de Contabilidade — Makefile ─────────────────────────────────────────────────────────
# Comandos disponíveis:
#   make dev      — inicia o app desktop com hot reload
#   make migrate  — aplica migrações pendentes no banco (sem resetar dados)
#   make importar — importa a planilha do escritório (PLANILHA=<arquivo.xlsx>)
#   make refresh  — atualiza e reinstala todas as dependências (yarn + Cargo)
#   make build    — builda o app para a plataforma atual (release)
#   make clear    — remove dependências, artefatos de build e banco de dados local

.PHONY: dev migrate importar refresh build clear

# ─── Cores para output legível ────────────────────────────────────────────────
RESET  := \033[0m
BOLD   := \033[1m
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m

# ─── Caminhos por SO ──────────────────────────────────────────────────────────
UNAME := $(shell uname -s)

# Espaços nos caminhos NÃO são escapados aqui — sempre use entre aspas ("$(DB_DIR)").
ifeq ($(UNAME), Darwin)
  DB_DIR      := $(HOME)/Library/Application Support/app.quibo
  WEBKIT_DIR  := $(HOME)/Library/WebKit/quibo
endif
ifeq ($(UNAME), Linux)
  DB_DIR      := $(HOME)/.local/share/app.quibo
  WEBKIT_DIR  := $(HOME)/.local/share/WebKit/quibo
endif
ifeq ($(OS), Windows_NT)
  DB_DIR      := $(APPDATA)\app.quibo
  WEBKIT_DIR  :=
endif

# Arquivo do banco SQLite (usado pelo `make migrate`).
DB_FILE := $(DB_DIR)/quibo.db

# ─── dev ──────────────────────────────────────────────────────────────────────
## Inicia o app desktop com hot reload (Vite + Tauri)
dev:
	@echo "$(CYAN)$(BOLD)▶ Iniciando Gestão de Contabilidade em modo desenvolvimento...$(RESET)"
	@yarn tauri dev

# ─── migrate ──────────────────────────────────────────────────────────────────
## Aplica as migrações pendentes no banco local, SEM resetar/apagar dados.
## Migrações já aplicadas são puladas (tabela schema_migrations), então é
## seguro rodar quantas vezes precisar.
migrate:
	@echo "$(CYAN)$(BOLD)▶ Aplicando migrações pendentes...$(RESET)"
	@echo "$(YELLOW)→ Banco: $(DB_FILE)$(RESET)"
	@cd src-tauri && cargo run --quiet --bin migrate -- "$(DB_FILE)"
	@echo "$(GREEN)$(BOLD)✓ Migrações aplicadas.$(RESET)"

# ─── importar ─────────────────────────────────────────────────────────────────
## Importa a planilha de controle do escritório para o banco local.
## É reexecutável: registros com chave natural (CNPJ, competência, protocolo…)
## são atualizados no lugar, e lançamentos já importados não são duplicados.
##
##   make importar PLANILHA="/caminho/PARALEGAL att.xlsx"
##   make importar PLANILHA="..." EXTRA=--dry-run
importar:
ifndef PLANILHA
	@echo "$(RED)Uso: make importar PLANILHA=\"/caminho/planilha.xlsx\"$(RESET)"
	@exit 1
endif
	@echo "$(CYAN)$(BOLD)▶ Importando planilha para o banco local...$(RESET)"
	@echo "$(YELLOW)→ Banco: $(DB_FILE)$(RESET)"
	@yarn importar:planilha --arquivo="$(PLANILHA)" --banco="$(DB_FILE)" $(EXTRA)

# ─── refresh ──────────────────────────────────────────────────────────────────
## Instala/sincroniza todas as dependências: yarn + Cargo
refresh:
	@echo "$(CYAN)$(BOLD)▶ Sincronizando dependências...$(RESET)"

	@echo ""
	@echo "$(YELLOW)→ yarn install...$(RESET)"
	@yarn install

	@echo ""
	@echo "$(YELLOW)→ cargo fetch...$(RESET)"
	@cd src-tauri && cargo fetch

	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Dependências sincronizadas.$(RESET)"

# ─── build ────────────────────────────────────────────────────────────────────
## Builda o app em modo release para a plataforma atual (macOS / Windows / Linux)
## Para builds multiplataforma use o workflow .github/workflows/release.yml (CI)
build:
	@echo "$(CYAN)$(BOLD)▶ Buildando Gestão de Contabilidade (release)...$(RESET)"
	@yarn tauri build
	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Build gerado em src-tauri/target/release/bundle/$(RESET)"

# ─── clear ────────────────────────────────────────────────────────────────────
## Remove node_modules, artefatos Cargo e o banco de dados local
clear:
	@echo "$(RED)$(BOLD)▶ Limpando o projeto...$(RESET)"

	@echo "$(YELLOW)→ Removendo node_modules...$(RESET)"
	@rm -rf node_modules

	@echo "$(YELLOW)→ Removendo artefatos Cargo (src-tauri/target)...$(RESET)"
	@rm -rf src-tauri/target

	@echo "$(YELLOW)→ Removendo banco de dados local ($(DB_DIR))...$(RESET)"
	@rm -rf "$(DB_DIR)"

	@echo "$(YELLOW)→ Removendo localStorage do WebView ($(WEBKIT_DIR))...$(RESET)"
	@if [ -n "$(WEBKIT_DIR)" ]; then rm -rf "$(WEBKIT_DIR)"; fi

	@echo ""
	@echo "$(GREEN)$(BOLD)✓ Projeto limpo. Rode $(RESET)$(BOLD)make refresh$(RESET)$(GREEN) para reinstalar as dependências.$(RESET)"
