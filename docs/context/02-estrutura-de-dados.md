# Gestão de Contabilidade — Estrutura de Dados

> Como o dado é modelado, armazenado e mantido íntegro. Define o modelo conceitual (compromisso × lançamento), o schema SQLite/Drizzle, as regras de integridade, os cálculos derivados e a reconciliação esperado×realizado. Pré-requisitos: [00 — Visão Geral](./00-visao-geral-produto.md) e [01 — Arquitetura](./01-arquitetura-desktop.md).

---

## Sumário

1. [Filosofia do modelo](#1-filosofia-do-modelo)
2. [O núcleo: Compromisso × Lançamento × Confirmação](#2-o-núcleo-compromisso--lançamento--confirmação)
3. [Convenções de dados](#3-convenções-de-dados)
4. [Entidades de domínio](#4-entidades-de-domínio)
5. [Entidades de suporte](#5-entidades-de-suporte)
6. [Dados da Pluggy](#6-dados-da-pluggy)
7. [Investimentos](#7-investimentos)
8. [Schema SQLite / Drizzle](#8-schema-sqlite--drizzle)
9. [Integridade referencial e deleção](#9-integridade-referencial-e-deleção)
10. [Índices](#10-índices)
11. [Cálculos derivados](#11-cálculos-derivados)
12. [Reconciliação esperado × realizado](#12-reconciliação-esperado--realizado)
13. [Migrações e versionamento](#13-migrações-e-versionamento)
14. [Queries-chave](#14-queries-chave)
15. [Seed e dados de exemplo](#15-seed-e-dados-de-exemplo)
16. [Decisões de modelagem](#16-decisões-de-modelagem)

---

## 1. Filosofia do modelo

O sistema antigo do Gestão de Contabilidade tinha um problema central: **conceitos demais**. Onze entidades e, principalmente, **quatro formas diferentes de responder "isso está pago?"** — `Transaction.status`, `Invoice.status`, `DebtInstallment.status` e `MonthlyPaymentRecord.isPaid`. Os sintomas estavam documentados: lógica anti-duplicata na geração de transações, sincronização manual entre registro de pagamento e transação de fatura, limpeza manual de registros órfãos.

O novo modelo resolve isso com duas ideias:

### Ideia 1 — Esperado × Realizado

- **Compromisso** = o que *deveria* acontecer (recorrente, configurado uma vez).
- **Lançamento** = o que *de fato* aconteceu (movimento real ou planejado).

### Ideia 2 — Um estado de confirmação só

Em vez de quatro máquinas de estado, **uma**: cada item, num mês, está `previsto` ou `confirmado`. Isso unifica o gesto central do produto (P3) e elimina a dessincronização.

### O que se mantém da modelagem antiga (de propósito)

A decisão de produto **"separado pra criar, unificado pra usar"** (P5) significa que os domínios **continuam tendo tabelas próprias** — salário, custo de vida, dívida e cartão guardam seus campos específicos (cálculo horista, parcelas, ciclo de fatura). O que muda não é a separação de autoria; é a **unificação do consumo e do estado**. Cada domínio é um tipo de **compromisso**; todos projetam **lançamentos**; todos compartilham a mesma **confirmação**.

```
Autoria (separada)                 Consumo (unificado)
──────────────────                 ───────────────────
tabela salaries                    
tabela living_costs        ──────► entries (lançamentos)  ──► confirmações
tabela debts (+ installments)              │
tabela credit_cards (+ invoices)           └──► reconciliados com Pluggy
```

---

## 2. O núcleo: Compromisso × Lançamento × Confirmação

### 2.1 Compromisso (conceitual)

Não há **uma** tabela `commitment` genérica que apague os domínios — os domínios são os compromissos, cada um com sua tabela. Mas todos compartilham uma **interface conceitual**:

| Atributo conceitual | Significado |
|---|---|
| `kind` | SALARY \| LIVING_COST \| DEBT \| CREDIT_CARD |
| vigência | quando começa/termina a valer (start/end) |
| recorrência | mensal, com dia de referência |
| valor esperado | fixo ou calculado (horista, parcela, ciclo) |
| offset de pagamento | "recebo/pago no mês seguinte?" (convenção trabalho×pagamento explícita) |
| conta/cartão de origem | onde o dinheiro entra ou sai |

Um **resolver** (função de domínio) sabe, para qualquer compromisso e qualquer mês, calcular o **valor esperado** e a **data esperada** daquele mês.

### 2.2 Lançamento (`entry`)

A tabela unificada do "realizado". Substitui a antiga `Transaction` e absorve o papel de ocorrência mensal.

Um lançamento pode:

- ser **avulso** (gasto digitado, sem compromisso);
- ser a **ocorrência de um compromisso** num mês (gerada/derivada, com `commitmentRef`);
- ser **importado da Pluggy** (com `pluggyTransactionId`);
- ter tipo `INCOME | EXPENSE | TRANSFER`.

### 2.3 Confirmação

O estado `previsto → confirmado` vive **no próprio lançamento** (`status`/`confirmedAt`). Para compromissos que ainda não têm lançamento materializado num mês, há uma forma leve de marcar "feito" — mas, diferente do sistema antigo, ela **não é uma quarta entidade paralela**: a confirmação é sempre representada por um `entry` (mesmo que mínimo) ou pelo `status` do entry derivado. Isso elimina o `MonthlyPaymentRecord` órfão.

> Regra unificadora: **se algo pode estar "pago/recebido", isso é um `entry` com `status`.** Não há outra fonte de verdade de pagamento.

### 2.4 Diagrama do núcleo

```
              ┌───────────────────────────┐
              │       COMPROMISSOS        │   (esperado, recorrente)
              │  salaries | living_costs  │
              │  debts(+installments)     │
              │  credit_cards(+invoices)  │
              └─────────────┬─────────────┘
                            │ resolve(mês) → valor/data esperados
                            ▼
              ┌───────────────────────────┐
              │          ENTRIES          │   (realizado, 1 estado)
              │  type: INCOME/EXPENSE/...  │
              │  status: PREVISTO/CONFIRM. │
              │  commitmentRef? pluggyId?  │
              └─────────────┬─────────────┘
                            │ ajusta
                            ▼
              ┌───────────────────────────┐
              │         ACCOUNTS          │   (saldo real)
              └───────────────────────────┘
```

---

## 3. Convenções de dados

Convenções globais, aplicadas em todas as tabelas.

### 3.1 Dinheiro — inteiro de centavos (AD-3)

Todo valor monetário é **`INTEGER` em centavos** (`amountCents`), nunca float. `R$ 1.847,00` → `184700`. Motivo: ponto flutuante introduz erro (`0.1 + 0.2 = 0.30000000000000004`), inadmissível em finanças. A formatação para BRL acontece só na borda de exibição.

### 3.2 Datas

- Armazenadas como **`TEXT` ISO-8601** (`YYYY-MM-DD` para datas, `YYYY-MM-DDTHH:mm:ssZ` para timestamps), UTC.
- Cálculos de mês/ciclo usam date-fns na camada de domínio.
- Campos `month` (1–12) e `year` aparecem onde o agrupamento mensal é chave (faturas, confirmações).

### 3.3 IDs

- **UUID v4** em `TEXT` como PK de todas as entidades. Facilita futura sincronização (sem colisão entre máquinas) e import/export.

### 3.4 Enums

- SQLite não tem enum nativo → **`TEXT` com `CHECK`** e validação na aplicação (Drizzle/Zod). Lista canônica de valores documentada por tabela.

### 3.5 Flags e auditoria

- `isActive`, `archived` como `INTEGER` 0/1.
- `createdAt`, `updatedAt` em toda tabela (timestamp ISO).

### 3.6 Sem `userId` no v1 (mono-usuário local)

Como o banco é **de um usuário** (local-first), as tabelas **não precisam de `userId`** no v1 — o arquivo inteiro é do usuário. Mantém-se a coluna opcional `userId` reservada **apenas** se/quando multi-perfil local ou sync exigir; por ora, omitida para simplicidade. (Decisão revisável — ver §16.)

---

## 4. Entidades de domínio

### 4.1 Salário / Receita (`salaries`)

Fonte de renda. Fixo ou horista.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT (uuid) | PK |
| `accountId` | TEXT | FK conta (obrigatório, RESTRICT) |
| `personaId` | TEXT? | FK persona (SET NULL) |
| `name` | TEXT | "Salário CLT", "Freelance X" |
| `description` | TEXT? | |
| `calculationType` | TEXT | FIXED \| HOURLY |
| `fixedAmountCents` | INTEGER? | se FIXED |
| `hourlyRateCents` | INTEGER? | se HOURLY |
| `hoursPerDay` | REAL? | se HOURLY |
| `workDays` | TEXT? | ALL_DAYS \| WEEKDAYS \| CUSTOM |
| `includeHolidays` | INTEGER | 0/1 |
| `isRecurring` | INTEGER | 0/1, default 1 |
| `startDate` | TEXT | obrigatório |
| `endDate` | TEXT? | null = indefinido |
| `paymentDay` | INTEGER? | 1–31 |
| `paymentOffsetMonths` | INTEGER | **explicita "recebo no mês seguinte"** (default 1 para CLT); 0 = mesmo mês |
| `isActive` | INTEGER | 0/1 |

> O `paymentOffsetMonths` é a versão explícita e local da convenção "mês de trabalho × mês de pagamento". O resolver usa esse campo em vez de uma regra global invisível.

**Cálculo horista:** `valor = hourlyRate × hoursPerDay × diasTrabalhados(mês, workDays, includeHolidays)`. Os feriados BR (fixos + móveis) são calculados na camada de domínio (`lib/feriados`).

### 4.2 Custo de Vida (`living_costs`)

Despesa fixa recorrente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `name`, `description` | TEXT | |
| `amountCents` | INTEGER | > 0 |
| `sourceType` | TEXT | ACCOUNT \| CREDIT_CARD |
| `accountId` | TEXT? | obrigatório se ACCOUNT (RESTRICT) |
| `creditCardId` | TEXT? | obrigatório se CREDIT_CARD (SET NULL) |
| `categoryId` | TEXT? | SET NULL |
| `personaId` | TEXT? | SET NULL |
| `dayOfMonth` | INTEGER | 1–31 |
| `startDate` | TEXT? | |
| `endDate` | TEXT? | null = indefinido |
| `isActive` | INTEGER | 0/1 |

**Vigência ativa num mês M:** `isActive=1 AND (startDate IS NULL OR startDate <= fimDoMês) AND (endDate IS NULL OR endDate >= inícioDoMês)`.

### 4.3 Dívida (`debts`) + Parcelas (`debt_installments`)

Compromisso com terceiros. Quatro tipos.

**`debts`:**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `name`, `description` | TEXT | |
| `type` | TEXT | INSTALLMENT \| LOAN \| PENDING \| FLEXIBLE |
| `totalAmountCents` | INTEGER | > 0 |
| `installmentValueCents` | INTEGER? | se INSTALLMENT |
| `paidAmountCents` | INTEGER | default 0 |
| `accountId` | TEXT | RESTRICT |
| `categoryId` | TEXT? | SET NULL |
| `personaId` | TEXT? | SET NULL |
| `startDate` | TEXT | |
| `dueDate` | TEXT? | obrigatório p/ LOAN, PENDING |
| `totalInstallments` | INTEGER? | se INSTALLMENT |
| `remainingInstallments` | INTEGER? | se INSTALLMENT |
| `installmentDay` | INTEGER? | 1–31 |
| `status` | TEXT | ACTIVE \| PAID_OFF \| OVERDUE |
| `interestRate` | REAL? | % ao mês p/ juros de atraso |

**`debt_installments`:**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `debtId` | TEXT | FK (CASCADE) |
| `number` | INTEGER | 1,2,3... |
| `amountCents` | INTEGER | |
| `dueDate` | TEXT | |
| `paidDate` | TEXT? | |
| `status` | TEXT | PENDING \| PAID \| OVERDUE |

**Geração na criação (INSTALLMENT):** para `i` de 1 a `totalInstallments`, `dueDate_i = startDate + (i-1) meses no installmentDay`, status PENDING.

**Juros de atraso (no pagamento):** `mesesAtraso = max(1, ceil((paidDate - dueDate)/30))`; `multa = installmentValue × (interestRate/100) × mesesAtraso`.

**Sincronização na edição:** aumentou `totalInstallments` → cria no fim; diminuiu → remove do fim; mudou valor/dia → atualiza só as `PENDING`; `PAID` nunca muda.

### 4.4 Cartão (`credit_cards`) + Fatura (`invoices`)

**`credit_cards`:**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `name` | TEXT | |
| `brand` | TEXT | VISA \| MASTERCARD \| ELO \| AMEX \| HIPERCARD \| DINERS \| OTHER |
| `limitCents` | INTEGER | |
| `closingDay` | INTEGER | 1–31 (default 10 onde não especificado) |
| `dueDay` | INTEGER | 1–31 |
| `color` | TEXT | |
| `isActive` | INTEGER | 0/1 |
| `personaId` | TEXT? | SET NULL |

**`invoices`:** fatura mensal agregada (derivável, mas materializável).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `creditCardId` | TEXT | FK (CASCADE) |
| `month` | INTEGER | 1–12 |
| `year` | INTEGER | |
| `totalAmountCents` | INTEGER | |
| `paidAmountCents` | INTEGER | default 0 |
| `status` | TEXT | PENDING \| PAID \| OVERDUE \| PARTIAL |
| `dueDate` | TEXT | |
| `paidAt` | TEXT? | |
| | | UNIQUE(creditCardId, month, year) |

**Ciclo de fechamento ≠ mês civil:** com `closingDay=10`, a fatura de março cobre 11/02→10/03. O cálculo do total da fatura por ciclo é derivado dos `entries` do cartão naquela janela (ver §11).

> **Decisão de simplificação (vs sistema antigo):** no antigo, `Invoice` e transações de cartão coexistiam **sem sincronização** (fonte de bug). No Gestão de Contabilidade, a **fatura é preferencialmente derivada** dos entries do ciclo; `invoices` materializadas existem só quando o usuário quer registrar um total manual. A regra: derivar por padrão, materializar por exceção.

### 4.5 Lançamento (`entries`) — a tabela central

Substitui `Transaction` e unifica ocorrências e confirmação.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `description` | TEXT | |
| `amountCents` | INTEGER | > 0 |
| `type` | TEXT | INCOME \| EXPENSE \| TRANSFER |
| `status` | TEXT | **PREVISTO \| CONFIRMADO \| CANCELADO** |
| `date` | TEXT | data do movimento |
| `confirmedAt` | TEXT? | quando virou confirmado |
| `accountId` | TEXT? | SET NULL |
| `creditCardId` | TEXT? | SET NULL |
| `categoryId` | TEXT? | SET NULL |
| `personaId` | TEXT? | SET NULL |
| **`commitmentKind`** | TEXT? | SALARY \| LIVING_COST \| DEBT \| CREDIT_CARD — origem |
| **`commitmentId`** | TEXT? | id do compromisso que gerou |
| **`installmentId`** | TEXT? | parcela de dívida correspondente |
| **`pluggyTransactionId`** | TEXT? | id da transação Pluggy (anti-duplicata) |
| `month`, `year` | INTEGER | mês de competência (facilita agrupamento/confirmação) |
| `isRecurring` | INTEGER | 0/1 |
| `recurrenceGroupId` | TEXT? | agrupa instâncias |
| `notes` | TEXT? | |
| `tags` | TEXT? | JSON array serializado |

**Status unificado:**

| status | Significado |
|---|---|
| `PREVISTO` | esperado, ainda não confirmado (era "PENDING") |
| `CONFIRMADO` | recebido/pago de fato (era "PAID"/isPaid=true) |
| `CANCELADO` | desconsiderado |

**Impacto no saldo:** ao virar `CONFIRMADO` com `accountId` e sem `creditCardId`: `INCOME → saldo += amount`, `EXPENSE → saldo -= amount`. Entries de cartão **não** mexem no saldo da conta — só o pagamento da fatura (um entry EXPENSE em conta) mexe.

---

## 5. Entidades de suporte

### 5.1 Conta (`accounts`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `name` | TEXT | |
| `type` | TEXT | CHECKING \| SAVINGS \| INVESTMENT \| CASH \| OTHER |
| `bank`, `agency`, `accountNumber` | TEXT? | |
| `balanceCents` | INTEGER | saldo atual (mantido por entries CONFIRMADO) |
| `initialBalanceCents` | INTEGER | |
| `color`, `icon` | TEXT | |
| `isActive` | INTEGER | 0/1 |
| `isPrimary` | INTEGER | 0/1 — só uma primária |
| `archived` | INTEGER | 0/1 |
| `personaId` | TEXT? | SET NULL |

**Conta primária:** transações órfãs (sem conta nem cartão) recaem nela em projeções; faturas de cartão e custos de cartão também. Garantir no máximo uma `isPrimary=1`.

**Exclusão vs arquivamento:** com entries → arquiva; sem entries → exclui; com salário/custo/dívida vinculados → RESTRICT.

### 5.2 Persona (`personas`)

Contexto financeiro (Pessoal, PJ, Família). Vinculável (opcional, SET NULL) a quase tudo.

| Campo | Tipo |
|---|---|
| `id` | TEXT |
| `name`, `description` | TEXT |
| `color`, `icon` | TEXT |
| `archived` | INTEGER |

### 5.3 Categoria (`categories`)

Hierárquica (pai/filho via `parentId`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | |
| `name` | TEXT | |
| `type` | TEXT | INCOME \| EXPENSE \| TRANSFER |
| `color`, `icon` | TEXT | |
| `parentId` | TEXT? | auto-relação |
| `archived` | INTEGER | |

### 5.4 Metas (`goals`) e Planejamento/Orçamento (`plannings`, `budgets`)

Mantidos do schema, mas **fora do v1** (ver 00 §11). Modelados para quando entrarem:

- `goals`: `name`, `targetAmountCents`, `currentAmountCents`, `deadline`, `status` (IN_PROGRESS \| COMPLETED \| CANCELLED).
- `plannings`: período + `totalBudgetCents`.
- `budgets`: por categoria/mês/ano, `amountCents` vs `spentCents`. UNIQUE(categoryId, month, year).

---

## 6. Dados da Pluggy

Quando o usuário conecta a Pluggy (documento 03), o app guarda referências locais às conexões e materializa transações como `entries`.

### 6.1 `pluggy_items` (conexões)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK local |
| `pluggyItemId` | TEXT | id do Item na Pluggy |
| `connectorName` | TEXT | nome do banco |
| `status` | TEXT | estado da conexão |
| `lastSyncedAt` | TEXT? | |
| `accountMapJson` | TEXT? | mapeamento conta Pluggy → conta Gestão de Contabilidade |

### 6.2 Transações importadas

Não há tabela separada de "transação Pluggy": elas viram **`entries`** com `pluggyTransactionId` preenchido (anti-duplicata por essa chave). Os campos enriquecidos da Pluggy (categoria, recorrência) populam `categoryId`/`tags` quando possível.

> A reconciliação (§12) tenta casar cada entry importado com um compromisso (ex.: o débito de R$ 1.500 = aluguel), evitando duplicar o "esperado" com o "realizado".

---

## 7. Investimentos

Modelado para o documento 05. Tabela `investments`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT | PK |
| `name` | TEXT | |
| `type` | TEXT | STOCK \| CRYPTO \| FIXED_INCOME \| REAL_ESTATE \| ETF \| PENSION \| OTHER |
| `ticker` | TEXT? | PETR4, BTC... |
| `quantity` | REAL | (8 casas para cripto) |
| `purchasePriceCents` | INTEGER | |
| `currentPriceCents` | INTEGER? | atualizado por cotação |
| `purchaseDate` | TEXT | |
| `broker` | TEXT? | |
| `notes` | TEXT? | |

Rentabilidade e valor de mercado são **derivados** (não armazenados): `valorAtual = quantity × currentPrice`; `lucro = valorAtual − (quantity × purchasePrice)`. Cotações vêm de provedor de mercado (doc 05) ou da Pluggy (cobertura de investimentos).

---

## 8. Schema SQLite / Drizzle

Esboço em Drizzle (TS). Ilustrativo — o schema canônico vive em `src/core/db/schema.ts`.

```ts
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // CHECKING|SAVINGS|INVESTMENT|CASH|OTHER
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
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const salaries = sqliteTable("salaries", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  calculationType: text("calculation_type").notNull(), // FIXED|HOURLY
  fixedAmountCents: integer("fixed_amount_cents"),
  hourlyRateCents: integer("hourly_rate_cents"),
  hoursPerDay: real("hours_per_day"),
  workDays: text("work_days"), // ALL_DAYS|WEEKDAYS|CUSTOM
  includeHolidays: integer("include_holidays").notNull().default(0),
  isRecurring: integer("is_recurring").notNull().default(1),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  paymentDay: integer("payment_day"),
  paymentOffsetMonths: integer("payment_offset_months").notNull().default(1),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const livingCosts = sqliteTable("living_costs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  sourceType: text("source_type").notNull(), // ACCOUNT|CREDIT_CARD
  accountId: text("account_id").references(() => accounts.id, { onDelete: "restrict" }),
  creditCardId: text("credit_card_id").references(() => creditCards.id, { onDelete: "set null" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  dayOfMonth: integer("day_of_month").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const creditCards = sqliteTable("credit_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  limitCents: integer("limit_cents").notNull(),
  closingDay: integer("closing_day").notNull(),
  dueDay: integer("due_day").notNull(),
  color: text("color").notNull().default("#4078E6"),
  isActive: integer("is_active").notNull().default(1),
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  creditCardId: text("credit_card_id").notNull().references(() => creditCards.id, { onDelete: "cascade" }),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  paidAmountCents: integer("paid_amount_cents").notNull().default(0),
  status: text("status").notNull().default("PENDING"),
  dueDate: text("due_date").notNull(),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({ uq: uniqueIndex("uq_invoice").on(t.creditCardId, t.month, t.year) }));

export const debts = sqliteTable("debts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // INSTALLMENT|LOAN|PENDING|FLEXIBLE
  totalAmountCents: integer("total_amount_cents").notNull(),
  installmentValueCents: integer("installment_value_cents"),
  paidAmountCents: integer("paid_amount_cents").notNull().default(0),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  startDate: text("start_date").notNull(),
  dueDate: text("due_date"),
  totalInstallments: integer("total_installments"),
  remainingInstallments: integer("remaining_installments"),
  installmentDay: integer("installment_day"),
  status: text("status").notNull().default("ACTIVE"),
  interestRate: real("interest_rate"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const debtInstallments = sqliteTable("debt_installments", {
  id: text("id").primaryKey(),
  debtId: text("debt_id").notNull().references(() => debts.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: text("due_date").notNull(),
  paidDate: text("paid_date"),
  status: text("status").notNull().default("PENDING"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(), // INCOME|EXPENSE|TRANSFER
  status: text("status").notNull().default("PREVISTO"), // PREVISTO|CONFIRMADO|CANCELADO
  date: text("date").notNull(),
  confirmedAt: text("confirmed_at"),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
  creditCardId: text("credit_card_id").references(() => creditCards.id, { onDelete: "set null" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  commitmentKind: text("commitment_kind"), // SALARY|LIVING_COST|DEBT|CREDIT_CARD
  commitmentId: text("commitment_id"),
  installmentId: text("installment_id"),
  pluggyTransactionId: text("pluggy_transaction_id"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  isRecurring: integer("is_recurring").notNull().default(0),
  recurrenceGroupId: text("recurrence_group_id"),
  notes: text("notes"),
  tags: text("tags"), // JSON array
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({
  byMonth: index("ix_entries_month").on(t.year, t.month),
  byAccount: index("ix_entries_account").on(t.accountId),
  byCard: index("ix_entries_card").on(t.creditCardId),
  byCommitment: index("ix_entries_commitment").on(t.commitmentKind, t.commitmentId),
  uqPluggy: uniqueIndex("uq_entries_pluggy").on(t.pluggyTransactionId),
}));

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

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  color: text("color").notNull().default("#4078E6"),
  icon: text("icon").notNull().default("tag"),
  parentId: text("parent_id"),
  archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const investments = sqliteTable("investments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  ticker: text("ticker"),
  quantity: real("quantity").notNull(),
  purchasePriceCents: integer("purchase_price_cents").notNull(),
  currentPriceCents: integer("current_price_cents"),
  purchaseDate: text("purchase_date").notNull(),
  broker: text("broker"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pluggyItems = sqliteTable("pluggy_items", {
  id: text("id").primaryKey(),
  pluggyItemId: text("pluggy_item_id").notNull(),
  connectorName: text("connector_name"),
  status: text("status"),
  lastSyncedAt: text("last_synced_at"),
  accountMapJson: text("account_map_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => ({ uqItem: uniqueIndex("uq_pluggy_item").on(t.pluggyItemId) }));

export const schemaMigrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});
```

---

## 9. Integridade referencial e deleção

SQLite só aplica FKs com `PRAGMA foreign_keys = ON` (ligado no bootstrap — ver doc 01 §7). Políticas:

| Relação | Política | Racional |
|---|---|---|
| account ← salary/livingCost(ACCOUNT)/debt | **RESTRICT** | não excluir conta que sustenta compromissos |
| persona ← (tudo) | **SET NULL** | arquivar persona não deve apagar registros |
| category ← entry/livingCost/debt | **SET NULL** | preservar histórico |
| creditCard ← invoice | **CASCADE** | fatura não existe sem cartão |
| creditCard ← entry/livingCost | **SET NULL** | preservar histórico de compras |
| debt ← debtInstallment | **CASCADE** | parcela não existe sem dívida |
| account/card/category/persona ← entry | **SET NULL** | **o histórico de lançamentos nunca se perde** |

> Princípio geral: **lançamento (entry) é sagrado.** Excluir qualquer entidade vinculada nunca apaga um entry — no máximo zera a referência. Isso elimina a perda de histórico.

### Limpeza polimórfica

Como `entries` referenciam compromissos por `(commitmentKind, commitmentId)` sem FK formal (polimórfico), ao excluir um compromisso, a lógica de aplicação deve decidir: manter os entries já confirmados (histórico real) e remover/desvincular os apenas previstos. Diferente do sistema antigo, **não há registros de pagamento órfãos** — porque não existe `MonthlyPaymentRecord`.

---

## 10. Índices

Índices nas colunas mais quentes (filtro por mês e por vínculo):

```sql
CREATE INDEX ix_entries_month     ON entries(year, month);
CREATE INDEX ix_entries_account   ON entries(account_id);
CREATE INDEX ix_entries_card      ON entries(credit_card_id);
CREATE INDEX ix_entries_category  ON entries(category_id);
CREATE INDEX ix_entries_commitment ON entries(commitment_kind, commitment_id);
CREATE UNIQUE INDEX uq_entries_pluggy ON entries(pluggy_transaction_id) WHERE pluggy_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX uq_invoice    ON invoices(credit_card_id, month, year);
CREATE INDEX ix_installments_debt ON debt_installments(debt_id, status);
```

O índice **parcial único** em `pluggy_transaction_id` é a defesa anti-duplicata da importação: a mesma transação Pluggy nunca entra duas vezes.

---

## 11. Cálculos derivados

Funções puras na camada de domínio (`src/core/domain`). **Nunca** delegadas à IA (P8).

### 11.1 Sobra do mês

```
receita(M)  = Σ valor esperado dos salários ativos no mês de trabalho (M − offset)
            (FIXED: fixedAmount; HOURLY: cálculo dinâmico)
despesa(M)  = Σ EXPENSE de entries sem cartão no mês
            + Σ faturas (derivadas) dos cartões no ciclo do mês
            + Σ custos de vida ativos no mês
            + Σ installmentValue das dívidas ACTIVE/OVERDUE INSTALLMENT no mês
sobra(M)    = receita(M) − despesa(M)
```

### 11.2 Estado do mês ("clima")

```
ratio = sobra / max(receita, 1)
estado =
  sobra < 0           → VERMELHO
  ratio < limiteBaixo → APERTADO
  senão               → SOBRA_BOA
```

(Os limites são configuráveis; ver documento 06.)

### 11.3 Ciclo de fatura do cartão

```
janela(mês, closingDay) = [ (closingDay do mês anterior)+1 , closingDay do mês ]
totalFatura(cartão, mês) = Σ amount de entries do cartão com date na janela
```

### 11.4 Saldo da conta

```
saldo = initialBalance
      + Σ INCOME CONFIRMADO da conta
      − Σ EXPENSE CONFIRMADO da conta
```

(mantido incrementalmente ao confirmar/desconfirmar entries; recalculável do zero para auto-correção).

### 11.5 Progresso de dívida

```
progresso = paidAmount / totalAmount
falta     = totalAmount − paidAmount
status    = paidAmount >= totalAmount → PAID_OFF
          | há parcela OVERDUE        → OVERDUE
          | senão                      → ACTIVE
```

### 11.6 Limite disponível do cartão

```
disponível = limit − Σ amount de entries PREVISTO do cartão
```

(só `PREVISTO` consome limite; `CONFIRMADO`/`CANCELADO` não.)

---

## 12. Reconciliação esperado × realizado

O coração que conecta cadastro manual e Pluggy.

### O problema

O usuário cadastra o **esperado** (aluguel R$ 1.500). A Pluggy traz o **realizado** (um débito de R$ 1.500 em 10/06). Sem reconciliação, o mês contaria os dois → dobro.

### O algoritmo (heurístico, determinístico)

Para cada entry importado da Pluggy ainda não reconciliado:

1. **Candidatos:** compromissos ativos no mês cujo valor esperado ≈ valor do entry (tolerância configurável), e cuja data esperada esteja próxima da data do entry.
2. **Pontuação:** combina proximidade de valor, proximidade de data, e match de descrição/categoria (a Pluggy enriquece com categoria).
3. **Decisão:**
   - Match forte → vincula o entry ao compromisso (`commitmentKind/Id`), marca como `CONFIRMADO`, e **não** cria um segundo entry "esperado".
   - Match fraco/ambíguo → deixa para o usuário confirmar (aparece em "Falta confirmar" com sugestão).
4. **Aprendizado leve:** lembrar mapeamentos confirmados pelo usuário (ex.: "débito X = aluguel") para acertar nos próximos meses.

> A IA pode **ajudar a explicar** uma sugestão ("isso parece seu aluguel porque..."), mas o **match e os números são determinísticos** (P8).

### Resultado

A home mostra o realizado quando existe (Pluggy), o esperado quando ainda não aconteceu, e nunca os dois somados. "Falta confirmar" vira só o que o sistema não conseguiu casar sozinho.

---

## 13. Migrações e versionamento

(Resumo; detalhe operacional no documento 01 §7.)

- Schema definido em Drizzle; migrações geradas pelo Drizzle Kit e embarcadas.
- `schema_migrations` guarda a versão; o app aplica as faltantes em transação na inicialização.
- **Backup do `.db` antes de migrar.**
- Migrações **idempotentes e imutáveis** após publicadas; sempre criar a próxima, nunca editar uma antiga.
- Migração marcante: `unify_confirmation_state` — converte qualquer estado herdado para o `status` único de `entries` e descarta a noção de `MonthlyPaymentRecord`.

---

## 14. Queries-chave

Exemplos conceituais (Drizzle/SQL) das consultas mais usadas.

**Lançamentos do mês (aba Transações, sem cartão):**

```sql
SELECT * FROM entries
WHERE year = :y AND month = :m
  AND credit_card_id IS NULL
  AND status != 'CANCELADO'
ORDER BY date DESC
LIMIT :limit OFFSET :offset;
```

**"Falta confirmar" do mês:**

```sql
SELECT * FROM entries
WHERE year = :y AND month = :m
  AND status = 'PREVISTO'
ORDER BY date ASC;
```

**Total da fatura por ciclo (cartão):**

```sql
SELECT COALESCE(SUM(amount_cents),0) AS total
FROM entries
WHERE credit_card_id = :card
  AND date > :cycleStart AND date <= :cycleEnd;
```

**Custos de vida ativos num mês:**

```sql
SELECT * FROM living_costs
WHERE is_active = 1
  AND (start_date IS NULL OR start_date <= :monthEnd)
  AND (end_date   IS NULL OR end_date   >= :monthStart);
```

**Parcelas a vencer no mês (dívidas INSTALLMENT):**

```sql
SELECT di.* FROM debt_installments di
JOIN debts d ON d.id = di.debt_id
WHERE d.type = 'INSTALLMENT' AND d.status IN ('ACTIVE','OVERDUE')
  AND strftime('%Y', di.due_date) = :y AND strftime('%m', di.due_date) = :m;
```

---

## 15. Seed e dados de exemplo

Para desenvolvimento e para a primeira execução (onboarding), um seed mínimo:

- 1 conta primária ("Conta corrente").
- Categorias básicas (Moradia, Mercado, Transporte, Lazer, Salário...).
- Personas opcionais (Pessoal).
- Exemplos opcionais (1 salário, 1 custo de vida, 1 cartão) que o usuário pode apagar.

O seed roda só em banco vazio (verifica `schema_migrations` + contagem). Nunca sobrescreve dados existentes.

---

## 16. Decisões de modelagem

| # | Decisão | Racional |
|---|---|---|
| DM-1 | Dinheiro em centavos inteiros | Evitar erro de float em finanças (AD-3) |
| DM-2 | `entries` unifica transação + ocorrência + confirmação | Eliminar as 4 fontes de "pago" do sistema antigo |
| DM-3 | Domínios mantêm tabelas próprias | "Separado pra criar" (P5); campos específicos têm casa |
| DM-4 | Fatura derivada por padrão, materializada por exceção | Eliminar dessincronização Invoice×Transaction |
| DM-5 | `paymentOffsetMonths` explícito | Tornar "trabalho×pagamento" local e visível, não mágica global |
| DM-6 | Sem `userId` no v1 | Banco mono-usuário local; coluna reservável para sync futuro |
| DM-7 | Reconciliação determinística, IA só explica | Confiança e privacidade (P8) |
| DM-8 | `pluggyTransactionId` único parcial | Anti-duplicata de importação no nível do banco |
| DM-9 | Entry é sagrado (SET NULL, nunca apaga) | Histórico financeiro nunca se perde |
| DM-10 | UUID como PK | Sync futuro sem colisão; export/import seguro |

---

*Fim do documento 02. Próximos (em entrega): 03 — Integração Pluggy, 04 — Integração IA (BYOK), 05 — Investimentos, 06 — Motor de Insights, 07 — Design/UX, 08 — Ideias & Roadmap. Anterior: [01 — Arquitetura](./01-arquitetura-desktop.md).*
