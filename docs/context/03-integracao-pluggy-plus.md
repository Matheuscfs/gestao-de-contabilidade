# 📊 Guia Completo: Pluggy & meu.pluggy.ai — Integração Open Finance Pessoal

> Documento de contexto para desenvolvedores que querem integrar dados financeiros pessoais via Pluggy API, usando o meu.pluggy.ai como ponto de entrada gratuito.

---

## 1. O que é a Pluggy?

A Pluggy é uma plataforma de infraestrutura financeira que oferece uma **única API** para acessar dados do Open Finance brasileiro. Ela atua como intermediária entre você (desenvolvedor/usuário) e as instituições financeiras, coletando e padronizando dados como:

- Contas bancárias (corrente, poupança)
- Cartões de crédito e faturas
- Transações (até 12 meses de histórico)
- Investimentos (CDB, fundos, previdência, ações, ETFs etc.)
- Dados de identidade (nome, CPF, endereço, telefone)
- Empréstimos e financiamentos

A Pluggy é uma **Instituição de Pagamento autorizada pelo Banco Central do Brasil** (CNPJ 37.943.755/0001-30), operando como Iniciadora de Transação de Pagamento (ITP).

---

## 2. meu.pluggy.ai — A porta de entrada para uso pessoal

### O que é?

O **meu.pluggy.ai** é o kit de ferramentas Open Finance da Pluggy voltado especificamente para **desenvolvedores individuais e uso pessoal** — ou seja, não é necessário ter uma empresa ou CNPJ para começar.

### Por que é interessante para você?

| Característica | Detalhe |
|---|---|
| **Gratuito para desenvolvedores** | Acesso sem custo para projetos pessoais |
| **Dados atualizados** | Sincronização automática com suas contas |
| **Seguro** | Credenciais criptografadas, nunca expostas |
| **Integração fácil** | SDK oficial para JavaScript/Node.js |
| **Open Finance nativo** | Compatível com o ecossistema regulado do BC |

### Acesso

- **URL:** https://meu.pluggy.ai/overview
- **Autenticação:** Via Auth0 (login com Google ou e-mail)
- **Não requer CNPJ ou empresa:** É para pessoa física/desenvolvedor individual

---

## 3. Conceitos Fundamentais (Glossário)

Antes de integrar, você precisa entender os conceitos centrais:

### 🔌 Connector (Conector)
Representa a integração com uma instituição financeira específica (ex: Nubank, Itaú, XP Investimentos). Cada conector sabe como autenticar e buscar os produtos daquela instituição.

### 📦 Item
É a **representação de uma conexão** entre um usuário e um conector. Quando você conecta sua conta do Nubank, um "Item" é criado. O Item é o ponto de entrada para todos os dados coletados daquela conta.

- Um Item contém: contas, transações, investimentos, identidade, etc.
- Tem um `itemId` único que você usa para buscar os dados via API
- É criado uma vez e atualizado automaticamente (auto-sync)

### 🔑 API Key
Chave de autenticação que dá **acesso total à API** da Pluggy (server-side). Gerada a partir do seu `CLIENT_ID` e `CLIENT_SECRET`. Expira em **2 horas**.

### 🎫 Connect Token
Token de uso limitado, gerado a partir da API Key. Expira em **30 minutos**. É usado no **lado do cliente** (frontend/widget) para autenticar o usuário na interface de conexão. Tem acesso restrito: só pode ler dados do Item recém-criado.

### 📊 Produto (Product)
Dado financeiro padronizado coletado de uma instituição. Exemplos:
- `ACCOUNTS` — Contas bancárias
- `CREDIT_CARDS` — Cartões de crédito
- `TRANSACTIONS` — Transações
- `INVESTMENTS` — Investimentos
- `IDENTITY` — Dados de identidade
- `LOANS` — Empréstimos

---

## 4. Arquitetura e Fluxo de Dados

```
Você (usuário/dev)
       │
       ▼
  meu.pluggy.ai / Pluggy Connect Widget
       │  (autenticação com a instituição financeira)
       ▼
  Pluggy API (intermediária)
       │
       ▼
  Instituição Financeira (Nubank, Itaú, XP, etc.)
       │
       ▼
  Dados retornados: Contas, Transações, Investimentos, Identidade
```

**Fluxo resumido:**
1. Você gera um **Connect Token** no servidor
2. O widget (ou meu.pluggy.ai) usa o token para autenticar o usuário na instituição
3. Um **Item** é criado representando essa conexão
4. Você usa o `itemId` para buscar todos os dados via API
5. O auto-sync atualiza os dados automaticamente a cada 24h (ou menos, dependendo do plano)

---

## 5. Conectores Disponíveis para Pessoa Física (Personal)

| Conector | Identidade | Contas | Cartão | Transações | Investimentos | Auto-sync |
|---|---|---|---|---|---|---|
| **Caixa Econômica Federal** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Inter** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Itaú Cartões** | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Mercado Pago** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **MeuPluggy** ⭐ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Wise** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Banco do Brasil Previdência** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Ethereum** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

> ⭐ O conector **MeuPluggy** é o conector nativo do meu.pluggy.ai e tem cobertura completa.

Além dos conectores diretos, há suporte a **Open Finance Connectors** (regulado pelo BC), que inclui dezenas de bancos adicionais (Nubank, Bradesco, Santander, etc.) via consentimento OAuth.

---

## 6. Passo a Passo: Como Configurar e Integrar

### Etapa 1 — Criar sua conta no meu.pluggy.ai

1. Acesse https://meu.pluggy.ai/overview
2. Faça login com Google ou e-mail via Auth0
3. Conecte suas contas financeiras usando o widget de conexão
4. Após conectar, você terá acesso ao seu `itemId` pessoal

### Etapa 2 — Obter as credenciais da API

1. Acesse o **Dashboard da Pluggy**: https://dashboard.pluggy.ai
2. Crie uma conta (ou use a mesma do meu.pluggy.ai)
3. No Dashboard, obtenha seu **CLIENT_ID** e **CLIENT_SECRET**
4. Guarde essas credenciais com segurança — elas são o "segredo" da sua integração

> ⚠️ **NUNCA** exponha o CLIENT_ID e CLIENT_SECRET no frontend ou em repositórios públicos.

### Etapa 3 — Gerar uma API Key (Server-side)

A API Key é gerada a partir das suas credenciais e dá acesso completo à API:

```bash
curl -X POST https://api.pluggy.ai/auth \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "SEU_CLIENT_ID",
    "clientSecret": "SEU_CLIENT_SECRET"
  }'
```

**Resposta:**
```json
{
  "apiKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> ⏰ A API Key expira em **2 horas**. Regenere conforme necessário.

### Etapa 4 — Gerar um Connect Token (para uso no frontend)

```bash
curl -X POST https://api.pluggy.ai/connect_token \
  -H "X-API-KEY: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "clientUserId": "meu-usuario-123",
    "webhookUrl": "https://meu-servidor.com/webhook"
  }'
```

**Resposta:**
```json
{
  "accessToken": "ct_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> ⏰ O Connect Token expira em **30 minutos**.

### Etapa 5 — Usar o Pluggy Connect Widget

O widget é a interface que o usuário usa para conectar suas contas. Você pode embutir no seu app:

#### Instalação via npm
```bash
npm install react-pluggy-connect
# ou
yarn add react-pluggy-connect
```

#### Uso em React
```jsx
import { PluggyConnect } from 'react-pluggy-connect';

function App() {
  const [connectToken, setConnectToken] = useState('');

  useEffect(() => {
    fetch('/api/gerar-token')
      .then(res => res.json())
      .then(data => setConnectToken(data.accessToken));
  }, []);

  return (
    <PluggyConnect
      connectToken={connectToken}
      onSuccess={({ item }) => {
        console.log('Item criado com sucesso!', item.id);
        // Salve o item.id no seu banco de dados
      }}
      onError={({ message }) => {
        console.error('Erro na conexão:', message);
      }}
    />
  );
}
```

#### Uso via JavaScript puro
```html
<script src="https://cdn.pluggy.ai/pluggy-connect/v2.x.x/pluggy-connect.js"></script>
<script>
  const pluggyConnect = new PluggyConnect({
    connectToken: 'SEU_CONNECT_TOKEN',
    onSuccess: ({ item }) => console.log('Item ID:', item.id),
    onError: ({ message }) => console.error(message),
  });
  pluggyConnect.init();
</script>
```

### Etapa 6 — Buscar os dados financeiros

Com o `itemId` em mãos (obtido no `onSuccess`), você pode buscar todos os dados:

#### Com o SDK oficial (Node.js/JavaScript)
```bash
npm install pluggy-sdk
```

```javascript
import { PluggyClient } from 'pluggy-sdk';

const client = new PluggyClient({
  clientId: 'SEU_CLIENT_ID',
  clientSecret: 'SEU_CLIENT_SECRET',
});

const itemId = 'SEU_ITEM_ID';

// Buscar contas
const accounts = await client.fetchAccounts(itemId);
console.log(accounts);

// Buscar transações de uma conta
const transactions = await client.fetchTransactions(accounts.results[0].id);
console.log(transactions);

// Buscar investimentos
const investments = await client.fetchInvestments(itemId);
console.log(investments);

// Buscar identidade
const identity = await client.fetchIdentity(itemId);
console.log(identity);
```

#### Diretamente via REST API
```bash
# Buscar contas do Item
curl https://api.pluggy.ai/accounts?itemId=SEU_ITEM_ID \
  -H "X-API-KEY: SUA_API_KEY"

# Buscar transações de uma conta
curl "https://api.pluggy.ai/transactions?accountId=SEU_ACCOUNT_ID" \
  -H "X-API-KEY: SUA_API_KEY"

# Buscar investimentos
curl "https://api.pluggy.ai/investments?itemId=SEU_ITEM_ID" \
  -H "X-API-KEY: SUA_API_KEY"

# Buscar identidade
curl "https://api.pluggy.ai/identity?itemId=SEU_ITEM_ID" \
  -H "X-API-KEY: SUA_API_KEY"
```

---

## 7. Exemplos de Dados Retornados

### Conta Bancária
```json
{
  "id": "a658c848-e475-457b-8565-d1fffba127c4",
  "type": "BANK",
  "subtype": "CHECKING_ACCOUNT",
  "number": "0001/12345-0",
  "name": "Conta Corrente",
  "balance": 1209.50,
  "currencyCode": "BRL",
  "owner": "João Silva",
  "taxNumber": "***.***.123-00"
}
```

### Transação
```json
{
  "id": "6ec156fe-e8ac-4d9a-a4b3-7770529ab01c",
  "description": "PIX - Pagamento Netflix",
  "amount": -55.90,
  "date": "2024-06-15T00:00:00.000Z",
  "balance": 1153.60,
  "category": "Streaming",
  "type": "DEBIT",
  "status": "POSTED",
  "currencyCode": "BRL"
}
```

### Investimento
```json
{
  "name": "CDB Nubank 100% CDI",
  "type": "FIXED_INCOME",
  "subtype": "CDB",
  "balance": 5230.45,
  "amount": 5000.00,
  "amountProfit": 230.45,
  "annualRate": 13.25,
  "rateType": "CDI",
  "dueDate": "2025-12-31T00:00:00.000Z",
  "status": "ACTIVE"
}
```

### Identidade
```json
{
  "fullName": "João Silva",
  "document": "***.***.123-00",
  "documentType": "CPF",
  "birthDate": "1990-05-01T00:00:00.000Z",
  "emails": [{ "type": "Personal", "value": "joao@email.com" }],
  "phoneNumbers": [{ "type": "Personal", "value": "+55 (11) 99999-9999" }],
  "addresses": [{
    "fullAddress": "Av. Paulista, 1234, São Paulo, SP",
    "city": "São Paulo",
    "state": "SP",
    "postalCode": "01310-100"
  }]
}
```

---

## 8. Ciclo de Vida do Item (Status)

| Status | Significado |
|---|---|
| `UPDATING` | Sincronizando com a instituição |
| `UPDATED` | Dados atualizados com sucesso ✅ |
| `LOGIN_ERROR` | Credenciais inválidas — requer nova autenticação |
| `OUTDATED` | Erro inesperado — pode ser reprocessado |
| `WAITING_USER_INPUT` | Aguardando MFA ou ação do usuário |

**Fluxo típico de execução:**
```
CREATED → LOGIN_IN_PROGRESS → ACCOUNTS_IN_PROGRESS
→ CREDITCARDS_IN_PROGRESS → TRANSACTIONS_IN_PROGRESS
→ IDENTITY_IN_PROGRESS → MERGING → SUCCESS
```

**Estados de execução finais:**

| Status | Descrição |
|---|---|
| `SUCCESS` | Tudo coletado com sucesso |
| `PARTIAL_SUCCESS` | Coletado com sucesso, mas alguns produtos falharam |
| `INVALID_CREDENTIALS` | Usuário/senha incorretos |
| `SITE_NOT_AVAILABLE` | Instituição fora do ar |
| `ACCOUNT_LOCKED` | Conta bloqueada na instituição |
| `ACCOUNT_NEEDS_ACTION` | Usuário precisa agir (ex: aceitar termos) |
| `CONNECTION_ERROR` | Falha de conexão com a instituição |

---

## 9. Auto-sync — Atualização Automática

Uma das funcionalidades mais importantes para projetos pessoais:

- O Pluggy atualiza seus dados automaticamente **a cada 24h** (plano base)
- Funciona via **credenciais criptografadas** armazenadas de forma segura
- Quando há erro de login, o auto-sync para até o usuário reconectar
- O campo `nextAutoSyncAt` no Item indica quando será a próxima atualização
- **Itens Sandbox** são deletados após 30 dias sem atualização
- Em caso de erro não-fatal, a Pluggy retenta a cada 1h por até 5 tentativas

> ⚠️ O auto-sync é feature de produção. Em ambiente Sandbox, você precisa atualizar manualmente.

---

## 10. Webhooks — Notificações em Tempo Real

Para um app pessoal automatizado, os webhooks são essenciais. Eles enviam um POST para sua URL quando eventos acontecem:

| Evento | Quando dispara |
|---|---|
| `item/created` | Item conectado pela primeira vez |
| `item/updated` | Dados do item sincronizados |
| `item/error` | Erro na sincronização |
| `item/deleted` | Item removido |
| `transactions/created` | Novas transações coletadas |
| `transactions/updated` | Transações existentes atualizadas |
| `transactions/deleted` | Transações removidas |

**Exemplo de payload de webhook (novas transações):**
```json
{
  "event": "transactions/created",
  "itemId": "de7bbf5a-abf2-47e4-94b1-586b36758423",
  "accountId": "0d5a0de2-9c82-4ea2-af50-31643a632a33",
  "createdTransactionsLink": "https://api.pluggy.ai/transactions?accountId=..."
}
```

**Como configurar:**
```bash
curl -X POST https://api.pluggy.ai/connect_token \
  -H "X-API-KEY: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "webhookUrl": "https://meu-servidor.com/webhook" }'
```

**Recebendo o webhook no seu servidor (Node.js/Express):**
```javascript
app.post('/webhook', (req, res) => {
  const { event, itemId, accountId, createdTransactionsLink } = req.body;

  switch (event) {
    case 'transactions/created':
      // buscar e salvar as novas transações
      syncNewTransactions(accountId, createdTransactionsLink);
      break;
    case 'item/updated':
      console.log('Item atualizado:', itemId);
      break;
    case 'item/error':
      console.error('Erro no item:', itemId);
      break;
  }

  res.json({ ok: true });
});
```

---

## 11. Ambiente Sandbox — Teste sem dados reais

Antes de conectar suas contas reais, use o **Sandbox** para testar:

### Credenciais de teste (conectores diretos)

| Cenário | Usuário | Senha | MFA |
|---|---|---|---|
| Sucesso | `user-ok` | `password-ok` | `123456` |
| Credenciais inválidas | qualquer outro | qualquer | — |
| Conta bloqueada | `user-locked` | `password-ok` | — |
| Erro inesperado | `user-error` | `password-ok` | — |
| Site indisponível | `user-unavailable` | `password-ok` | — |

### Credenciais Open Finance Sandbox

| Cenário | CPF |
|---|---|
| Fluxo básico | `761.092.776-73` |
| Fluxo com múltiplas autorizações (aprovado) | `238.242.640-30` |
| Fluxo com múltiplas autorizações (rejeitado) | `051.177.670-55` |

- **E-mail:** ralph.bragg@gmail.com
- **Senha:** P@ssword01

### Habilitando Sandbox no widget
```jsx
<PluggyConnect
  connectToken={connectToken}
  includeSandbox={true}  // mostra conectores de teste
/>
```

---

## 12. Posso Montar um App Pessoal Automatizado?

**Sim!** Esse é exatamente o propósito do **meu.pluggy.ai** para desenvolvedores. Veja o que é possível:

### ✅ O que você pode construir

- **Dashboard financeiro pessoal** com todas suas contas e investimentos centralizados
- **Alertas de gastos** por categoria (o Pluggy categoriza as transações automaticamente)
- **Controle de orçamento** com histórico de até 12 meses
- **Acompanhamento de investimentos** em tempo real
- **Relatórios financeiros** personalizados em PDF ou planilha
- **Integração com Google Sheets / Notion / Airtable** via webhook
- **Bot no Telegram/WhatsApp** que envia resumo diário
- **App mobile** usando React Native + pluggy-sdk
- **Alertas de saldo baixo** ou transações acima de um valor

### 🏗️ Arquitetura Sugerida para App Pessoal

```
┌─────────────────────────────────────────┐
│          SEU BACKEND (Node.js)          │
│                                         │
│  1. Armazena CLIENT_ID/SECRET (env)     │
│  2. Gera API Key quando necessário      │
│  3. Gera Connect Token para o front     │
│  4. Recebe webhooks da Pluggy           │
│  5. Salva dados no banco local          │
│  6. Expõe API para seu frontend         │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│  SEU FRONTEND │  │  Pluggy API      │
│  (React/Next) │  │  (dados reais)   │
│               │  │                  │
│  Widget de    │◄─┤  Items, Contas,  │
│  conexão      │  │  Transações,     │
│  Dashboard    │  │  Investimentos   │
└───────────────┘  └──────────────────┘
```

### 📋 Stack Tecnológico Recomendado

| Camada | Opção |
|---|---|
| Backend | Node.js + Express ou Next.js API Routes |
| Frontend | React / Next.js / Vue |
| Database | PostgreSQL / SQLite / MongoDB |
| SDK | pluggy-sdk (npm) |
| Webhooks (dev) | ngrok |
| Webhooks (prod) | Vercel / Railway / Render |
| Deploy | Vercel / Railway / Fly.io |

### 🚀 Exemplo de App Mínimo com Next.js

```javascript
// pages/api/gerar-token.js — SERVER-SIDE ONLY
import { PluggyClient } from 'pluggy-sdk';

export default async function handler(req, res) {
  const client = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET,
  });

  const { accessToken } = await client.createConnectToken(null, {
    webhookUrl: process.env.WEBHOOK_URL,
    clientUserId: 'meu-usuario-pessoal',
  });

  res.json({ accessToken });
}
```

```javascript
// pages/api/dados.js — SERVER-SIDE ONLY
import { PluggyClient } from 'pluggy-sdk';

export default async function handler(req, res) {
  const { itemId, accountId } = req.query;

  const client = new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET,
  });

  const accounts     = await client.fetchAccounts(itemId);
  const transactions = await client.fetchTransactions(accountId);
  const investments  = await client.fetchInvestments(itemId);
  const identity     = await client.fetchIdentity(itemId);

  res.json({ accounts, transactions, investments, identity });
}
```

```javascript
// pages/api/webhook.js — Recebe eventos automáticos da Pluggy
export default async function handler(req, res) {
  const { event, itemId, accountId, createdTransactionsLink } = req.body;

  if (event === 'transactions/created') {
    // Busca e salva novas transações no banco local
    console.log('Novas transações para conta:', accountId);
    // await salvarTransacoes(createdTransactionsLink);
  }

  if (event === 'item/updated') {
    console.log('Item atualizado com sucesso:', itemId);
  }

  res.json({ ok: true });
}
```

```jsx
// pages/index.jsx — Frontend com o Widget
import { PluggyConnect } from 'react-pluggy-connect';
import { useState, useEffect } from 'react';

export default function Home() {
  const [connectToken, setConnectToken] = useState('');
  const [itemId, setItemId] = useState(null);

  useEffect(() => {
    fetch('/api/gerar-token')
      .then(r => r.json())
      .then(d => setConnectToken(d.accessToken));
  }, []);

  return (
    <div>
      <h1>Meu App Financeiro</h1>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={({ item }) => {
            setItemId(item.id);
            localStorage.setItem('pluggyItemId', item.id);
            alert('Conta conectada! ID: ' + item.id);
          }}
          onError={({ message }) => alert('Erro: ' + message)}
        />
      )}

      {itemId && (
        <button onClick={() => fetch('/api/dados?itemId=' + itemId)
          .then(r => r.json())
          .then(d => console.log(d))
        }>
          Buscar meus dados
        </button>
      )}
    </div>
  );
}
```

---

## 13. Variáveis de Ambiente Necessárias

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Obtidas no Dashboard: https://dashboard.pluggy.ai
PLUGGY_CLIENT_ID=seu_client_id_aqui
PLUGGY_CLIENT_SECRET=seu_client_secret_aqui

# URL onde seu servidor receberá os webhooks da Pluggy
# Em desenvolvimento: use ngrok (ex: https://abc123.ngrok.io/api/webhook)
# Em produção: sua URL real
WEBHOOK_URL=https://seu-dominio.com/api/webhook
```

> ⚠️ **NUNCA** comite o arquivo `.env` no repositório. Adicione ao `.gitignore`.

---

## 14. Considerações Importantes e Limitações

### Segurança
- Nunca exponha `CLIENT_ID` e `CLIENT_SECRET` no frontend
- Gere sempre o Connect Token no servidor (backend)
- API Keys expiram em 2h — o SDK as renova automaticamente
- Credenciais das instituições são criptografadas pela Pluggy e nunca retornadas via API

### Limitações do plano pessoal (meu.pluggy.ai)
- Funcionalidades gratuitas para uso pessoal/desenvolvimento
- Auto-sync disponível a cada 24h no plano base
- Alguns conectores Open Finance avançados podem requerer plano pago
- Itens Sandbox são deletados após **30 dias** sem atualização

### Paginação de transações
- Transações são retornadas em páginas de **500 registros**
- Use cursor-based pagination com o campo `next` na resposta
- Histórico disponível: até **12 meses**
- Busque sempre do mais recente para o mais antigo

### Convenção de sinais — Cartão de crédito
- Valores **positivos** = débito (você gastou, aumenta a fatura)
- Valores **negativos** = crédito (pagamento de fatura, reduz o saldo devedor)

### Retenção de dados
- Ao deletar um Item (DELETE /items/{id}), todos os dados associados são permanentemente removidos
- Conectores depreciados pela Pluggy são removidos após 30 dias — migre antes desse prazo

---

## 15. Links Úteis

| Recurso | URL |
|---|---|
| meu.pluggy.ai | https://meu.pluggy.ai/overview |
| Dashboard (credenciais) | https://dashboard.pluggy.ai |
| Documentação oficial | https://docs.pluggy.ai |
| API Reference | https://pluggy.readme.io/reference |
| SDK Node.js (npm) | https://www.npmjs.com/package/pluggy-sdk |
| Quickstart no GitHub | https://github.com/pluggyai/quickstart |
| Demo interativo | https://pluggy.ai/demo |
| Status dos serviços | https://status.pluggy.ai |
| Discord da comunidade | https://discord.gg/EanrwJADby |

---

## 16. Resumo do Fluxo Completo

```
1. Criar conta em meu.pluggy.ai
          ↓
2. Obter CLIENT_ID e CLIENT_SECRET no Dashboard
          ↓
3. No seu servidor: gerar API Key (POST /auth)
          ↓
4. No seu servidor: gerar Connect Token (POST /connect_token)
          ↓
5. No frontend: inicializar Pluggy Connect Widget com o token
          ↓
6. Usuário autentica na instituição financeira via Widget
          ↓
7. Item criado → onSuccess retorna o itemId
          ↓
8. Salve o itemId no seu banco de dados
          ↓
9. Use itemId para buscar dados via API:
   - GET /accounts?itemId=...
   - GET /transactions?accountId=...
   - GET /investments?itemId=...
   - GET /identity?itemId=...
          ↓
10. Configure webhooks para receber atualizações automáticas
          ↓
11. Auto-sync mantém os dados atualizados a cada 24h ✅
```

---

*Documento gerado com base na documentação oficial da Pluggy (docs.pluggy.ai) e no produto meu.pluggy.ai — junho de 2026.*
