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
  /** auto-relação para categorias hierárquicas */
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
  /** mantido incrementalmente; recalculável do zero */
  balanceCents: integer("balance_cents").notNull().default(0),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  color: text("color").notNull().default("#4078E6"),
  icon: text("icon").notNull().default("building-bank"),
  isActive: integer("is_active").notNull().default(1),
  /** só uma conta primária por banco */
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

// ─── Faturas ──────────────────────────────────────────────────────────────────
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    creditCardId: text("credit_card_id")
      .notNull()
      .references(() => creditCards.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    paidAmountCents: integer("paid_amount_cents").notNull().default(0),
    /** PENDING | PAID | OVERDUE | PARTIAL */
    status: text("status").notNull().default("PENDING"),
    dueDate: text("due_date").notNull(),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqInvoice: uniqueIndex("uq_invoice").on(t.creditCardId, t.month, t.year),
  })
);

// ─── Salários / Receitas ─────────────────────────────────────────────────────
export const salaries = sqliteTable("salaries", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "restrict" }),
  personaId: text("persona_id").references(() => personas.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  /** FIXED | HOURLY */
  calculationType: text("calculation_type").notNull(),
  fixedAmountCents: integer("fixed_amount_cents"),
  hourlyRateCents: integer("hourly_rate_cents"),
  hoursPerDay: real("hours_per_day"),
  /** ALL_DAYS | WEEKDAYS | CUSTOM */
  workDays: text("work_days"),
  includeHolidays: integer("include_holidays").notNull().default(0),
  isRecurring: integer("is_recurring").notNull().default(1),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  paymentDay: integer("payment_day"),
  /** 0 = mesmo mês; 1 = mês seguinte (padrão CLT) */
  paymentOffsetMonths: integer("payment_offset_months").notNull().default(1),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Custos de vida ───────────────────────────────────────────────────────────
export const livingCosts = sqliteTable("living_costs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  /** ACCOUNT | CREDIT_CARD */
  sourceType: text("source_type").notNull(),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "restrict",
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
  dayOfMonth: integer("day_of_month").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Dívidas ─────────────────────────────────────────────────────────────────
export const debts = sqliteTable("debts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  /** INSTALLMENT | LOAN | PENDING | FLEXIBLE */
  type: text("type").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  installmentValueCents: integer("installment_value_cents"),
  paidAmountCents: integer("paid_amount_cents").notNull().default(0),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "restrict" }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  personaId: text("persona_id").references(() => personas.id, {
    onDelete: "set null",
  }),
  startDate: text("start_date").notNull(),
  dueDate: text("due_date"),
  totalInstallments: integer("total_installments"),
  remainingInstallments: integer("remaining_installments"),
  installmentDay: integer("installment_day"),
  /** ACTIVE | PAID_OFF | OVERDUE */
  status: text("status").notNull().default("ACTIVE"),
  /** % ao mês para juros de atraso */
  interestRate: real("interest_rate"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Parcelas de dívida ───────────────────────────────────────────────────────
export const debtInstallments = sqliteTable("debt_installments", {
  id: text("id").primaryKey(),
  debtId: text("debt_id")
    .notNull()
    .references(() => debts.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),
  /** PENDING | PAID | OVERDUE */
  status: text("status").notNull().default("PENDING"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Lançamentos (tabela central) ────────────────────────────────────────────
export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** INCOME | EXPENSE | TRANSFER */
    type: text("type").notNull(),
    /** PREVISTO | CONFIRMADO | CANCELADO */
    status: text("status").notNull().default("PREVISTO"),
    date: text("date").notNull(),
    confirmedAt: text("confirmed_at"),
    /** SET NULL — o histórico nunca se perde */
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
    /** SALARY | LIVING_COST | DEBT | CREDIT_CARD — qual compromisso gerou */
    commitmentKind: text("commitment_kind"),
    /** id do compromisso que gerou este entry */
    commitmentId: text("commitment_id"),
    /** parcela de dívida correspondente */
    installmentId: text("installment_id"),
    /** id da transação Pluggy — chave anti-duplicata */
    pluggyTransactionId: text("pluggy_transaction_id"),
    /** mês de competência (1–12) */
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    isRecurring: integer("is_recurring").notNull().default(0),
    recurrenceGroupId: text("recurrence_group_id"),
    notes: text("notes"),
    /** JSON array serializado: string[] */
    tags: text("tags"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byMonth: index("ix_entries_month").on(t.year, t.month),
    byAccount: index("ix_entries_account").on(t.accountId),
    byCard: index("ix_entries_card").on(t.creditCardId),
    byCategory: index("ix_entries_category").on(t.categoryId),
    byCommitment: index("ix_entries_commitment").on(
      t.commitmentKind,
      t.commitmentId
    ),
    uqPluggy: uniqueIndex("uq_entries_pluggy").on(t.pluggyTransactionId),
  })
);

// ─── Investimentos ────────────────────────────────────────────────────────────
export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** STOCK | CRYPTO | FIXED_INCOME | REAL_ESTATE | ETF | PENSION | OTHER */
  type: text("type").notNull(),
  ticker: text("ticker"),
  /** 8 casas decimais para cripto */
  quantity: real("quantity").notNull(),
  purchasePriceCents: integer("purchase_price_cents").notNull(),
  /** atualizado por cotação — valorAtual e lucro são derivados */
  currentPriceCents: integer("current_price_cents"),
  purchaseDate: text("purchase_date").notNull(),
  broker: text("broker"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Pluggy: conexões bancárias ───────────────────────────────────────────────
export const pluggyItems = sqliteTable(
  "pluggy_items",
  {
    id: text("id").primaryKey(),
    pluggyItemId: text("pluggy_item_id").notNull(),
    connectorName: text("connector_name"),
    status: text("status"),
    lastSyncedAt: text("last_synced_at"),
    /** mapeamento conta Pluggy → conta Quibo (JSON) */
    accountMapJson: text("account_map_json"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqItem: uniqueIndex("uq_pluggy_item").on(t.pluggyItemId),
  })
);

// ─── Metas (fora do v1, schema reservado) ─────────────────────────────────────
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

// ─── Controle de migrações ────────────────────────────────────────────────────
export const schemaMigrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});

// ─── Tipos derivados ──────────────────────────────────────────────────────────
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type CreditCard = typeof creditCards.$inferSelect;
export type NewCreditCard = typeof creditCards.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Salary = typeof salaries.$inferSelect;
export type NewSalary = typeof salaries.$inferInsert;

export type LivingCost = typeof livingCosts.$inferSelect;
export type NewLivingCost = typeof livingCosts.$inferInsert;

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

export type DebtInstallment = typeof debtInstallments.$inferSelect;
export type NewDebtInstallment = typeof debtInstallments.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type PluggyItem = typeof pluggyItems.$inferSelect;
export type NewPluggyItem = typeof pluggyItems.$inferInsert;
