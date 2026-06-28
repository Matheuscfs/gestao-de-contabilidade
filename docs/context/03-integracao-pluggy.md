# Quibo — Integração com a Pluggy

> Como o Quibo importa dados bancários reais via Pluggy, no modelo BYOK e local-first, sem servidor próprio. Define o papel da Pluggy, o fluxo de autenticação adaptado ao desktop, sincronização sem webhook, mapeamento de dados e as APIs de inteligência. Pré-requisitos: [00](./00-visao-geral-produto.md), [01](./01-arquitetura-desktop.md), [02](./02-estrutura-de-dados.md).

---

## Sumário

1. [Papel da Pluggy no Quibo](#1-papel-da-pluggy-no-quibo)
2. [Conceitos da Pluggy](#2-conceitos-da-pluggy)
3. [Modelo de autenticação](#3-modelo-de-autenticação)
4. [O encaixe no local-first: Rust como servidor seguro](#4-o-encaixe-no-local-first-rust-como-servidor-seguro)
5. [Fluxo de conexão passo a passo](#5-fluxo-de-conexão-passo-a-passo)
6. [Sincronização sem webhook](#6-sincronização-sem-webhook)
7. [Produtos consumidos](#7-produtos-consumidos)
8. [APIs de inteligência](#8-apis-de-inteligência)
9. [Mapeamento Pluggy → modelo Quibo](#9-mapeamento-pluggy--modelo-quibo)
10. [Anti-duplicata e idempotência](#10-anti-duplicata-e-idempotência)
11. [Reconciliação esperado × realizado](#11-reconciliação-esperado--realizado)
12. [Gestão de segredos, consentimento e LGPD](#12-gestão-de-segredos-consentimento-e-lgpd)
13. [Limites, rate limits e estratégia de refresh](#13-limites-rate-limits-e-estratégia-de-refresh)
14. [Erros e degradação graciosa](#14-erros-e-degradação-graciosa)
15. [Sandbox e desenvolvimento](#15-sandbox-e-desenvolvimento)
16. [UX da integração](#16-ux-da-integração)
17. [Decisões](#17-decisões)

---

## 1. Papel da Pluggy no Quibo

### O que a Pluggy resolve

A dor que originou o Quibo é a **digitação manual** (Excel). A Pluggy é uma plataforma brasileira de Open Finance que, com uma única API, traz os dados financeiros do usuário direto das instituições — conta, cartão, fatura, transações, investimentos e empréstimos — em poucos minutos de integração. Para o Quibo, isso transforma o produto de **"app de digitar"** em **"app que já sabe"**: o maior salto de UX possível para o caso de uso.

### Posição na arquitetura

A Pluggy é o **Pilar 2 de inteligência** (ver 00 §9): ela traz o **realizado** (lançamentos reais), já categorizado, e oferece APIs de inteligência prontas (recorrência, enriquecimento). Ela **não substitui** o cadastro manual de compromissos (o "esperado"); ela o **complementa** e o **reconcilia** (ver doc 02 §12).

```
Cadastro manual (esperado)  ──┐
                              ├──►  reconciliação  ──►  home "Mês"
Pluggy (realizado)  ──────────┘      (doc 02 §12)
```

### Princípios que regem a integração

- **BYOK:** o usuário usa a **própria conta Pluggy** e as **próprias chaves**. O Quibo não tem uma conta Pluggy "mãe".
- **Local-first:** dados importados vão para o SQLite local; nada passa por servidor nosso (não há servidor nosso).
- **Opt-in e transparente:** a integração é desligada por padrão; quando ligada, o usuário vê o que sai e para onde (P7).
- **A Pluggy é opcional:** todo o Quibo funciona sem ela (digitação manual). Ela é enriquecimento.

### Por que a Pluggy (e não scraping ou OFX manual)

- **Open Finance regulado + conectores diretos:** cobertura ampla de bancos BR, com manutenção da Pluggy.
- **Dados enriquecidos:** categorização e detecção de recorrência saem de fábrica.
- **Grátis a nível pessoal** (conforme o uso do autor; limites a confirmar — ver §13).
- **MCP server e skills de IA** (ver §8) abrem caminho futuro para a camada de IA consultar a Pluggy diretamente.

---

## 2. Conceitos da Pluggy

Vocabulário essencial para entender a integração.

| Conceito | Definição |
|---|---|
| **Connector** | Uma instituição financeira suportada (um banco, uma corretora). Tem cobertura de certos produtos. |
| **Item** | Uma **conexão** entre o usuário e um Connector. É a unidade central: criar um Item = conectar um banco. |
| **Connect Token** | Token de **escopo reduzido** e curta duração, usado pelo widget no cliente para criar/atualizar um Item. |
| **API Key** | Credencial de **acesso completo** à API, de curta duração, gerada server-side a partir do CLIENT_ID/SECRET. |
| **Pluggy Connect (widget)** | Componente de UI que conduz o usuário pelo fluxo de login/consentimento no banco. |
| **Product** | Tipo de dado disponível num Item: Account, Transaction, Credit Card Bills, Investment, Loan, Identity. |
| **Webhook** | Notificação server-to-server quando um Item sincroniza (requer URL pública — ver §6). |

### Ciclo de vida do Item (resumo)

```
criar Item (via Connect Token + widget)
   → status de sincronização (updating → updated / login error / waiting user input)
   → dados disponíveis (transactions, accounts, ...)
   → atualizações periódicas (manuais no nosso caso)
   → consentimento expira (Open Finance) → re-consentir
   → deletar Item (revogar consentimento)
```

---

## 3. Modelo de autenticação

O ponto crítico que define a arquitetura da integração.

### Como a Pluggy autentica

1. Com `CLIENT_ID` + `CLIENT_SECRET`, faz-se uma chamada de autenticação que retorna uma **API Key** com **acesso completo** à API, válida por cerca de **2 horas**.
2. A documentação é **enfática**: essas credenciais são extremamente sensíveis e esse passo deve ocorrer **apenas num servidor seguro**.
3. Com a API Key, gera-se um **Connect Token** (`POST /connect_token`), válido por cerca de **30 minutos**, de **escopo reduzido**: serve para o widget criar/atualizar um Item e ler dados limitados daquele Item.
4. O **widget no cliente** usa só o Connect Token. Tentar acessar dados detalhados de produtos com o Connect Token (em vez da API Key) resulta em **403 Forbidden**.
5. Para puxar todos os dados dos produtos do Item, configurar webhooks etc., é preciso fazer **requisições server-side com a API Key**.

### O resumo do contrato

| Credencial | Escopo | Duração | Onde pode viver |
|---|---|---|---|
| `CLIENT_ID` / `CLIENT_SECRET` | gera API Key | permanente | **só em servidor seguro** |
| API Key | acesso total | ~2h | servidor seguro |
| Connect Token | escopo reduzido (1 Item) | ~30min | pode ir ao cliente/widget |

### A tensão com local-first

A Pluggy assume "servidor seguro". O Quibo **não tem servidor**. Onde rodam a autenticação e as chamadas com API Key?

---

## 4. O encaixe no local-first: Rust como servidor seguro

**A resposta:** o **backend Rust do Tauri é o "servidor seguro" — na máquina de cada usuário.** Esta é a peça que torna a integração viável sem comprometer o local-first.

### Por que isso é seguro (e não viola o alerta da Pluggy)

O alerta da Pluggy existe porque, num SaaS web, o `CLIENT_SECRET` ficaria num servidor compartilhado que atende muitos usuários — um alvo único cujo comprometimento expõe todo mundo. No Quibo:

- **Cada usuário tem as próprias chaves**, no próprio keychain, na própria máquina.
- **Não há servidor compartilhado.** Não existe um alvo central.
- O segredo **nunca entra na camada JS** (webview); vive no keychain e é usado só dentro do Rust.

Ou seja: o modelo de risco que a Pluggy mitiga **não se aplica** ao local-first com chaves por usuário. O Rust local desempenha o papel de "servidor seguro" de forma isolada e por usuário.

### Diagrama do fluxo seguro

```
   UI (webview)            Rust core (servidor seguro local)            Pluggy
   ────────────            ─────────────────────────────────            ──────
   "conectar banco" ─IPC─► lê CLIENT_ID/SECRET do keychain
                           POST /auth      → API Key (em memória) ─────► 
                           POST /connect_token → token (30min)    ─────► 
                  ◄─────── devolve só o Connect Token
   widget Connect
   (na webview)    ───────────────────────────────────────────────────► login/consentimento no banco
   onSuccess(itemId) ─IPC► guarda itemId localmente
                           GET /transactions, /accounts... (API Key) ──► 
                           grava entries/accounts no SQLite
```

### Responsabilidades

| Camada | Faz |
|---|---|
| **Rust core** | guarda segredo; gera API Key e Connect Token; chama os endpoints de produto; grava no SQLite |
| **Webview (UI)** | recebe o Connect Token; renderiza o widget Pluggy Connect; mostra status e dados |
| **Keychain** | guarda `CLIENT_ID`/`CLIENT_SECRET` do usuário |

### Renovação de credenciais

O Rust gerencia a expiração: cacheia a API Key em memória até ~2h e a regenera sob demanda; gera um Connect Token novo a cada operação de conexão/atualização (recomendação: 1 por conexão).

---

## 5. Fluxo de conexão passo a passo

### 5.1 Primeira configuração (uma vez)

1. Usuário vai em **Ajustes → Integrações → Pluggy**.
2. O app explica, em linguagem de gente, o que a Pluggy faz e o que sairá da máquina.
3. Usuário cola seu `CLIENT_ID` e `CLIENT_SECRET` (obtidos no dashboard da Pluggy).
4. O Rust **valida** as credenciais (tenta gerar uma API Key) e, se ok, **grava no keychain**. A UI só recebe "conectado".

### 5.2 Conectar um banco (criar um Item)

```
1. UI chama comando `pluggy_create_connect_token`
2. Rust gera API Key → Connect Token, devolve o token
3. UI abre o widget Pluggy Connect com o token
4. Usuário escolhe o banco e faz login/consentimento dentro do widget
5. widget dispara onSuccess(itemId)
6. UI chama `pluggy_register_item(itemId)`
7. Rust guarda o Item em `pluggy_items`, dispara o primeiro sync
```

### 5.3 Primeiro sync (importação inicial)

```
Rust, com API Key:
  GET /accounts?itemId      → mapeia contas Pluggy → contas Quibo
  GET /transactions?...     → cria entries (anti-duplicata por pluggyTransactionId)
  GET /credit-card bills    → faturas (deriva/concilia)
  GET /investments          → carteira (doc 05)
Reconciliação (doc 02 §12):
  casa entries importados com compromissos existentes
Marca pluggy_items.lastSyncedAt
```

### 5.4 Mapeamento de contas (passo de UX)

Como o usuário pode já ter contas cadastradas manualmente, no primeiro sync o app **pergunta** como mapear cada conta Pluggy: vincular a uma conta Quibo existente ou criar nova. Esse mapa fica em `pluggy_items.accountMapJson` e é reusado nos próximos syncs.

---

## 6. Sincronização sem webhook

### O problema do webhook

A forma "ideal" de sincronizar com a Pluggy é via **webhook** (a Pluggy avisa quando o Item atualizou). Mas webhook exige uma **URL pública** que receba a notificação — algo que um app desktop local-first **não tem** (não há servidor exposto).

### A estratégia do Quibo: refresh sob demanda / agendado

Em vez de webhook, **polling controlado**:

| Gatilho | Quando |
|---|---|
| **Ao abrir o app** | se passou > X horas desde o último sync (configurável) |
| **Botão "Atualizar"** | usuário pede explicitamente |
| **Agendado** | uma vez por dia (respeitando limites do plano — ver §13) |

```
refresh(item):
  Rust dispara update do Item na Pluggy (se suportado)
  aguarda/consulta status até "updated"
  GET /transactions desde lastSyncedAt
  cria entries novos (anti-duplicata)
  re-roda reconciliação
  atualiza lastSyncedAt
```

### Trade-off aceito

Sem webhook, os dados não são "tempo real" — são "atualizados na última vez que você abriu/pediu". Para finanças pessoais, isso é **perfeitamente adequado**: ninguém precisa do saldo ao segundo. A simplicidade compensa.

---

## 7. Produtos consumidos

A Pluggy expõe vários produtos por Item. O Quibo consome:

| Produto Pluggy | Uso no Quibo | Vira |
|---|---|---|
| **Account** | contas e saldos reais | `accounts` (ou mapeadas) |
| **Real Time Balance** | saldo atualizado | atualiza `accounts.balanceCents` |
| **Transaction** | movimentações reais | `entries` (com `pluggyTransactionId`) |
| **Transaction Categorization** | categoria já inferida | `entries.categoryId` / `tags` |
| **Credit Card Bills** | faturas e parcelas | `invoices` (derivar/conciliar) |
| **Credit Card Installments** | compras parceladas | metadados de parcela no entry |
| **Investment** | carteira | `investments` (doc 05) |
| **Investment Transactions** | aportes/resgates | histórico de investimento (doc 05) |
| **Loan** | empréstimos | reconciliar com `debts` |
| **Identity** | dados cadastrais | onboarding opcional (não essencial) |

### O que o Quibo NÃO usa

- **Payments / Pix / Smart Transfers / Boleto:** o Quibo **lê**, não **move** dinheiro. Iniciar pagamentos está fora de escopo (00 §11) — reduz risco, responsabilidade e superfície.

---

## 8. APIs de inteligência

A Pluggy tem APIs de inteligência que alimentam diretamente o motor de insights (doc 06) e a reconciliação (doc 02), de forma **determinística** — reduzindo o que sobra para o LLM.

| API | O que entrega | Uso no Quibo |
|---|---|---|
| **Recurring Payments Analysis** | identifica pagamentos recorrentes (assinaturas, contas fixas) | alimenta o estado "Apertado" → "você tem N assinaturas somando R$ X" |
| **Transaction Enrichment** | enriquece transações (merchant, categoria, metadados) | melhora categorização e descrição dos entries |
| **Connection Insights** | insights sobre a conexão/itens | diagnóstico e saúde da conexão |

### Por que isso importa para o produto

- A **detecção de recorrência** é exatamente o que o movimento "revisar assinaturas" (doc 06) precisa — e vem pronta, sem o LLM ter que adivinhar.
- O **enriquecimento** melhora a qualidade da categorização automática, reduzindo o trabalho manual do usuário.
- Tudo isso é **determinístico** (vem de regras/modelos da Pluggy), então alimenta o Pilar 1 (cálculo confiável), não o Pilar 3 (a voz). O LLM só **narra** esses fatos.

### Caminho futuro: MCP server da Pluggy

A Pluggy disponibiliza um **MCP server** e **skills de IA**. Lá na frente, a camada de IA do Quibo (doc 04) poderia consultar a Pluggy **diretamente via MCP** — por exemplo, o usuário pergunta "quanto gastei com streaming?" e o modelo busca via MCP. É um recurso de v2; o v1 usa os endpoints REST e grava local.

---

## 9. Mapeamento Pluggy → modelo Quibo

Como cada objeto da Pluggy se traduz no schema do documento 02.

### 9.1 Account → `accounts`

```
Pluggy Account                Quibo accounts
─────────────                 ───────────────
id            ────► (mapeado via accountMapJson, não vira PK)
name          ────► name (se conta nova)
type          ────► type (CHECKING/SAVINGS/...)
balance       ────► balanceCents (× 100, arredondado)
```

O usuário decide no mapeamento se a conta Pluggy vira uma conta nova ou se vincula a uma existente.

### 9.2 Transaction → `entries`

```
Pluggy Transaction            Quibo entries
──────────────────            ─────────────
id            ────► pluggyTransactionId (único, anti-duplicata)
description   ────► description
amount        ────► amountCents (× 100); sinal define type
date          ────► date, month, year
category      ────► categoryId (match) / tags
              ────► status = CONFIRMADO (já aconteceu)
              ────► accountId = conta mapeada
```

Transações importadas entram como **CONFIRMADO** (já são fato consumado), e a reconciliação tenta vinculá-las a compromissos.

### 9.3 Credit Card Bill → `invoices`

```
Pluggy Bill                   Quibo invoices
───────────                   ──────────────
totalAmount   ────► totalAmountCents
dueDate       ────► dueDate
month/year    ────► month, year (UNIQUE com creditCardId)
```

Compras do cartão (transactions com vínculo de cartão) viram `entries` com `creditCardId`; a fatura é derivada do ciclo (doc 02 §11.3) e a `invoices` materializada concilia com o total da Pluggy.

### 9.4 Investment → `investments`

```
Pluggy Investment             Quibo investments
─────────────────             ─────────────────
name/ticker   ────► name, ticker
type          ────► type (STOCK/FIXED_INCOME/...)
quantity      ────► quantity
value/price   ────► currentPriceCents
```

(Detalhe no documento 05.)

### 9.5 Loan → `debts` (reconciliação)

Empréstimos da Pluggy podem **reconciliar** com dívidas cadastradas manualmente, ou sugerir a criação de uma dívida — sempre com confirmação do usuário, para não duplicar.

---

## 10. Anti-duplicata e idempotência

Importação precisa ser **idempotente**: rodar o sync duas vezes não pode duplicar transações.

### Defesa em camadas

1. **No banco:** índice único parcial em `entries.pluggyTransactionId` (doc 02 §10). A mesma transação Pluggy nunca entra duas vezes — o banco rejeita.
2. **Na lógica:** o sync busca transações **desde `lastSyncedAt`** e faz upsert por `pluggyTransactionId`.
3. **Na reconciliação:** um entry importado que casa com um compromisso **não gera** um segundo entry "esperado".

### Atualização de transações existentes

Se a Pluggy revisar uma transação (ex.: categoria mudou após enriquecimento), o upsert atualiza o entry existente por `pluggyTransactionId`, preservando vínculos manuais do usuário (categoria que ele escolheu manualmente não é sobrescrita sem necessidade).

---

## 11. Reconciliação esperado × realizado

(O algoritmo completo está no documento 02 §12; aqui, a perspectiva Pluggy.)

Quando a Pluggy traz um débito de R$ 1.500 e o usuário tem um compromisso "Aluguel R$ 1.500", o sistema:

1. Pontua o match (valor + data + categoria enriquecida).
2. Se forte: vincula o entry ao compromisso, marca **CONFIRMADO**, e remove a necessidade de confirmar manualmente.
3. Se fraco: deixa em "Falta confirmar" com sugestão ("isto parece seu aluguel — confirmar?").
4. Aprende o mapeamento para acertar nos próximos meses.

Resultado: com a Pluggy conectada, **"Falta confirmar" encolhe** — sobra só o que o sistema não casou sozinho. Esse é o ápice da promessa "tão fácil que assusta".

---

## 12. Gestão de segredos, consentimento e LGPD

### Segredos

- `CLIENT_ID`/`CLIENT_SECRET` no **keychain do SO** (doc 01 §8). Nunca em texto plano, nunca na UI, nunca em log.
- API Key e Connect Token vivem só em memória no Rust, pelo tempo necessário.

### Consentimento (Open Finance)

- Conexões Open Finance têm **consentimento com expiração**. O Quibo monitora e avisa quando precisa re-consentir, com linguagem clara.
- **Deletar um Item** (revogar) é uma ação de um clique nas Integrações, que chama a Pluggy para remover a conexão e limpa as referências locais.

### LGPD e propriedade do dado

- O dado importado é do usuário e mora **na máquina dele**. O Quibo (autor) **não tem acesso** a nada — não há servidor que receba.
- A relação de tratamento de dado é entre **o usuário e a Pluggy** (a conta Pluggy é dele). O Quibo é só o cliente local que consome.
- Transparência total: a UI mostra quais Items estão conectados, quando sincronizaram, e permite desconectar e apagar a qualquer momento.

---

## 13. Limites, rate limits e estratégia de refresh

### Plano pessoal / gratuito

O autor usa a Pluggy **grátis a nível pessoal**. Planos gratuitos costumam ter **limites** (número de conexões, frequência de atualização, volume de chamadas). **Confirmar os limites atuais** no dashboard da Pluggy para dimensionar o refresh.

### Estratégia de refresh conservadora

Para caber no plano free e ser educado com a API:

- **Atualizar no máximo 1×/dia por Item** por padrão (configurável).
- **Coalescer** atualizações: ao abrir o app, atualizar só se passou do intervalo.
- **Backoff** em erro/limite: se a Pluggy retornar rate limit, espaçar e avisar o usuário.
- **Respeitar `Operational Rate Limits`** dos conectores Open Finance.

### Telemetria de uso (local)

A tela de diagnóstico (doc 01 §14) mostra ao usuário quantas atualizações foram feitas, para ele mesmo gerenciar o consumo do plano free.

---

## 14. Erros e degradação graciosa

A integração **nunca pode derrubar o app** (P: o Quibo funciona offline e sem Pluggy).

| Erro | Comportamento |
|---|---|
| Credencial inválida | "Não consegui validar suas chaves Pluggy. Confere e tenta de novo." |
| Login do banco falhou (no widget) | a Pluggy trata; o app mostra o status e oferece reconectar |
| Item precisa de input do usuário (MFA) | sinaliza "ação necessária" e reabre o widget |
| Consentimento expirado | avisa e oferece re-consentir |
| Rate limit / plano | "Você atingiu o limite de atualizações hoje. Tenta amanhã." |
| Pluggy fora do ar | degrada: usa dados locais; "não consegui atualizar agora" |
| Sync parcial | grava o que veio; marca o Item para retentar |

Toda mensagem segue P4 (linguagem de gente). Os dados já importados permanecem utilizáveis mesmo se a próxima atualização falhar.

---

## 15. Sandbox e desenvolvimento

- A Pluggy oferece **Sandbox** com conectores e dados de teste — usado no desenvolvimento do Quibo para exercitar o fluxo sem banco real.
- Os **quickstarts** e **SDKs server-side** da Pluggy servem de referência para implementar o cliente Rust (o Rust faz o papel de "server-side").
- Ambientes/configurações distinguem sandbox de produção; o Quibo expõe isso só em modo desenvolvedor.

### Estrutura do cliente Pluggy no código

```
src-tauri/src/pluggy/
  auth.rs          # CLIENT_ID/SECRET → API Key (cache 2h)
  connect_token.rs # API Key → Connect Token (30min, 1 por conexão)
  items.rs         # criar/registrar/atualizar/deletar Item
  products.rs      # accounts, transactions, bills, investments
  intelligence.rs  # recurring payments, enrichment
  sync.rs          # orquestra refresh idempotente
  map.rs           # Pluggy → entries/accounts/...
src/core/integrations/pluggy/   # parte TS não-secreta (tipos, UI do widget, status)
```

---

## 16. UX da integração

A integração precisa **honrar a promessa de simplicidade** (P1, P4) e a de transparência (P7).

### Princípios de UX

- **Opcional e fora do caminho:** quem não quer Pluggy nunca esbarra nela. Vive em Ajustes → Integrações.
- **Explicação humana antes de pedir chave:** "A Pluggy puxa seus extratos automaticamente, pra você não digitar nada. Suas chaves ficam só no seu computador."
- **Mapeamento guiado:** o passo de mapear contas é um wizard curto, não um formulário técnico.
- **Status visível:** cada banco conectado mostra "atualizado há 2h", com botão "Atualizar".
- **Confirmação assistida:** após sync, "Falta confirmar" mostra o que o sistema casou e o que precisa de um toque — com sugestões.
- **Desligar é fácil:** desconectar um banco e apagar os dados importados é um clique, sem labirinto.

### Telas envolvidas (ver doc 07)

- Ajustes → Integrações → Pluggy (conectar/desconectar, status).
- Wizard de conexão (widget Pluggy embutido + mapeamento de contas).
- Banner/seção na home quando há itens para confirmar pós-sync.

### O contrato de transparência (texto exemplo)

> "Ao conectar, o Quibo usa **suas** chaves Pluggy, guardadas só neste computador, para baixar seus extratos. Nada é enviado para o autor do Quibo — não existe servidor nosso. Você pode desconectar e apagar tudo quando quiser."

---

## 17. Decisões

| # | Decisão | Racional |
|---|---|---|
| PL-1 | Rust core = servidor seguro local | Resolver a exigência de "servidor" da Pluggy sem hospedar nada |
| PL-2 | BYOK (chaves do usuário no keychain) | Privacidade; cada usuário usa o próprio plano Pluggy |
| PL-3 | Sem webhook → refresh agendado/sob demanda | Local-first não tem URL pública; "tempo real" é desnecessário |
| PL-4 | Importar como `entries` CONFIRMADO + reconciliar | Unificar com o modelo; evitar dobrar esperado×realizado |
| PL-5 | Anti-duplicata por `pluggyTransactionId` único | Idempotência da importação no nível do banco |
| PL-6 | Só leitura (sem Payments/Pix) | Reduzir risco e responsabilidade; o Quibo lê, não move dinheiro |
| PL-7 | Inteligência da Pluggy alimenta o Pilar 1 (determinístico) | Recorrência/enriquecimento são fatos, não trabalho do LLM |
| PL-8 | Refresh ≤ 1×/dia por padrão | Caber no plano free e respeitar rate limits |
| PL-9 | Pluggy é 100% opcional | O Quibo funciona pleno sem ela (digitação manual) |
| PL-10 | MCP da Pluggy como caminho de v2 | Deixar a IA consultar a Pluggy direto no futuro |

---

*Fim do documento 03. Próximo: [04 — Integração com IA (BYOK)](./04-integracao-ia-byok.md). Anterior: [02 — Estrutura de Dados](./02-estrutura-de-dados.md).*
