-- Schema unificado do Gestão de Contabilidade
-- Em desenvolvimento: `make clear` reinicia o banco com este schema do zero.
-- Em produção: criar nova migração numerada; nunca editar este arquivo.

-- ── Personas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#4078E6',
  icon        TEXT NOT NULL DEFAULT 'user',
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ── Categorias ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE','TRANSFER')),
  color      TEXT NOT NULL DEFAULT '#4078E6',
  icon       TEXT NOT NULL DEFAULT 'tag',
  parent_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ── Contas ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK(type IN ('CHECKING','SAVINGS','INVESTMENT','CASH','OTHER')),
  bank                  TEXT,
  agency                TEXT,
  account_number        TEXT,
  balance_cents         INTEGER NOT NULL DEFAULT 0,
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  color                 TEXT NOT NULL DEFAULT '#4078E6',
  icon                  TEXT NOT NULL DEFAULT 'building-bank',
  is_active             INTEGER NOT NULL DEFAULT 1,
  is_primary            INTEGER NOT NULL DEFAULT 0,
  archived              INTEGER NOT NULL DEFAULT 0,
  persona_id            TEXT REFERENCES personas(id) ON DELETE SET NULL,

  -- origem do registro
  source           TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','PLUGGY')),
  pluggy_id        TEXT,   -- pluggy account_id (referência anti-duplicata)
  pluggy_synced_at TEXT,   -- último sync com a Pluggy

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_pluggy ON accounts(pluggy_id)
  WHERE pluggy_id IS NOT NULL;

-- ── Cartões de crédito ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  brand       TEXT NOT NULL CHECK(brand IN ('VISA','MASTERCARD','ELO','AMEX','HIPERCARD','DINERS','OTHER')),
  limit_cents INTEGER NOT NULL,
  closing_day INTEGER NOT NULL,
  due_day     INTEGER NOT NULL,
  color       TEXT NOT NULL DEFAULT '#4078E6',
  is_active   INTEGER NOT NULL DEFAULT 1,
  persona_id  TEXT REFERENCES personas(id) ON DELETE SET NULL,

  -- origem do registro
  source           TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','PLUGGY')),
  pluggy_id        TEXT,
  pluggy_synced_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_card_pluggy ON credit_cards(pluggy_id)
  WHERE pluggy_id IS NOT NULL;

-- ── Metas ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  description          TEXT,
  target_amount_cents  INTEGER NOT NULL,
  current_amount_cents INTEGER NOT NULL DEFAULT 0,
  deadline             TEXT,
  status               TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS','COMPLETED','CANCELLED')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

-- ── Transações (tabela central unificada) ─────────────────────────────────────
--
-- Discriminador `type`:
--   INCOME, EXPENSE, TRANSFER   — lançamentos manuais pontuais
--   SALARY                      — regra salarial (is_template=1) ou ocorrência gerada (0)
--   LIVING_COST                 — regra de custo fixo ou ocorrência gerada
--   DEBT                        — configuração de dívida (is_template=1)
--   DEBT_INSTALLMENT            — parcela de dívida (parent_id → DEBT)
--   INVOICE                     — fatura de cartão de crédito
--   INVESTMENT                  — investimento em carteira
--
-- Prefixos de colunas específicas por tipo:
--   sal_  → SALARY
--   lc_   → LIVING_COST
--   dbt_  → DEBT / DEBT_INSTALLMENT
--   inv_  → INVESTMENT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (

  -- ── Identidade ───────────────────────────────────────────────────────────
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL CHECK(type IN (
                'INCOME','EXPENSE','TRANSFER',
                'SALARY','LIVING_COST',
                'DEBT','DEBT_INSTALLMENT',
                'INVOICE',
                'INVESTMENT'
              )),
  status      TEXT NOT NULL DEFAULT 'PREVISTO' CHECK(status IN (
                'PREVISTO','CONFIRMADO','CANCELADO',
                'ATIVO','PAGO','VENCIDO','PARCIAL',
                'EM_PROGRESSO','CONCLUIDO'
              )),
  description TEXT NOT NULL,

  -- ── Valor ────────────────────────────────────────────────────────────────
  amount_cents INTEGER,
  due_date     TEXT,
  paid_at      TEXT,
  paid_cents   INTEGER,

  -- ── Competência ──────────────────────────────────────────────────────────
  date       TEXT,
  month      INTEGER,
  year       INTEGER,
  start_date TEXT,
  end_date   TEXT,

  -- ── Vínculos de domínio ──────────────────────────────────────────────────
  account_id     TEXT REFERENCES accounts(id)     ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id    TEXT REFERENCES categories(id)   ON DELETE SET NULL,
  persona_id     TEXT REFERENCES personas(id)     ON DELETE SET NULL,
  parent_id      TEXT REFERENCES transactions(id) ON DELETE SET NULL,

  -- ── Recorrência ──────────────────────────────────────────────────────────
  is_template         INTEGER NOT NULL DEFAULT 0,
  is_recurring        INTEGER NOT NULL DEFAULT 0,
  recurrence_group_id TEXT,

  -- ── Anotações ────────────────────────────────────────────────────────────
  notes TEXT,
  tags  TEXT,  -- JSON array serializado: string[]

  -- ── Origem do registro ───────────────────────────────────────────────────
  source           TEXT NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','PLUGGY')),
  pluggy_id        TEXT,   -- pluggy transaction_id (chave de idempotência)
  pluggy_synced_at TEXT,   -- quando foi sincronizado pela última vez

  -- ── SAL — campos exclusivos de SALARY ────────────────────────────────────
  sal_calculation_type  TEXT CHECK(sal_calculation_type IN ('FIXED','HOURLY')),
  sal_hourly_rate_cents INTEGER,
  sal_hours_per_day     REAL,
  sal_work_days         TEXT CHECK(sal_work_days IN ('ALL_DAYS','WEEKDAYS','CUSTOM')),
  sal_include_holidays  INTEGER,
  sal_payment_day       INTEGER,
  sal_payment_offset    INTEGER DEFAULT 1,

  -- ── LC — campos exclusivos de LIVING_COST ────────────────────────────────
  lc_source_type  TEXT CHECK(lc_source_type IN ('ACCOUNT','CREDIT_CARD')),
  lc_day_of_month INTEGER,

  -- ── DBT — campos de DEBT e DEBT_INSTALLMENT ──────────────────────────────
  dbt_sub_type               TEXT CHECK(dbt_sub_type IN ('INSTALLMENT','LOAN','PENDING','FLEXIBLE')),
  dbt_total_cents            INTEGER,
  dbt_total_installments     INTEGER,
  dbt_remaining_installments INTEGER,
  dbt_installment_number     INTEGER,
  dbt_installment_day        INTEGER,
  dbt_interest_rate          REAL,

  -- ── INV — campos exclusivos de INVESTMENT ────────────────────────────────
  inv_sub_type             TEXT CHECK(inv_sub_type IN ('STOCK','CRYPTO','FIXED_INCOME','REAL_ESTATE','ETF','PENSION','OTHER')),
  inv_ticker               TEXT,
  inv_quantity             REAL,
  inv_current_price_cents  INTEGER,
  inv_broker               TEXT,

  -- ── Auditoria ────────────────────────────────────────────────────────────
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX  IF NOT EXISTS ix_tx_type     ON transactions(type);
CREATE INDEX  IF NOT EXISTS ix_tx_month    ON transactions(year, month);
CREATE INDEX  IF NOT EXISTS ix_tx_account  ON transactions(account_id);
CREATE INDEX  IF NOT EXISTS ix_tx_card     ON transactions(credit_card_id);
CREATE INDEX  IF NOT EXISTS ix_tx_category ON transactions(category_id);
CREATE INDEX  IF NOT EXISTS ix_tx_parent   ON transactions(parent_id);
CREATE INDEX  IF NOT EXISTS ix_tx_template ON transactions(is_template, type);
CREATE INDEX  IF NOT EXISTS ix_tx_source   ON transactions(source);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_pluggy ON transactions(pluggy_id)
  WHERE pluggy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_invoice ON transactions(credit_card_id, month, year)
  WHERE type = 'INVOICE' AND credit_card_id IS NOT NULL;

-- ── Integrações ───────────────────────────────────────────────────────────────
--
-- Uma linha por serviço externo conectado.
-- type = 'PLUGGY' → banco conectado via Pluggy (uma linha por item)
-- type = 'AI'     → modelo de IA conectado (uma linha por provedor)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL CHECK(type IN ('PLUGGY','AI')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- ── PLUGGY — banco conectado ──────────────────────────────────────────────
  pluggy_item_id          TEXT,   -- item_id da Pluggy (autorização OAuth)
  pluggy_connector_name   TEXT,   -- nome legível do banco/instituição
  pluggy_connector_id     INTEGER,
  pluggy_status           TEXT,   -- PENDING | UPDATED | LOGIN_ERROR | WAITING_USER_INPUT | ERROR
  pluggy_execution_status TEXT,
  pluggy_last_synced_at   TEXT,
  pluggy_next_sync_at     TEXT,
  pluggy_error_code       TEXT,
  pluggy_error_message    TEXT,

  -- ── AI — modelo de inteligência artificial ────────────────────────────────
  ai_provider   TEXT,   -- ANTHROPIC | OPENAI | GOOGLE | OPENROUTER
  ai_model      TEXT,   -- claude-sonnet | claude-haiku | gpt-4o | gemini-pro | ...
  -- chave armazenada no keychain do SO; este campo guarda só o rótulo de referência
  ai_key_ref    TEXT,
  -- permissões concedidas ao modelo
  ai_can_read_monthly        INTEGER NOT NULL DEFAULT 1,  -- "Ler meu mês e gastos"
  ai_can_use_life_context    INTEGER NOT NULL DEFAULT 1,  -- "Usar meu contexto de vida"
  ai_notify_negative_balance INTEGER NOT NULL DEFAULT 1,  -- "Me avisar quando fechar no vermelho"
  ai_monthly_email_summary   INTEGER NOT NULL DEFAULT 0   -- "Resumo do mês no e-mail"
);

-- Um item Pluggy por pluggy_item_id (pode ter vários bancos conectados)
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_pluggy_item ON integrations(pluggy_item_id)
  WHERE pluggy_item_id IS NOT NULL;

-- Um modelo de IA por provedor
CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_ai ON integrations(ai_provider)
  WHERE type = 'AI' AND ai_provider IS NOT NULL;

-- ── Log de sincronizações (Pluggy) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_sync_log (
  id               TEXT PRIMARY KEY,
  integration_id   TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  synced_at        TEXT NOT NULL,
  status           TEXT NOT NULL CHECK(status IN ('SUCCESS','PARTIAL','ERROR','SKIPPED')),
  entries_imported INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  duration_ms      INTEGER
);

CREATE INDEX IF NOT EXISTS ix_sync_log ON integration_sync_log(integration_id, synced_at DESC);
