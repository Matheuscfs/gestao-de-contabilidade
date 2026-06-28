-- Migração 0001 — Schema inicial do Quibo
-- Gerada manualmente, embarcada no binário Tauri.
-- Regra: nunca editar após publicação. Criar 0002 para mudanças.

-- ── Personas ─────────────────────────────────────────────────────────────────
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
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL CHECK(type IN ('CHECKING','SAVINGS','INVESTMENT','CASH','OTHER')),
  bank                   TEXT,
  agency                 TEXT,
  account_number         TEXT,
  balance_cents          INTEGER NOT NULL DEFAULT 0,
  initial_balance_cents  INTEGER NOT NULL DEFAULT 0,
  color                  TEXT NOT NULL DEFAULT '#4078E6',
  icon                   TEXT NOT NULL DEFAULT 'building-bank',
  is_active              INTEGER NOT NULL DEFAULT 1,
  is_primary             INTEGER NOT NULL DEFAULT 0,
  archived               INTEGER NOT NULL DEFAULT 0,
  persona_id             TEXT REFERENCES personas(id) ON DELETE SET NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
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

-- ── Faturas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  TEXT PRIMARY KEY,
  credit_card_id      TEXT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  month               INTEGER NOT NULL,
  year                INTEGER NOT NULL,
  total_amount_cents  INTEGER NOT NULL,
  paid_amount_cents   INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','OVERDUE','PARTIAL')),
  due_date            TEXT NOT NULL,
  paid_at             TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE(credit_card_id, month, year)
);

-- ── Salários / Receitas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salaries (
  id                      TEXT PRIMARY KEY,
  account_id              TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  persona_id              TEXT REFERENCES personas(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  description             TEXT,
  calculation_type        TEXT NOT NULL CHECK(calculation_type IN ('FIXED','HOURLY')),
  fixed_amount_cents      INTEGER,
  hourly_rate_cents       INTEGER,
  hours_per_day           REAL,
  work_days               TEXT CHECK(work_days IN ('ALL_DAYS','WEEKDAYS','CUSTOM')),
  include_holidays        INTEGER NOT NULL DEFAULT 0,
  is_recurring            INTEGER NOT NULL DEFAULT 1,
  start_date              TEXT NOT NULL,
  end_date                TEXT,
  payment_day             INTEGER,
  payment_offset_months   INTEGER NOT NULL DEFAULT 1,
  is_active               INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

-- ── Custos de vida ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS living_costs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  amount_cents    INTEGER NOT NULL,
  source_type     TEXT NOT NULL CHECK(source_type IN ('ACCOUNT','CREDIT_CARD')),
  account_id      TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
  credit_card_id  TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
  persona_id      TEXT REFERENCES personas(id) ON DELETE SET NULL,
  day_of_month    INTEGER NOT NULL,
  start_date      TEXT,
  end_date        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- ── Dívidas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  description               TEXT,
  type                      TEXT NOT NULL CHECK(type IN ('INSTALLMENT','LOAN','PENDING','FLEXIBLE')),
  total_amount_cents        INTEGER NOT NULL,
  installment_value_cents   INTEGER,
  paid_amount_cents         INTEGER NOT NULL DEFAULT 0,
  account_id                TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id               TEXT REFERENCES categories(id) ON DELETE SET NULL,
  persona_id                TEXT REFERENCES personas(id) ON DELETE SET NULL,
  start_date                TEXT NOT NULL,
  due_date                  TEXT,
  total_installments        INTEGER,
  remaining_installments    INTEGER,
  installment_day           INTEGER,
  status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAID_OFF','OVERDUE')),
  interest_rate             REAL,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

-- ── Parcelas de dívida ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_installments (
  id          TEXT PRIMARY KEY,
  debt_id     TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date    TEXT NOT NULL,
  paid_date   TEXT,
  status      TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','OVERDUE')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_installments_debt ON debt_installments(debt_id, status);

-- ── Lançamentos (tabela central) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entries (
  id                    TEXT PRIMARY KEY,
  description           TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  type                  TEXT NOT NULL CHECK(type IN ('INCOME','EXPENSE','TRANSFER')),
  status                TEXT NOT NULL DEFAULT 'PREVISTO' CHECK(status IN ('PREVISTO','CONFIRMADO','CANCELADO')),
  date                  TEXT NOT NULL,
  confirmed_at          TEXT,
  account_id            TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  credit_card_id        TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  category_id           TEXT REFERENCES categories(id) ON DELETE SET NULL,
  persona_id            TEXT REFERENCES personas(id) ON DELETE SET NULL,
  commitment_kind       TEXT CHECK(commitment_kind IN ('SALARY','LIVING_COST','DEBT','CREDIT_CARD')),
  commitment_id         TEXT,
  installment_id        TEXT,
  pluggy_transaction_id TEXT,
  month                 INTEGER NOT NULL,
  year                  INTEGER NOT NULL,
  is_recurring          INTEGER NOT NULL DEFAULT 0,
  recurrence_group_id   TEXT,
  notes                 TEXT,
  tags                  TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_entries_month      ON entries(year, month);
CREATE INDEX IF NOT EXISTS ix_entries_account    ON entries(account_id);
CREATE INDEX IF NOT EXISTS ix_entries_card       ON entries(credit_card_id);
CREATE INDEX IF NOT EXISTS ix_entries_category   ON entries(category_id);
CREATE INDEX IF NOT EXISTS ix_entries_commitment ON entries(commitment_kind, commitment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entries_pluggy ON entries(pluggy_transaction_id)
  WHERE pluggy_transaction_id IS NOT NULL;

-- ── Investimentos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK(type IN ('STOCK','CRYPTO','FIXED_INCOME','REAL_ESTATE','ETF','PENSION','OTHER')),
  ticker                TEXT,
  quantity              REAL NOT NULL,
  purchase_price_cents  INTEGER NOT NULL,
  current_price_cents   INTEGER,
  purchase_date         TEXT NOT NULL,
  broker                TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

-- ── Conexões Pluggy ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pluggy_items (
  id                TEXT PRIMARY KEY,
  pluggy_item_id    TEXT NOT NULL,
  connector_name    TEXT,
  status            TEXT,
  last_synced_at    TEXT,
  account_map_json  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pluggy_item ON pluggy_items(pluggy_item_id);

-- ── Metas (reservado para versão futura) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  description           TEXT,
  target_amount_cents   INTEGER NOT NULL,
  current_amount_cents  INTEGER NOT NULL DEFAULT 0,
  deadline              TEXT,
  status                TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS','COMPLETED','CANCELLED')),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
