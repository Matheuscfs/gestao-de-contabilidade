import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

// ─── Personas ────────────────────────────────────────────────────────────────
export const personas = sqliteTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#4078E6"),
  icon: text("icon").notNull().default("user"),
  archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Categorias ──────────────────────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** INCOME | EXPENSE | TRANSFER */
  type: text("type").notNull(),
  color: text("color").notNull().default("#4078E6"),
  icon: text("icon").notNull().default("tag"),
  parentId: text("parent_id"),
  archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Contas ───────────────────────────────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** CHECKING | SAVINGS | INVESTMENT | CASH | OTHER */
  type: text("type").notNull(),
  bank: text("bank"),
  agency: text("agency"),
  accountNumber: text("account_number"),
  balanceCents: integer("balance_cents").notNull().default(0),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  color: text("color").notNull().default("#4078E6"),
  icon: text("icon").notNull().default("building-bank"),
  isActive: integer("is_active").notNull().default(1),
  isPrimary: integer("is_primary").notNull().default(0),
  archived: integer("archived").notNull().default(0),
  personaId: text("persona_id").references(() => personas.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Cartões de crédito ───────────────────────────────────────────────────────
export const creditCards = sqliteTable("credit_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** VISA | MASTERCARD | ELO | AMEX | HIPERCARD | DINERS | OTHER */
  brand: text("brand").notNull(),
  limitCents: integer("limit_cents").notNull(),
  /** dia de fechamento da fatura (1–31) */
  closingDay: integer("closing_day").notNull(),
  /** dia de vencimento da fatura (1–31) */
  dueDay: integer("due_day").notNull(),
  color: text("color").notNull().default("#4078E6"),
  isActive: integer("is_active").notNull().default(1),
  personaId: text("persona_id").references(() => personas.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Metas ────────────────────────────────────────────────────────────────────
export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  targetAmountCents: integer("target_amount_cents").notNull(),
  currentAmountCents: integer("current_amount_cents").notNull().default(0),
  deadline: text("deadline"),
  /** IN_PROGRESS | COMPLETED | CANCELLED */
  status: text("status").notNull().default("IN_PROGRESS"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Transações (tabela central unificada) ────────────────────────────────────
//
// Discriminador `type`:
//   INCOME, EXPENSE, TRANSFER   — lançamentos manuais pontuais
//   SALARY                      — regra salarial (isTemplate=1) ou ocorrência gerada (0)
//   LIVING_COST                 — regra de custo fixo ou ocorrência gerada
//   DEBT                        — configuração de dívida (isTemplate=1)
//   DEBT_INSTALLMENT            — parcela de dívida (parentId → DEBT)
//   INVOICE                     — fatura de cartão de crédito
//   INVESTMENT                  — investimento em carteira
//
// Prefixos de colunas específicas por tipo:
//   sal_  → SALARY
//   lc_   → LIVING_COST
//   dbt_  → DEBT / DEBT_INSTALLMENT
//   inv_  → INVESTMENT
// ─────────────────────────────────────────────────────────────────────────────
export const transactions = sqliteTable(
  "transactions",
  {
    // ── Identidade ────────────────────────────────────────────────────────
    id: text("id").primaryKey(),
    /** INCOME | EXPENSE | TRANSFER | SALARY | LIVING_COST | DEBT | DEBT_INSTALLMENT | INVOICE | INVESTMENT */
    type: text("type").notNull(),
    /** PREVISTO | CONFIRMADO | CANCELADO | ATIVO | PAGO | VENCIDO | PARCIAL | EM_PROGRESSO | CONCLUIDO */
    status: text("status").notNull().default("PREVISTO"),
    description: text("description").notNull(),

    // ── Valor ─────────────────────────────────────────────────────────────
    amountCents: integer("amount_cents"),
    dueDate: text("due_date"),
    paidAt: text("paid_at"),
    paidCents: integer("paid_cents"),

    // ── Competência ───────────────────────────────────────────────────────
    date: text("date"),
    month: integer("month"),
    year: integer("year"),
    startDate: text("start_date"),
    endDate: text("end_date"),

    // ── Vínculos de domínio ───────────────────────────────────────────────
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    creditCardId: text("credit_card_id").references(() => creditCards.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    personaId: text("persona_id").references(() => personas.id, {
      onDelete: "set null",
    }),
    /** DEBT_INSTALLMENT → DEBT pai; ocorrência → template */
    parentId: text("parent_id"),

    // ── Recorrência ───────────────────────────────────────────────────────
    /** 1 = regra/compromisso  ·  0 = ocorrência gerada */
    isTemplate: integer("is_template").notNull().default(0),
    isRecurring: integer("is_recurring").notNull().default(0),
    recurrenceGroupId: text("recurrence_group_id"),

    // ── Anotações ─────────────────────────────────────────────────────────
    notes: text("notes"),
    /** JSON array serializado: string[] */
    tags: text("tags"),

    // ── Pluggy ────────────────────────────────────────────────────────────
    pluggyTransactionId: text("pluggy_transaction_id"),
    pluggyAccountId: text("pluggy_account_id"),

    // ── SAL — SALARY ──────────────────────────────────────────────────────
    /** FIXED | HOURLY */
    salCalculationType: text("sal_calculation_type"),
    salHourlyRateCents: integer("sal_hourly_rate_cents"),
    salHoursPerDay: real("sal_hours_per_day"),
    /** ALL_DAYS | WEEKDAYS | CUSTOM */
    salWorkDays: text("sal_work_days"),
    salIncludeHolidays: integer("sal_include_holidays"),
    salPaymentDay: integer("sal_payment_day"),
    /** 0 = mesmo mês  ·  1 = mês seguinte (padrão CLT) */
    salPaymentOffset: integer("sal_payment_offset").default(1),

    // ── LC — LIVING_COST ──────────────────────────────────────────────────
    /** ACCOUNT | CREDIT_CARD */
    lcSourceType: text("lc_source_type"),
    lcDayOfMonth: integer("lc_day_of_month"),

    // ── DBT — DEBT / DEBT_INSTALLMENT ─────────────────────────────────────
    /** INSTALLMENT | LOAN | PENDING | FLEXIBLE */
    dbtSubType: text("dbt_sub_type"),
    dbtTotalCents: integer("dbt_total_cents"),
    dbtTotalInstallments: integer("dbt_total_installments"),
    dbtRemainingInstallments: integer("dbt_remaining_installments"),
    dbtInstallmentNumber: integer("dbt_installment_number"),
    dbtInstallmentDay: integer("dbt_installment_day"),
    dbtInterestRate: real("dbt_interest_rate"),

    // ── INV — INVESTMENT ──────────────────────────────────────────────────
    /** STOCK | CRYPTO | FIXED_INCOME | REAL_ESTATE | ETF | PENSION | OTHER */
    invSubType: text("inv_sub_type"),
    invTicker: text("inv_ticker"),
    invQuantity: real("inv_quantity"),
    invCurrentPriceCents: integer("inv_current_price_cents"),
    invBroker: text("inv_broker"),

    // ── Auditoria ─────────────────────────────────────────────────────────
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byType: index("ix_tx_type").on(t.type),
    byMonth: index("ix_tx_month").on(t.year, t.month),
    byAccount: index("ix_tx_account").on(t.accountId),
    byCard: index("ix_tx_card").on(t.creditCardId),
    byCategory: index("ix_tx_category").on(t.categoryId),
    byParent: index("ix_tx_parent").on(t.parentId),
    byTemplate: index("ix_tx_template").on(t.isTemplate, t.type),
    uqPluggy: uniqueIndex("uq_tx_pluggy").on(t.pluggyTransactionId),
  })
);

// ─── Pluggy: conexões (items) ─────────────────────────────────────────────────
export const pluggyItems = sqliteTable(
  "pluggy_items",
  {
    id: text("id").primaryKey(),
    pluggyItemId: text("pluggy_item_id").notNull(),
    connectorName: text("connector_name"),
    connectorId: integer("connector_id"),
    status: text("status"),
    executionStatus: text("execution_status"),
    lastSyncedAt: text("last_synced_at"),
    nextAutoSyncAt: text("next_auto_sync_at"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqItem: uniqueIndex("uq_pluggy_item").on(t.pluggyItemId),
  })
);

// ─── Pluggy: contas bancárias espelhadas ──────────────────────────────────────
export const pluggyAccounts = sqliteTable(
  "pluggy_accounts",
  {
    id: text("id").primaryKey(),
    pluggyAccountId: text("pluggy_account_id").notNull(),
    pluggyItemId: text("pluggy_item_id")
      .notNull()
      .references(() => pluggyItems.id, { onDelete: "cascade" }),
    /** BANK | CREDIT */
    type: text("type").notNull(),
    /** CHECKING_ACCOUNT | SAVINGS_ACCOUNT | CREDIT_CARD | INVESTMENT */
    subtype: text("subtype").notNull(),
    name: text("name").notNull(),
    number: text("number"),
    balanceCents: integer("balance_cents").notNull().default(0),
    owner: text("owner"),
    taxNumber: text("tax_number"),
    // campos de cartão
    brand: text("brand"),
    creditLimitCents: integer("credit_limit_cents"),
    creditAvailableCents: integer("credit_available_cents"),
    dueDate: text("due_date"),
    // vínculos com entidades locais
    localAccountId: text("local_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    localCardId: text("local_card_id").references(() => creditCards.id, {
      onDelete: "set null",
    }),
    syncedAt: text("synced_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqAccount: uniqueIndex("uq_pluggy_account").on(t.pluggyAccountId),
    byItem: index("ix_pluggy_acct_item").on(t.pluggyItemId),
  })
);

// ─── Pluggy: histórico de sincronizações ──────────────────────────────────────
export const pluggySyncLog = sqliteTable(
  "pluggy_sync_log",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => pluggyItems.id, { onDelete: "cascade" }),
    syncedAt: text("synced_at").notNull(),
    /** SUCCESS | PARTIAL | ERROR | SKIPPED */
    status: text("status").notNull(),
    entriesImported: integer("entries_imported").notNull().default(0),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
  },
  (t) => ({
    byItem: index("ix_sync_log_item").on(t.itemId, t.syncedAt),
  })
);

// ─── Controle de migrações ────────────────────────────────────────────────────
export const schemaMigrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});

// ─── Tipos derivados ──────────────────────────────────────────────────────────
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type PluggyItem = typeof pluggyItems.$inferSelect;
export type NewPluggyItem = typeof pluggyItems.$inferInsert;

export type PluggyAccount = typeof pluggyAccounts.$inferSelect;
export type NewPluggyAccount = typeof pluggyAccounts.$inferInsert;

export type PluggySyncLog = typeof pluggySyncLog.$inferSelect;
export type NewPluggySyncLog = typeof pluggySyncLog.$inferInsert;
