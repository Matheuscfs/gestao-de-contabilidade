# Quibo — Integração com a Pluggy (via MeuPluggy pessoal)

> Como o Quibo importa dados bancários reais via Pluggy, no modelo **pessoal (MeuPluggy)**, local-first e BYOK, sem servidor próprio. Define os dois caminhos de integração, o fluxo correto do MeuPluggy (proxy OAuth), a autenticação, os endpoints, o ciclo de vida do Item, o refresh diário e o mapeamento de dados. Pré-requisitos: [00](./00-visao-geral-produto.md), [01](./01-arquitetura-desktop.md), [02](./02-estrutura-de-dados.md).

> **Nota de fonte:** alguns detalhes operacionais (cobertura de conectores, limites do plano gratuito, credenciais de sandbox, versões de pacote/CDN) mudam com o tempo. Este documento traz o modelo conceitual e o fluxo; **confirme os valores exatos na documentação oficial** (docs.pluggy.ai, dashboard.pluggy.ai, github.com/pluggyai) antes de implementar.

---

## Sumário

1. [Papel da Pluggy no Quibo](#1-papel-da-pluggy-no-quibo)
2. [Dois caminhos: Dashboard padrão vs MeuPluggy](#2-dois-caminhos-dashboard-padrão-vs-meupluggy)
3. [MeuPluggy: a porta de entrada pessoal](#3-meupluggy-a-porta-de-entrada-pessoal)
4. [Conceitos da Pluggy](#4-conceitos-da-pluggy)
5. [Modelo de autenticação](#5-modelo-de-autenticação)
6. [O encaixe no local-first: Rust como servidor seguro](#6-o-encaixe-no-local-first-rust-como-servidor-seguro)
7. [Fluxo de integração passo a passo (MeuPluggy)](#7-fluxo-de-integração-passo-a-passo-meupluggy)
8. [Sincronização: refresh diário + polling local](#8-sincronização-refresh-diário--polling-local)
9. [SDK, widget e endpoints REST](#9-sdk-widget-e-endpoints-rest)
10. [Ciclo de vida do Item](#10-ciclo-de-vida-do-item)
11. [Produtos consumidos e formatos de dados](#11-produtos-consumidos-e-formatos-de-dados)
12. [APIs de inteligência](#12-apis-de-inteligência)
13. [Mapeamento Pluggy → modelo Quibo](#13-mapeamento-pluggy--modelo-quibo)
14. [Anti-duplicata e idempotência](#14-anti-duplicata-e-idempotência)
15. [Reconciliação esperado × realizado](#15-reconciliação-esperado--realizado)
16. [Sandbox e desenvolvimento](#16-sandbox-e-desenvolvimento)
17. [Segredos, consentimento e LGPD](#17-segredos-consentimento-e-lgpd)
18. [Limites e estratégia de refresh](#18-limites-e-estratégia-de-refresh)
19. [Erros e degradação graciosa](#19-erros-e-degradação-graciosa)
20. [Distribuição para outros usuários](#20-distribuição-para-outros-usuários)
21. [UX da integração](#21-ux-da-integração)
22. [Decisões](#22-decisões)

---

## 1. Papel da Pluggy no Quibo

### O que a Pluggy resolve

A dor que originou o Quibo é a **digitação manual** (Excel). A Pluggy é a infraestrutura de Open Finance brasileira que, com uma única API, traz os dados financeiros direto das instituições — conta, cartão, fatura, transações, investimentos e empréstimos, padronizados, com até ~12 meses de histórico de transações. Para o Quibo, isso transforma o produto de **"app de digitar"** em **"app que já sabe"**: o maior salto de UX possível.

A Pluggy é uma **instituição de pagamento autorizada pelo Banco Central** (ITP), o que dá lastro regulatório ao acesso via Open Finance.

### Posição na arquitetura

A Pluggy é o **Pilar 2 de inteligência** (00 §9): traz o **realizado** (lançamentos reais), já categorizado, com APIs de inteligência (recorrência, enriquecimento). Ela **complementa e reconcilia** o cadastro manual de compromissos (o "esperado") — não o substitui (doc 02 §12).

### Princípios da integração

- **Pessoal (MeuPluggy):** o usuário usa a **própria conta MeuPluggy** e as **próprias credenciais de desenvolvedor**. Não há conta Pluggy "mãe" do Quibo.
- **Local-first:** dados importados vão para o SQLite local; nada passa por servidor nosso (não há servidor nosso).
- **Opt-in e transparente:** desligada por padrão; quando ligada, o usuário vê o que sai e para onde (P7).
- **Opcional:** todo o Quibo funciona sem ela (digitação manual). Ela é enriquecimento.

---

## 2. Dois caminhos: Dashboard padrão vs MeuPluggy

Existem **dois modelos** de integração com a Pluggy, e a distinção é o ponto mais importante deste documento.

### Caminho A — Dashboard padrão + Connect Widget (modelo "empresa/SaaS")

Você (desenvolvedor) cria uma aplicação no Dashboard, **embute o Pluggy Connect Widget** no seu app, e **seus usuários conectam os bancos através do seu app**. Você é o responsável pela conexão e pelo consentimento. É o modelo desenhado para fintechs e empresas que conectam muitos usuários.

```
Seu app  ──(Connect Widget)──►  usuário faz login no banco DENTRO do seu app
                                 → Item criado e mantido pela SUA aplicação
```

### Caminho B — MeuPluggy (modelo "pessoal/proxy") ⭐ recomendado para o Quibo

O **usuário conecta os bancos na própria conta MeuPluggy** (o app de consumo da Pluggy, em meu.pluggy.ai). Sua aplicação de desenvolvedor então **vincula-se à conta MeuPluggy via OAuth**, agindo como um **proxy** que lê a conexão que o **usuário** mantém. O MeuPluggy **mantém e atualiza diariamente** essa conexão.

```
Usuário  ──►  meu.pluggy.ai  ──►  conecta bancos (consentimento Open Finance)
                                   → Item mantido pelo MEUPLUGGY (do usuário)
Seu app de dev  ──(OAuth MeuPluggy)──►  proxy de leitura sobre o Item do usuário
                                        → refresh diário automático
```

### Por que o Caminho B é melhor para o Quibo

| Aspecto | Caminho A (Widget) | Caminho B (MeuPluggy) |
|---|---|---|
| Onde a conexão mora | na sua aplicação | na conta **do usuário** (MeuPluggy) |
| Login do banco | dentro do seu app | no MeuPluggy (você nem toca) |
| Consentimento | você gerencia | o usuário gerencia no MeuPluggy |
| Coerência com "o dado é do usuário" | boa | **máxima** |
| Refresh | você dispara/recebe webhook | **diário automático** pelo MeuPluggy |
| Superfície do seu app | maior (widget, login) | menor (só leitura) |

O Caminho B é **mais local-first**: a parte sensível (login do banco, consentimento) fica num app de consumo polido e regulado (MeuPluggy), e o Quibo só lê. Menos código sensível no Quibo, mais propriedade para o usuário.

> O Quibo adota o **Caminho B (MeuPluggy)** como padrão. O Caminho A fica documentado como alternativa, caso algum banco só funcione via widget direto.

---

## 3. MeuPluggy: a porta de entrada pessoal

### O que é

O **MeuPluggy** (https://meu.pluggy.ai) é uma **aplicação de consumo gratuita** da Pluggy para **pessoa física** gerenciar os próprios dados de Open Finance: conectar contas (corrente, poupança, cartões, transações, empréstimos, investimentos), **visualizar**, **exportar para planilha** e **gerenciar/revogar consentimento** a qualquer momento. A missão declarada é dar ao usuário **posse e controle** dos próprios dados financeiros, decidindo com quais aplicações de terceiros compartilhar e podendo revogar.

### Características

| Característica | Detalhe |
|---|---|
| **Gratuito para pessoa física** | cadastro sem custo; sem necessidade de CNPJ |
| **Login** | via Auth0 (Google ou e-mail) |
| **Conexões** | bancos via Open Finance regulado (consentimento OAuth) |
| **Backup** | os dados ficam guardados na Pluggy para o usuário acompanhar |
| **Exportação** | planilha / Google Sheets |
| **Consentimento** | gerenciável e revogável pelo usuário |
| **Acesso programático** | após conectar, dá para ler via API/SDKs (com app de dev) |

### Como o app pessoal entra

Depois que o usuário conectou os bancos no MeuPluggy, o desenvolvedor:

1. Cria uma **Development Application** no Dashboard (`dashboard.pluggy.ai`) → recebe **client_id e client_secret de desenvolvimento**. (A conta de dev costuma vir com um **trial**; após o trial, o uso pessoal/de desenvolvimento continua.)
2. O conector **MeuPluggy** aparece na lista de conectores. Via a **autorização OAuth do MeuPluggy**, vincula a conta MeuPluggy do usuário à aplicação de desenvolvedor — **uma vez por banco conectado** (se há vários bancos no MeuPluggy, repete por banco).
3. A autorização funciona como **proxy** sobre a conexão original (mantida pelo MeuPluggy) e **atualiza os dados diariamente**.
4. A aplicação passa a **ler os dados via Pluggy API/SDK** usando as credenciais de dev.

### Implicação para o Quibo

Para o **autor** (uso pessoal), isso é quase ideal: conecta os bancos uma vez no MeuPluggy, autoriza o app de dev, e o Quibo lê dados sempre frescos (refresh diário). O Quibo nunca lida com o login do banco — só consome.

---

## 4. Conceitos da Pluggy

| Conceito | Definição |
|---|---|
| **Connector** | Integração com uma instituição (banco, corretora). No Caminho B, o **MeuPluggy** é um conector. |
| **Item** | Uma **conexão** usuário↔conector. Tem um `itemId` único; é o ponto de entrada para os dados daquela conexão. |
| **API Key** | Credencial de **acesso completo** à API, gerada server-side a partir do `client_id`/`client_secret`. Expira em ~2h. |
| **Connect Token** | Token de **escopo reduzido** e curta duração (~30min), usado pelo widget no cliente (Caminho A). |
| **Product** | Dado padronizado de um Item: `ACCOUNTS`, `CREDIT_CARDS`, `TRANSACTIONS`, `INVESTMENTS`, `IDENTITY`, `LOANS`. |
| **Webhook** | Notificação server-to-server quando um Item sincroniza (requer URL pública — ver §8). |
| **nextAutoSyncAt** | Campo do Item indicando quando será a próxima atualização automática. |

---

## 5. Modelo de autenticação

### O fluxo de credenciais

1. Com `client_id` + `client_secret` (de desenvolvimento, obtidos no Dashboard), chama-se `POST /auth` e recebe-se uma **API Key** de acesso completo, válida por ~2h.
2. As credenciais são **extremamente sensíveis** e esse passo deve ocorrer só num **ambiente seguro** (no Quibo: o core Rust local — ver §6).
3. (Caminho A) Com a API Key, gera-se um **Connect Token** (`POST /connect_token`), ~30min, para o widget no cliente.
4. Dados detalhados de produtos exigem requisições com a **API Key** (server-side).

### Endpoints de autenticação (referência)

```bash
# Gerar API Key (server-side)
POST https://api.pluggy.ai/auth
  body: { "clientId": "...", "clientSecret": "..." }
  → { "apiKey": "..." }            # expira em ~2h

# (Caminho A) Gerar Connect Token para o widget
POST https://api.pluggy.ai/connect_token
  header: X-API-KEY: <apiKey>
  body: { "clientUserId": "...", "webhookUrl": "..." }   # webhookUrl opcional
  → { "accessToken": "ct_..." }    # expira em ~30min
```

### Resumo do contrato

| Credencial | Escopo | Duração | Onde pode viver |
|---|---|---|---|
| `client_id` / `client_secret` (dev) | gera API Key | permanente | **só em ambiente seguro** |
| API Key | acesso total | ~2h | ambiente seguro |
| Connect Token | escopo reduzido (1 Item) | ~30min | pode ir ao cliente/widget (Caminho A) |

No **Caminho B**, o passo central não é o Connect Token (widget), e sim a **autorização OAuth do MeuPluggy** que vincula a conta do usuário ao app de dev — mas a leitura dos dados continua usando a **API Key** gerada a partir das credenciais de dev.

---

## 6. O encaixe no local-first: Rust como servidor seguro

O `client_secret` de desenvolvimento e a API Key exigem "ambiente seguro". O Quibo **não tem servidor**. A solução (doc 01 §5):

> **O backend Rust do Tauri é o "ambiente seguro" — na máquina de cada usuário.**

### Por que é seguro

- **Cada usuário tem as próprias credenciais de dev**, no próprio keychain, na própria máquina.
- **Não há servidor compartilhado** — não existe um alvo central.
- O segredo **nunca entra na camada JS** (webview); vive no keychain e é usado só dentro do Rust.

### Diagrama (Caminho B)

```
   meu.pluggy.ai (do usuário)          Rust core (ambiente seguro local)        Pluggy API
   ──────────────────────────          ─────────────────────────────────        ──────────
   usuário conecta bancos
   + autoriza app de dev (OAuth)
                                        lê client_id/secret do keychain
                                        POST /auth → API Key (em memória) ──────► 
                                        GET /items, /accounts, /transactions ───► (dados do usuário)
                                        grava no SQLite local
```

No Caminho B, o Quibo **nem precisa embutir o widget de login do banco** — isso aconteceu no MeuPluggy. O Rust só autentica com as credenciais de dev e lê.

---

## 7. Fluxo de integração passo a passo (MeuPluggy)

### 7.1 Pré-requisito (uma vez, fora do Quibo)

1. Usuário cria conta em **https://meu.pluggy.ai** (Auth0).
2. Conecta os bancos lá (consentimento Open Finance).
3. Cria uma **Development Application** em **https://dashboard.pluggy.ai** → obtém `client_id`/`client_secret` de dev.
4. Vincula a conta MeuPluggy ao app de dev via **autorização OAuth do MeuPluggy** (uma vez por banco).

### 7.2 Configuração no Quibo (uma vez)

1. **Ajustes → Integrações → Pluggy (MeuPluggy)**.
2. O app explica o passo 7.1 e linka para meu.pluggy.ai e dashboard.pluggy.ai.
3. Usuário cola `client_id`/`client_secret` de dev.
4. O Rust valida (gera uma API Key) e grava no **keychain**. A UI só recebe "conectado".

### 7.3 Primeiro sync

```
Rust, com API Key:
  GET /items                → lista os Items (conexões via MeuPluggy)
  GET /accounts?itemId=...  → mapeia contas Pluggy → contas Quibo
  GET /transactions?accountId=...  → cria entries (anti-duplicata por id)
  GET /investments?itemId=...      → carteira (doc 05)
Reconciliação (doc 02 §12):
  casa entries importados com compromissos
Grava lastSyncedAt
```

### 7.4 Mapeamento de contas (passo de UX)

Como o usuário pode já ter contas manuais, o primeiro sync **pergunta** como mapear cada conta Pluggy (vincular a uma existente ou criar nova). O mapa fica em `pluggy_items.accountMapJson` e é reusado.

---

## 8. Sincronização: refresh diário + polling local

### O que o MeuPluggy faz por você

No Caminho B, o MeuPluggy **mantém a conexão e atualiza os dados diariamente** (refresh automático no lado da Pluggy). O campo **`nextAutoSyncAt`** do Item indica quando será a próxima atualização. Ou seja, **os dados já chegam frescos** sem o Quibo precisar disparar a coleta no banco.

### Como o Quibo descobre que atualizou: polling (não webhook)

A forma "ideal" de saber que um Item atualizou é o **webhook** (a Pluggy faz um POST para uma URL sua). Mas webhook exige **URL pública**, que um app desktop local-first **não tem**. Então o Quibo usa **polling controlado**:

| Gatilho | Quando |
|---|---|
| **Ao abrir o app** | se passou do intervalo desde o último pull |
| **Botão "Atualizar"** | usuário pede explicitamente |
| **Agendado** | 1×/dia, alinhado ao `nextAutoSyncAt` |

```
pull(item):
  GET /items/:id          → confere status / nextAutoSyncAt
  GET /transactions desde lastSyncedAt
  cria entries novos (anti-duplicata)
  re-roda reconciliação
  atualiza lastSyncedAt
```

### Por que isso é suficiente

Como o MeuPluggy já atualiza **diariamente**, o Quibo só precisa **buscar** o que já foi atualizado — não precisa de tempo real. Para finanças pessoais, "atualizado hoje" basta. A ausência de webhook deixa de ser limitação e vira simplicidade.

---

## 9. SDK, widget e endpoints REST

### SDK oficial (Node/JS) — referência

A Pluggy tem SDK server-side (`pluggy-sdk`) e o widget (`react-pluggy-connect` / script via CDN). No Quibo, a **leitura** acontece no **Rust** (a chave fica no keychain), então o SDK Node serve mais de **referência de contrato** — o Rust replica as mesmas chamadas. Onde fizer sentido (ex.: parte de desenvolvimento/testes), o SDK pode ser usado na camada TS.

```ts
// Referência de contrato (Node) — no Quibo, equivalente roda no Rust core
import { PluggyClient } from 'pluggy-sdk';
const client = new PluggyClient({ clientId, clientSecret });
const accounts     = await client.fetchAccounts(itemId);
const transactions = await client.fetchTransactions(accountId);
const investments  = await client.fetchInvestments(itemId);
```

### Endpoints REST principais (referência)

```bash
GET https://api.pluggy.ai/items/:id              # status do Item
GET https://api.pluggy.ai/accounts?itemId=...     # contas
GET https://api.pluggy.ai/transactions?accountId=...   # transações (paginadas)
GET https://api.pluggy.ai/investments?itemId=...  # investimentos
GET https://api.pluggy.ai/identity?itemId=...     # identidade
# todas com header: X-API-KEY: <apiKey>
```

### Widget (Caminho A — alternativa)

Caso algum banco exija o fluxo de widget (não-MeuPluggy), o Quibo embute o Connect Widget na webview com um Connect Token gerado pelo Rust:

```
1. Rust: POST /connect_token → accessToken
2. UI: renderiza o widget com o accessToken
3. onSuccess({ item }) → UI envia item.id ao Rust → Rust persiste e puxa dados
```

> Versões de pacote, nome do componente e URL do CDN do widget **mudam** — confira a doc oficial na hora de implementar.

---

## 10. Ciclo de vida do Item

O Item tem um **status** que o Quibo monitora para saber se os dados estão prontos ou se precisa de ação do usuário.

| Status | Significado | Ação do Quibo |
|---|---|---|
| `UPDATING` | sincronizando com a instituição | aguardar; mostrar "atualizando…" |
| `UPDATED` | dados atualizados com sucesso | puxar dados |
| `LOGIN_ERROR` | credenciais inválidas no banco | avisar; usuário reconecta no MeuPluggy |
| `OUTDATED` | erro inesperado | pode reprocessar; retentar mais tarde |
| `WAITING_USER_INPUT` | aguardando MFA/ação | sinalizar "ação necessária" |

Campos úteis: **`nextAutoSyncAt`** (próxima atualização automática) orienta o agendamento do polling do Quibo (§8).

> No Caminho B, erros de login se resolvem no **MeuPluggy** (onde a conexão mora), não dentro do Quibo — o Quibo só orienta o usuário a reconectar lá.

---

## 11. Produtos consumidos e formatos de dados

O Quibo consome (e o que cada um vira):

| Produto | Uso no Quibo | Vira |
|---|---|---|
| **Account** | contas e saldos reais | `accounts` (ou mapeadas) |
| **Transaction** | movimentações reais (categorizadas) | `entries` (com id Pluggy) |
| **Credit Card / Bills** | faturas e parcelas | `invoices` (derivar/conciliar) |
| **Investment** | carteira | `investments` (doc 05) |
| **Loan** | empréstimos | reconciliar com `debts` |
| **Identity** | dados cadastrais | onboarding opcional (não essencial) |

### Formatos (exemplos de referência)

```json
// Conta
{ "id": "...", "type": "BANK", "subtype": "CHECKING_ACCOUNT",
  "name": "Conta Corrente", "balance": 1209.50, "currencyCode": "BRL" }

// Transação (valor negativo = saída)
{ "id": "...", "description": "PIX - Pagamento Netflix", "amount": -55.90,
  "date": "2024-06-15T00:00:00.000Z", "category": "Streaming",
  "type": "DEBIT", "status": "POSTED", "currencyCode": "BRL" }

// Investimento
{ "name": "CDB 100% CDI", "type": "FIXED_INCOME", "subtype": "CDB",
  "balance": 5230.45, "amount": 5000.00, "amountProfit": 230.45,
  "annualRate": 13.25, "rateType": "CDI", "status": "ACTIVE" }
```

> Atenção ao **dinheiro**: a Pluggy entrega valores em **decimal** (ex.: `1209.50`). O Quibo converte para **centavos inteiros** na importação (× 100, arredondado) — doc 02 §3.1. Sinal do `amount` define `type` (DEBIT → EXPENSE, CREDIT → INCOME).

### O que o Quibo NÃO usa

- **Payments / Pix / Smart Transfers / Boleto:** o Quibo **lê**, não **move** dinheiro (00 §11). Iniciar pagamentos está fora de escopo.

---

## 12. APIs de inteligência

A Pluggy oferece inteligência que alimenta o motor de insights (doc 06) e a reconciliação (doc 02), de forma **determinística** — reduzindo o que sobra para o LLM:

| API | Entrega | Uso no Quibo |
|---|---|---|
| **Recurring Payments** | pagamentos recorrentes (assinaturas, contas fixas) | estado "Apertado" → "N assinaturas somam R$ X" |
| **Transaction Enrichment** | enriquecimento (merchant, categoria) | melhora categorização dos entries |
| **Connection Insights** | saúde da conexão/itens | diagnóstico |

A categorização automática das transações também vem da Pluggy, reduzindo o trabalho manual. Tudo isso é **fato determinístico** → alimenta o Pilar 1, não a voz (P8). Caminho futuro: a Pluggy tem **MCP server / skills de IA**, que poderiam deixar a camada de IA do Quibo (doc 04) consultar a Pluggy diretamente (v2).

---

## 13. Mapeamento Pluggy → modelo Quibo

### Transaction → `entries`

```
Pluggy Transaction            Quibo entries
──────────────────            ─────────────
id            ────► pluggyTransactionId (único, anti-duplicata)
description   ────► description
amount        ────► amountCents (× 100); sinal define type (DEBIT/CREDIT)
date          ────► date, month, year
category      ────► categoryId (match) / tags
              ────► status = CONFIRMADO (já aconteceu)
              ────► accountId = conta mapeada
```

### Account → `accounts`

`balance × 100 → balanceCents`; `subtype → type`; o usuário decide no mapeamento se vira conta nova ou vincula a uma existente.

### Investment / Loan

Investment → `investments` (doc 05). Loan → reconcilia com `debts` (com confirmação, para não duplicar).

---

## 14. Anti-duplicata e idempotência

Importar duas vezes não pode duplicar:

1. **No banco:** índice único parcial em `entries.pluggyTransactionId` (doc 02 §10) — a mesma transação nunca entra duas vezes.
2. **Na lógica:** busca desde `lastSyncedAt` + upsert por `pluggyTransactionId`.
3. **Na reconciliação:** entry importado que casa com compromisso não gera um segundo entry "esperado".
4. **Atualização:** se a Pluggy revisar uma transação (categoria via enriquecimento), o upsert atualiza por id, preservando escolhas manuais do usuário.

---

## 15. Reconciliação esperado × realizado

(Algoritmo completo em doc 02 §12.) Quando a Pluggy traz um débito de R$ 1.500 e existe o compromisso "Aluguel R$ 1.500":

1. Pontua o match (valor + data + categoria enriquecida).
2. Forte → vincula o entry ao compromisso, marca **CONFIRMADO**, sem criar segundo entry.
3. Fraco → "Falta confirmar" com sugestão ("isto parece seu aluguel — confirmar?").
4. Aprende o mapeamento para os próximos meses.

Com a Pluggy conectada, **"Falta confirmar" encolhe** — o ápice da promessa "tão fácil que assusta".

---

## 16. Sandbox e desenvolvimento

- A Pluggy oferece **Sandbox** com conectores e dados de teste para exercitar o fluxo sem banco real.
- No widget, um parâmetro habilita conectores de sandbox; há credenciais de teste padrão (usuário/senha/MFA fictícios) e um fluxo de Open Finance sandbox. **Confirme as credenciais atuais na doc** (mudam).
- **Itens de sandbox** podem ser removidos após um período sem atualização.
- O **auto-sync diário é feature de produção**; em sandbox, atualiza-se manualmente.

### Estrutura do cliente Pluggy no código (Rust)

```
src-tauri/src/pluggy/
  auth.rs          # client_id/secret → API Key (cache ~2h)
  items.rs         # listar/ler Items, status, nextAutoSyncAt
  products.rs      # accounts, transactions, bills, investments, loans, identity
  intelligence.rs  # recurring payments, enrichment
  sync.rs          # polling idempotente alinhado ao refresh diário
  map.rs           # Pluggy → entries/accounts/...
src/core/integrations/pluggy/   # parte TS (tipos, status, UI de configuração)
```

---

## 17. Segredos, consentimento e LGPD

### Segredos

- `client_id`/`client_secret` de dev no **keychain do SO** (doc 01 §8). Nunca em texto plano, na UI ou em log.
- API Key só em memória no Rust, pelo tempo necessário.

### Consentimento

- No **Caminho B**, o consentimento Open Finance é gerenciado pelo **usuário no MeuPluggy** — incluindo **revogar** a qualquer momento. O Quibo apenas lê enquanto a autorização existir.
- Consentimentos Open Finance **expiram**; o Quibo detecta (status do Item) e orienta o usuário a renovar no MeuPluggy.

### LGPD e propriedade do dado

- O dado importado é do usuário e mora **na máquina dele** (SQLite local). O autor do Quibo **não tem acesso** a nada — não há servidor que receba.
- A relação de tratamento de dado é entre **o usuário, o MeuPluggy e a Pluggy** (contas dele). O Quibo é o cliente local que consome.
- Transparência total: a UI mostra os Items, quando sincronizaram, e permite parar de ler e apagar os dados locais a qualquer momento.

---

## 18. Limites e estratégia de refresh

### Plano gratuito

O acesso pessoal via MeuPluggy é gratuito; a conta de desenvolvedor costuma ter **trial** e segue utilizável depois para uso pessoal. Planos podem ter **limites** (conexões, frequência, volume). **Confirmar os limites atuais** no Dashboard, e ter em mente que conectar **muitos** usuários pode esbarrar em limites (relevante para distribuição — §20).

### Estratégia conservadora

- **Pull ≤ 1×/dia por Item**, alinhado ao `nextAutoSyncAt` (o MeuPluggy já atualiza diariamente).
- **Coalescer:** ao abrir o app, puxar só se passou do intervalo.
- **Backoff** em rate limit, com aviso humano.
- Tela de diagnóstico (doc 01 §14) mostra ao usuário o consumo, para ele gerenciar.

---

## 19. Erros e degradação graciosa

A integração **nunca** derruba o app (funciona offline e sem Pluggy).

| Erro | Comportamento |
|---|---|
| Credencial de dev inválida | "Não consegui validar suas credenciais. Confere e tenta de novo." |
| Item `LOGIN_ERROR` | "Sua conexão com o banco precisa ser renovada no MeuPluggy." |
| Item `WAITING_USER_INPUT` (MFA) | "O banco pediu uma confirmação. Resolve no MeuPluggy e atualiza aqui." |
| Consentimento expirado | avisa e orienta a renovar no MeuPluggy |
| Rate limit / plano | "Limite de atualizações atingido. Tenta mais tarde." |
| Pluggy fora do ar | usa dados locais; "não consegui atualizar agora" |
| Sync parcial | grava o que veio; marca para retentar |

Mensagens em linguagem de gente (P4). Dados já importados permanecem utilizáveis mesmo se a próxima atualização falhar.

---

## 20. Distribuição para outros usuários

Ponto honesto que afeta o público (00 §7).

No **Caminho B (MeuPluggy)**, para outra pessoa usar a integração no Quibo dela, **essa pessoa precisa**:

1. Criar conta no **MeuPluggy** e conectar os bancos lá.
2. Criar a própria **Development Application** no Dashboard (client_id/secret próprios).
3. Autorizar o app de dev via OAuth do MeuPluggy.

Ou seja: **há fricção de setup por usuário** — perfeitamente ok para gente técnica, mas barreira para leigos. Isso reforça a conclusão (00 §7): a integração Pluggy é, na prática, para **público técnico**. Para o **autor**, é setup único e indolor.

> Alternativa para reduzir fricção a leigos exigiria o **Caminho A** com uma aplicação Pluggy compartilhada e um backend que gere Connect Tokens — o que reintroduz servidor, custo e responsabilidade. O Quibo **não** vai por aí (anti-roadmap, doc 08 §14). A integração permanece opcional; quem não quer, digita manual.

---

## 21. UX da integração

- **Opcional e fora do caminho:** vive em Ajustes → Integrações. Quem não quer, nunca esbarra.
- **Explicação humana + links:** o app guia o passo-a-passo do MeuPluggy + Dashboard com linguagem clara, e linka os dois sites.
- **Mapeamento guiado:** vincular contas Pluggy a contas Quibo é um wizard curto.
- **Status visível:** cada Item mostra "atualizado há X" e botão "Atualizar".
- **Confirmação assistida:** pós-sync, "Falta confirmar" mostra o que casou e o que precisa de um toque.
- **Parar é fácil:** desligar a leitura e apagar dados importados é um clique; revogar consentimento é no MeuPluggy.

### Contrato de transparência (texto exemplo)

> "Você conecta seus bancos no **MeuPluggy** (um app da Pluggy, gratuito, onde **você** controla e revoga o acesso). O Quibo só **lê** esses dados usando **suas** credenciais, guardadas só neste computador. Nada vai para o autor do Quibo — não existe servidor nosso."

---

## 22. Decisões

| # | Decisão | Racional |
|---|---|---|
| PL-1 | **Caminho B (MeuPluggy/proxy)** como padrão | Conexão mora na conta do usuário; mais local-first; refresh diário pronto |
| PL-2 | Rust core = ambiente seguro local | Resolver a exigência de "servidor" sem hospedar nada |
| PL-3 | BYOK (credenciais de dev do usuário no keychain) | Privacidade; cada um usa a própria conta |
| PL-4 | Sem webhook → polling alinhado ao `nextAutoSyncAt` | Local-first não tem URL pública; refresh diário basta |
| PL-5 | Importar como `entries` CONFIRMADO + reconciliar | Unificar com o modelo; não dobrar esperado×realizado |
| PL-6 | Anti-duplicata por `pluggyTransactionId` único | Idempotência no nível do banco |
| PL-7 | Só leitura (sem Payments/Pix) | Reduzir risco e responsabilidade |
| PL-8 | Valores Pluggy (decimal) → centavos inteiros na importação | Coerência com doc 02 §3.1 |
| PL-9 | Pluggy é 100% opcional | O Quibo funciona pleno sem ela |
| PL-10 | Distribuição com fricção (setup por usuário) → público técnico | Não reintroduzir servidor para atender leigos |
| PL-11 | Confirmar specs voláteis na doc oficial | Coberturas, limites, sandbox e versões mudam |

---

---

## Apêndice A — Perguntas frequentes e troubleshooting

Perguntas que tendem a surgir ao implementar ou usar a integração.

### Sobre o modelo

**Preciso de CNPJ/empresa para usar?**
Não. O MeuPluggy é para pessoa física, e a Development Application no Dashboard é criável por qualquer pessoa. O acesso pessoal é gratuito; a conta de dev costuma vir com um trial e segue utilizável depois para uso pessoal.

**Qual a diferença prática entre o Caminho A (widget) e o B (MeuPluggy)?**
No A, o usuário conecta o banco **dentro do seu app** (você embute o widget e mantém o Item). No B, o usuário conecta o banco **no MeuPluggy** (app da Pluggy) e seu app **lê via proxy OAuth**. O B é mais local-first: a parte sensível (login do banco, consentimento) não passa pelo seu app, e o MeuPluggy já atualiza diariamente.

**O Quibo precisa do Connect Token?**
No Caminho B (padrão), o passo central é a autorização OAuth do MeuPluggy, e a leitura usa a API Key. O Connect Token é do Caminho A (widget), mantido como alternativa.

**Por que não usar webhook, já que existe?**
Webhook exige URL pública, que um app desktop local-first não tem. Como o MeuPluggy atualiza diariamente, o Quibo só faz **polling** (puxar o que já atualizou) — alinhado ao `nextAutoSyncAt`. Para finanças pessoais, "atualizado hoje" basta.

### Sobre dados

**Quanto histórico de transação vem?**
Tipicamente até ~12 meses, dependendo da instituição e do produto. Confirme na doc/coverage atual.

**Os valores vêm em centavos?**
Não — vêm em decimal (ex.: `-55.90`). O Quibo converte para **centavos inteiros** na importação (doc 02 §3.1). O sinal define o tipo (DEBIT → EXPENSE, CREDIT → INCOME).

**A Pluggy já categoriza?**
Sim, há categorização automática e enriquecimento. O Quibo usa isso para preencher `categoryId`/`tags`, reduzindo trabalho manual, e a API de recorrência para detectar assinaturas (alimenta o motor de insights, doc 06).

### Troubleshooting

**O Item está em `LOGIN_ERROR`. E agora?**
A conexão com o banco precisa ser renovada **no MeuPluggy** (onde ela mora), não no Quibo. O Quibo detecta o status e orienta o usuário a reconectar lá; depois, "Atualizar" no Quibo puxa de novo.

**O Item está em `WAITING_USER_INPUT`.**
O banco pediu MFA/confirmação. Resolve-se no MeuPluggy; o Quibo sinaliza "ação necessária".

**O sync importou transações duplicadas.**
Não deveria — há índice único em `pluggyTransactionId` (doc 02 §10). Se aconteceu, verifique se o upsert está usando esse campo como chave e se a janela `lastSyncedAt` está correta.

**Importou e duplicou com o que eu já tinha cadastrado manualmente.**
É papel da reconciliação (doc 02 §12) casar o entry importado com o compromisso. Ajuste a tolerância de valor/data; mapeamentos confirmados pelo usuário melhoram os próximos meses.

**A API Key expirou no meio de um sync.**
A API Key dura ~2h; o Rust deve cachear e regenerar sob demanda. Trate `401` regenerando a chave e repetindo a chamada uma vez.

**Conectei vários bancos no MeuPluggy mas só vejo um.**
A autorização OAuth do MeuPluggy é **por banco** — repita o vínculo para cada banco conectado no MeuPluggy.

---

## Apêndice B — O que mudou em relação à análise inicial

Esta seção registra a reconciliação entre a análise gerada anteriormente e este documento, para rastreabilidade.

### O que a análise acertou (e foi mantido)

- O modelo de autenticação: `client_id`/`client_secret` → API Key (~2h) → Connect Token (~30min), com o segredo só em ambiente seguro.
- Os conceitos: Connector, Item, Product, API Key, Connect Token.
- Os endpoints REST (`/auth`, `/connect_token`, `/accounts`, `/transactions`, `/investments`, `/identity`).
- O ciclo de vida do Item (UPDATING/UPDATED/LOGIN_ERROR/OUTDATED/WAITING_USER_INPUT) e o `nextAutoSyncAt`.
- A natureza gratuita do MeuPluggy para pessoa física e o login via Auth0.
- A Pluggy como instituição de pagamento autorizada pelo BC.

### O que foi corrigido

- **O fluxo do MeuPluggy.** A análise tratou o MeuPluggy como "porta de entrada" e em seguida descreveu o fluxo padrão de **embutir o Connect Widget** (Caminho A). O modelo correto do MeuPluggy é um **proxy via OAuth** (Caminho B): o usuário conecta os bancos **no MeuPluggy**, cria uma Development Application no Dashboard, e **vincula a conta MeuPluggy ao app de dev via autorização OAuth** (uma vez por banco); o app então **lê** os dados, que o MeuPluggy **atualiza diariamente**. O Quibo adota esse modelo.
- **A arquitetura "com backend".** A análise sugeriu um backend Node + Express recebendo webhooks (via ngrok/Vercel). Isso é o modelo SaaS e **contradiz o local-first** do Quibo. Aqui, o **core Rust local** faz o papel de ambiente seguro, e a sincronização é por **polling** (não webhook), alinhada ao refresh diário do MeuPluggy.
- **Refresh.** Ficou explícito que o MeuPluggy já atualiza **diariamente** no lado da Pluggy; o Quibo apenas **puxa** o que atualizou (não dispara coleta no banco, não depende de webhook).

### O que foi acrescentado

- A distinção explícita entre os dois caminhos (§2) e a recomendação do Caminho B.
- A fricção de **distribuição por usuário** (§20) e sua implicação de público (técnico).
- A conversão **decimal → centavos inteiros** na importação (§11).
- O alerta de que coberturas, limites, credenciais de sandbox e versões de pacote **mudam** e devem ser confirmados na doc oficial.

### O que deve ser verificado na doc oficial

Tratar como "confirmar antes de implementar": tabela de cobertura de conectores por instituição; limites exatos do plano gratuito/dev; credenciais atuais de sandbox; nome/versão do pacote do widget e URL do CDN; campos exatos de cada produto. Fontes: `docs.pluggy.ai`, `dashboard.pluggy.ai`, `github.com/pluggyai`.

---

*Fim do documento 03. Próximo: [04 — Integração com IA (BYOK)](./04-integracao-ia-byok.md). Anterior: [02 — Estrutura de Dados](./02-estrutura-de-dados.md).*
