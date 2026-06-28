-- Schema unificado do Quibo
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
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

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
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

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
-- Discriminador: `type`
--   INCOME, EXPENSE, TRANSFER   — lançamentos manuais pontuais
--   SALARY                      — regra de salário (is_template=1) ou ocorrência gerada (is_template=0)
--   LIVING_COST                 — regra de custo fixo ou ocorrência gerada
--   DEBT                        — configuração de dívida (is_template=1)
--   DEBT_INSTALLMENT            — parcela de dívida (parent_id → DEBT)
--   INVOICE                     — fatura de cartão de crédito
--   INVESTMENT                  — investimento em carteira
--
-- Padrão de prefixos para colunas específicas de tipo:
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
  amount_cents INTEGER,         -- valor principal (centavos inteiros)
  due_date     TEXT,            -- vencimento (DEBT_INSTALLMENT, INVOICE, DEBT)
  paid_at      TEXT,            -- data do pagamento
  paid_cents   INTEGER,         -- valor pago (INVOICE parcial, DEBT)

  -- ── Competência ──────────────────────────────────────────────────────────
  date         TEXT,            -- data da ocorrência
  month        INTEGER,         -- mês de competência (1–12)
  year         INTEGER,         -- ano de competência
  start_date   TEXT,            -- início de validade de regras recorrentes
  end_date     TEXT,            -- fim de validade

  -- ── Vínculos de domínio ──────────────────────────────────────────────────
  account_id     TEXT REFERENCES accounts(id)     ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id    TEXT REFERENCES categories(id)   ON DELETE SET NULL,
  persona_id     TEXT REFERENCES personas(id)     ON DELETE SET NULL,
  parent_id      TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    -- DEBT_INSTALLMENT → aponta para DEBT pai
    -- Ocorrência de SALARY/LIVING_COST → aponta para o template

  -- ── Recorrência ──────────────────────────────────────────────────────────
  is_template         INTEGER NOT NULL DEFAULT 0,  -- 1=regra/compromisso · 0=ocorrência
  is_recurring        INTEGER NOT NULL DEFAULT 0,
  recurrence_group_id TEXT,

  -- ── Anotações ────────────────────────────────────────────────────────────
  notes TEXT,
  tags  TEXT,  -- JSON array serializado: string[]

  -- ── Pluggy (integração bancária) ─────────────────────────────────────────
  pluggy_transaction_id TEXT,   -- ID da transação na Pluggy (chave de idempotência)
  pluggy_account_id     TEXT,   -- qual conta Pluggy originou este lançamento

  -- ── SAL — campos exclusivos de SALARY ────────────────────────────────────
  sal_calculation_type  TEXT CHECK(sal_calculation_type IN ('FIXED','HOURLY')),
  sal_hourly_rate_cents INTEGER,
  sal_hours_per_day     REAL,
  sal_work_days         TEXT CHECK(sal_work_days IN ('ALL_DAYS','WEEKDAYS','CUSTOM')),
  sal_include_holidays  INTEGER,
  sal_payment_day       INTEGER,
  sal_payment_offset    INTEGER DEFAULT 1,  -- 0=mesmo mês · 1=mês seguinte (padrão CLT)

  -- ── LC — campos exclusivos de LIVING_COST ────────────────────────────────
  lc_source_type  TEXT CHECK(lc_source_type IN ('ACCOUNT','CREDIT_CARD')),
  lc_day_of_month INTEGER,

  -- ── DBT — campos de DEBT e DEBT_INSTALLMENT ──────────────────────────────
  dbt_sub_type               TEXT CHECK(dbt_sub_type IN ('INSTALLMENT','LOAN','PENDING','FLEXIBLE')),
  dbt_total_cents            INTEGER,   -- valor total da dívida
  dbt_total_installments     INTEGER,
  dbt_remaining_installments INTEGER,
  dbt_installment_number     INTEGER,   -- número desta parcela
  dbt_installment_day        INTEGER,   -- dia de vencimento das parcelas
  dbt_interest_rate          REAL,      -- % ao mês

  -- ── INV — campos exclusivos de INVESTMENT ────────────────────────────────
  inv_sub_type             TEXT CHECK(inv_sub_type IN ('STOCK','CRYPTO','FIXED_INCOME','REAL_ESTATE','ETF','PENSION','OTHER')),
  inv_ticker               TEXT,
  inv_quantity             REAL,
  inv_current_price_cents  INTEGER,  -- preço atual por unidade
  inv_broker               TEXT,

  -- ── Auditoria ────────────────────────────────────────────────────────────
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_tx_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS ix_tx_month    ON transactions(year, month);
CREATE INDEX IF NOT EXISTS ix_tx_account  ON transactions(account_id);
CREATE INDEX IF NOT EXISTS ix_tx_card     ON transactions(credit_card_id);
CREATE INDEX IF NOT EXISTS ix_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS ix_tx_parent   ON transactions(parent_id);
CREATE INDEX IF NOT EXISTS ix_tx_template ON transactions(is_template, type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_pluggy ON transactions(pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_invoice ON transactions(credit_card_id, month, year)
  WHERE type = 'INVOICE' AND credit_card_id IS NOT NULL;

-- ── Pluggy: conexões (items) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pluggy_items (
  id                TEXT PRIMARY KEY,
  pluggy_item_id    TEXT NOT NULL,
  connector_name    TEXT,
  connector_id      INTEGER,
  status            TEXT,
  execution_status  TEXT,
  last_synced_at    TEXT,
  next_auto_sync_at TEXT,
  error_code        TEXT,
  error_message     TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pluggy_item ON pluggy_items(pluggy_item_id);

-- ── Pluggy: contas bancárias espelhadas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pluggy_accounts (
  id                     TEXT PRIMARY KEY,
  pluggy_account_id      TEXT NOT NULL,
  pluggy_item_id         TEXT NOT NULL REFERENCES pluggy_items(id) ON DELETE CASCADE,
  type                   TEXT NOT NULL,  -- BANK | CREDIT
  subtype                TEXT NOT NULL,  -- CHECKING_ACCOUNT | SAVINGS_ACCOUNT | CREDIT_CARD | INVESTMENT
  name                   TEXT NOT NULL,
  number                 TEXT,
  balance_cents          INTEGER NOT NULL DEFAULT 0,
  owner                  TEXT,
  tax_number             TEXT,
  -- campos de cartão (preenchidos quando subtype = CREDIT_CARD)
  brand                  TEXT,
  credit_limit_cents     INTEGER,
  credit_available_cents INTEGER,
  due_date               TEXT,
  -- vínculos com entidades locais do Quibo
  local_account_id       TEXT REFERENCES accounts(id)     ON DELETE SET NULL,
  local_card_id          TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  synced_at              TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pluggy_account   ON pluggy_accounts(pluggy_account_id);
CREATE INDEX        IF NOT EXISTS ix_pluggy_acct_item ON pluggy_accounts(pluggy_item_id);

-- ── Pluggy: histórico de sincronizações ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pluggy_sync_log (
  id               TEXT PRIMARY KEY,
  item_id          TEXT NOT NULL REFERENCES pluggy_items(id) ON DELETE CASCADE,
  synced_at        TEXT NOT NULL,
  status           TEXT NOT NULL CHECK(status IN ('SUCCESS','PARTIAL','ERROR','SKIPPED')),
  entries_imported INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  duration_ms      INTEGER
);

CREATE INDEX IF NOT EXISTS ix_sync_log_item ON pluggy_sync_log(item_id, synced_at DESC);
