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
  /** Imagem (data URL base64) opcional — avatar da persona. */
  avatar: text("avatar"),
  /** 1 = persona principal (o dono do app); sincroniza com o perfil e não pode ser excluída. */
  isSelf: integer("is_self").notNull().default(0),
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
export const accounts = sqliteTable(
  "accounts",
  {
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
    /** MANUAL | PLUGGY */
    source: text("source").notNull().default("MANUAL"),
    /** ID da conta na Pluggy (chave de idempotência) */
    pluggyId: text("pluggy_id"),
    pluggySyncedAt: text("pluggy_synced_at"),
    /** Payload JSON cru da Pluggy, exatamente como recebido. NULL = manual. */
    raw: text("raw"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqPluggy: uniqueIndex("uq_account_pluggy").on(t.pluggyId),
  })
);

// ─── Cartões de crédito ───────────────────────────────────────────────────────
export const creditCards = sqliteTable(
  "credit_cards",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** VISA | MASTERCARD | ELO | AMEX | HIPERCARD | DINERS | OTHER */
    brand: text("brand").notNull(),
    limitCents: integer("limit_cents").notNull(),
    closingDay: integer("closing_day").notNull(),
    dueDay: integer("due_day").notNull(),
    color: text("color").notNull().default("#4078E6"),
    isActive: integer("is_active").notNull().default(1),
    personaId: text("persona_id").references(() => personas.id, {
      onDelete: "set null",
    }),
    /** MANUAL | PLUGGY */
    source: text("source").notNull().default("MANUAL"),
    pluggyId: text("pluggy_id"),
    pluggySyncedAt: text("pluggy_synced_at"),
    /** Payload JSON cru da Pluggy, exatamente como recebido. NULL = manual. */
    raw: text("raw"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqPluggy: uniqueIndex("uq_card_pluggy").on(t.pluggyId),
  })
);

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
// Prefixos:  sal_ · lc_ · dbt_ · inv_
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
    isTemplate: integer("is_template").notNull().default(0),
    isRecurring: integer("is_recurring").notNull().default(0),
    recurrenceGroupId: text("recurrence_group_id"),

    // ── Anotações ─────────────────────────────────────────────────────────
    notes: text("notes"),
    tags: text("tags"),

    /** INCOME → modalidade da fonte de renda: PJ | CLT | OUTRO */
    incomeModality: text("income_modality"),

    // ── Origem do registro ────────────────────────────────────────────────
    /** MANUAL | PLUGGY */
    source: text("source").notNull().default("MANUAL"),
    /** ID da transação na Pluggy (chave de idempotência) */
    pluggyId: text("pluggy_id"),
    pluggySyncedAt: text("pluggy_synced_at"),
    /**
     * Status como o banco informa: POSTED (liquidada) | PENDING (autorizada,
     * fatura ainda aberta). Separado de `status`, que diz se o valor conta nos
     * totais — uma compra de cartão pendente conta, mas continua pendente.
     */
    pluggyStatus: text("pluggy_status"),
    /** Payload JSON cru da Pluggy, exatamente como recebido. NULL = manual. */
    raw: text("raw"),

    // ── SAL — SALARY ──────────────────────────────────────────────────────
    salCalculationType: text("sal_calculation_type"),
    salHourlyRateCents: integer("sal_hourly_rate_cents"),
    salHoursPerDay: real("sal_hours_per_day"),
    salWorkDays: text("sal_work_days"),
    salIncludeHolidays: integer("sal_include_holidays"),
    salPaymentDay: integer("sal_payment_day"),
    salPaymentOffset: integer("sal_payment_offset").default(1),

    // ── LC — LIVING_COST ──────────────────────────────────────────────────
    lcSourceType: text("lc_source_type"),
    lcDayOfMonth: integer("lc_day_of_month"),

    // ── DBT — DEBT / DEBT_INSTALLMENT ─────────────────────────────────────
    dbtSubType: text("dbt_sub_type"),
    dbtTotalCents: integer("dbt_total_cents"),
    dbtTotalInstallments: integer("dbt_total_installments"),
    dbtRemainingInstallments: integer("dbt_remaining_installments"),
    dbtInstallmentNumber: integer("dbt_installment_number"),
    dbtInstallmentDay: integer("dbt_installment_day"),
    dbtInterestRate: real("dbt_interest_rate"),

    // ── INV — INVESTMENT ──────────────────────────────────────────────────
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
    bySource: index("ix_tx_source").on(t.source),
    uqPluggy: uniqueIndex("uq_tx_pluggy").on(t.pluggyId),
  })
);

// ─── Integrações ──────────────────────────────────────────────────────────────
// Uma linha por serviço externo: Pluggy (bancos) ou IA (modelo por provedor).
export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    /** PLUGGY | AI */
    type: text("type").notNull(),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),

    // ── PLUGGY — banco conectado ──────────────────────────────────────────
    pluggyItemId: text("pluggy_item_id"),
    pluggyConnectorName: text("pluggy_connector_name"),
    pluggyConnectorId: integer("pluggy_connector_id"),
    /** PENDING | UPDATED | LOGIN_ERROR | WAITING_USER_INPUT | ERROR */
    pluggyStatus: text("pluggy_status"),
    pluggyExecutionStatus: text("pluggy_execution_status"),
    pluggyLastSyncedAt: text("pluggy_last_synced_at"),
    pluggyNextSyncAt: text("pluggy_next_sync_at"),
    pluggyErrorCode: text("pluggy_error_code"),
    pluggyErrorMessage: text("pluggy_error_message"),

    // ── AI — modelo de inteligência artificial ────────────────────────────
    /** ANTHROPIC | OPENAI | GOOGLE | OPENROUTER */
    aiProvider: text("ai_provider"),
    /** claude-sonnet | claude-haiku | gpt-4o | gemini-pro | ... */
    aiModel: text("ai_model"),
    /** rótulo de referência da chave no keychain do SO */
    aiKeyRef: text("ai_key_ref"),
    aiCanReadMonthly: integer("ai_can_read_monthly").notNull().default(1),
    aiCanUseLifeContext: integer("ai_can_use_life_context").notNull().default(1),
    aiNotifyNegativeBalance: integer("ai_notify_negative_balance").notNull().default(1),
    aiMonthlyEmailSummary: integer("ai_monthly_email_summary").notNull().default(0),
  },
  (t) => ({
    uqPluggyItem: uniqueIndex("uq_integration_pluggy_item").on(t.pluggyItemId),
    uqAiProvider: uniqueIndex("uq_integration_ai").on(t.aiProvider),
  })
);

// ─── Log de sincronizações ────────────────────────────────────────────────────
export const integrationSyncLog = sqliteTable(
  "integration_sync_log",
  {
    id: text("id").primaryKey(),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    syncedAt: text("synced_at").notNull(),
    /** SUCCESS | PARTIAL | ERROR | SKIPPED */
    status: text("status").notNull(),
    entriesImported: integer("entries_imported").notNull().default(0),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
  },
  (t) => ({
    byIntegration: index("ix_sync_log").on(t.integrationId, t.syncedAt),
  })
);

// ─── Configurações do app ─────────────────────────────────────────────────────
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── Módulo contábil — Empresas ───────────────────────────────────────────────
export const empresas = sqliteTable(
  "empresas",
  {
    id: text("id").primaryKey(),
    razaoSocial: text("razao_social").notNull(),
    nomeFantasia: text("nome_fantasia"),
    /** Só dígitos (14). */
    cnpj: text("cnpj").notNull(),
    inscricaoEstadual: text("inscricao_estadual"),
    inscricaoMunicipal: text("inscricao_municipal"),
    /** ISO YYYY-MM-DD */
    dataAbertura: text("data_abertura"),
    cnaePrincipal: text("cnae_principal"),
    /** JSON array serializado: string[] */
    cnaesSecundarios: text("cnaes_secundarios"),
    uf: text("uf"),
    municipio: text("municipio"),
    /** MEI | SIMPLES | PRESUMIDO | REAL */
    regimeTributario: text("regime_tributario").notNull(),
    /** Anexo do Simples (I–V); NULL fora do Simples */
    anexoSimples: text("anexo_simples"),
    /** Reforma tributária: REGULAR | SIMPLES_DAS | SIMPLES_HIBRIDO; NULL = não definida */
    regimeIbsCbs: text("regime_ibs_cbs"),
    /** Presunção do Lucro Presumido: COMERCIO_INDUSTRIA | TRANSPORTE_PASSAGEIROS | SERVICOS */
    atividadePresumido: text("atividade_presumido"),
    /** ATIVA | INATIVA | BAIXADA */
    status: text("status").notNull().default("ATIVA"),
    /** Flag declarativa para o motor de obrigações (Fase 2). */
    temFuncionarios: integer("tem_funcionarios").notNull().default(0),
    notes: text("notes"),
    archived: integer("archived").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqCnpj: uniqueIndex("uq_empresa_cnpj").on(t.cnpj),
  })
);

// ─── Módulo contábil — Sócios (cadastro global) ───────────────────────────────
export const socios = sqliteTable(
  "socios",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    /** Só dígitos (11). */
    cpf: text("cpf"),
    email: text("email"),
    telefone: text("telefone"),
    archived: integer("archived").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqCpf: uniqueIndex("uq_socio_cpf").on(t.cpf),
  })
);

// ─── Módulo contábil — Vínculo societário (N:N) ───────────────────────────────
export const empresaSocios = sqliteTable(
  "empresa_socios",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    socioId: text("socio_id")
      .notNull()
      .references(() => socios.id, { onDelete: "cascade" }),
    /** Participação societária em centésimos de % (5000 = 50,00%). */
    participacaoCentesimos: integer("participacao_centesimos").notNull().default(0),
    isAdministrador: integer("is_administrador").notNull().default(0),
    /** Pró-labore mensal em centavos; 0 = não retira pró-labore. */
    proLaboreCents: integer("pro_labore_cents").notNull().default(0),
    recebeDistribuicao: integer("recebe_distribuicao").notNull().default(1),
    dataEntrada: text("data_entrada"),
    /** Preenchida = sócio retirado da sociedade. */
    dataSaida: text("data_saida"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqEmpresaSocio: uniqueIndex("uq_empresa_socio").on(t.empresaId, t.socioId),
    byEmpresa: index("ix_empresa_socios_empresa").on(t.empresaId),
    bySocio: index("ix_empresa_socios_socio").on(t.socioId),
  })
);

// ─── Módulo contábil — Funcionários ───────────────────────────────────────────
export const funcionarios = sqliteTable(
  "funcionarios",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    /** Só dígitos (11). */
    cpf: text("cpf"),
    cargo: text("cargo"),
    /** CLT | ESTAGIO | APRENDIZ | TEMPORARIO | OUTRO */
    vinculo: text("vinculo").notNull().default("CLT"),
    salarioCents: integer("salario_cents").notNull().default(0),
    dataAdmissao: text("data_admissao"),
    /** Preenchida = desligado. */
    dataDemissao: text("data_demissao"),
    archived: integer("archived").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byEmpresa: index("ix_funcionarios_empresa").on(t.empresaId),
  })
);

// ─── Módulo contábil — Receitas mensais por empresa ───────────────────────────
export const empresaReceitas = sqliteTable(
  "empresa_receitas",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    mes: integer("mes").notNull(),
    ano: integer("ano").notNull(),
    receitaCents: integer("receita_cents").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqCompetencia: uniqueIndex("uq_empresa_receita").on(t.empresaId, t.mes, t.ano),
  })
);

// ─── Módulo contábil — Ocorrências de obrigações ──────────────────────────────
// O catálogo de obrigações vive em código (`src/consts/obrigacoes.ts`).
export const obrigacoesOcorrencias = sqliteTable(
  "obrigacoes_ocorrencias",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    /** Código do catálogo (ex.: 'DAS', 'PGDAS_D', 'ESOCIAL_FOLHA'). */
    obrigacaoCodigo: text("obrigacao_codigo").notNull(),
    /** Mensal = mês de apuração; trimestral = último mês do trimestre; anual = 12. */
    competenciaMes: integer("competencia_mes").notNull(),
    competenciaAno: integer("competencia_ano").notNull(),
    /** ISO YYYY-MM-DD, já ajustado para dia útil. */
    vencimento: text("vencimento").notNull(),
    /** PENDENTE | ENTREGUE | PAGA | DISPENSADA — "atrasada" é derivada. */
    status: text("status").notNull().default("PENDENTE"),
    /** Valor da guia em centavos, quando houver. */
    valorCents: integer("valor_cents"),
    concluidaEm: text("concluida_em"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uqOcorrencia: uniqueIndex("uq_obrigacao_ocorrencia").on(
      t.empresaId,
      t.obrigacaoCodigo,
      t.competenciaMes,
      t.competenciaAno
    ),
    byEmpresa: index("ix_obrigacoes_empresa").on(t.empresaId, t.vencimento),
  })
);

// ─── Módulo contábil — Obrigações desativadas por empresa ─────────────────────
export const obrigacoesDesativadas = sqliteTable("obrigacoes_desativadas", {
  empresaId: text("empresa_id")
    .notNull()
    .references(() => empresas.id, { onDelete: "cascade" }),
  obrigacaoCodigo: text("obrigacao_codigo").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Módulo contábil — Processos ──────────────────────────────────────────────
export const processos = sqliteTable(
  "processos",
  {
    id: text("id").primaryKey(),
    empresaId: text("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    /** ABERTURA | ALTERACAO | PARCELAMENTO | CERTIDAO | DEFESA | REGULARIZACAO | BAIXA | OUTRO */
    tipo: text("tipo").notNull(),
    descricao: text("descricao"),
    /** ISO YYYY-MM-DD, opcional. */
    prazo: text("prazo"),
    /** EM_ANDAMENTO | AGUARDANDO | CONCLUIDO | CANCELADO — "atrasado" é derivado. */
    status: text("status").notNull().default("EM_ANDAMENTO"),
    concluidoEm: text("concluido_em"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byEmpresa: index("ix_processos_empresa").on(t.empresaId, t.status),
  })
);

// ─── Módulo contábil — Etapas de processo (checklist) ─────────────────────────
export const processoEtapas = sqliteTable(
  "processo_etapas",
  {
    id: text("id").primaryKey(),
    processoId: text("processo_id")
      .notNull()
      .references(() => processos.id, { onDelete: "cascade" }),
    descricao: text("descricao").notNull(),
    ordem: integer("ordem").notNull().default(0),
    concluida: integer("concluida").notNull().default(0),
    concluidaEm: text("concluida_em"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byProcesso: index("ix_etapas_processo").on(t.processoId, t.ordem),
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

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;

export type IntegrationSyncLog = typeof integrationSyncLog.$inferSelect;
export type NewIntegrationSyncLog = typeof integrationSyncLog.$inferInsert;

export type EmpresaRowDrizzle = typeof empresas.$inferSelect;
export type NewEmpresa = typeof empresas.$inferInsert;

export type SocioRowDrizzle = typeof socios.$inferSelect;
export type NewSocio = typeof socios.$inferInsert;

export type EmpresaSocioRowDrizzle = typeof empresaSocios.$inferSelect;
export type NewEmpresaSocio = typeof empresaSocios.$inferInsert;

export type FuncionarioRowDrizzle = typeof funcionarios.$inferSelect;
export type NewFuncionario = typeof funcionarios.$inferInsert;
