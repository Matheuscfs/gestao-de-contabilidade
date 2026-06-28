# accounts

Lista de contas vinculadas a um item. Retornada por `GET /accounts?itemId={id}`.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Identificador da conta na Pluggy |
| `itemId` | UUID | Item ao qual pertence |
| `type` | enum | `BANK` ou `CREDIT` |
| `subtype` | enum | `CHECKING_ACCOUNT`, `SAVINGS_ACCOUNT`, `CREDIT_CARD`, `INVESTMENT` |
| `name` | string | Nome da conta como aparece no banco |
| `number` | string | Agência/conta ou últimos dígitos do cartão |
| `balance` | float | Saldo em reais (⚠ float — converter para centavos ao salvar) |
| `currencyCode` | string | Sempre `BRL` nas contas BR |
| `owner` | string | Nome do titular |
| `taxNumber` | string \| null | CPF/CNPJ do titular (nem sempre presente) |
| `bankData` | object \| null | Dados extras de conta bancária (saldo de fechamento, cheque especial) |
| `creditData` | object \| null | Dados de cartão: limite, vencimento, bandeira, nível, parcelas |

### creditData (cartão)

| Campo | Tipo | Descrição |
|---|---|---|
| `brand` | string | `VISA`, `MASTERCARD`, etc. |
| `level` | string | `BLACK`, `SIGNATURE`, `GOLD`, etc. |
| `creditLimit` | float | Limite total |
| `availableCreditLimit` | float | Limite disponível |
| `balanceDueDate` | date | Data de vencimento da fatura |
| `minimumPayment` | float | Pagamento mínimo |
| `additionalCards` | array | Cartões adicionais (só o número final) |

## Observações

- `balance` é float na API. O Quibo converte para centavos inteiros: `round(balance * 100)`.
- Para cartões, `balance` representa o total da fatura atual (o que foi gasto), não o disponível.
- O mesmo `number` pode aparecer em duas contas do mesmo banco (ex: conta corrente e poupança com mesma agência/conta).
- `taxNumber` do titular está presente na conta corrente, ausente nos cartões.

## Amostra

Arquivo: `accounts.json`
Item: `c1137175-cf43-4223-9c4b-4c5ac2451512` (MeuPluggy — Itaú)
Total de contas: 4

| id (8 chars) | Tipo | Nome | Saldo |
|---|---|---|---|
| `bae3fda3` | BANK / SAVINGS | itau — Poupança | R$ 1,33 |
| `19e7672f` | CREDIT / CARD | Itau Uniclass Visa Signature ••2127 | R$ 0,00 |
| `08eebba0` | CREDIT / CARD | Itau Uniclass Mastercard Black ••0069 | R$ 7.271,77 |
| `2136bd9f` | BANK / CHECKING | itau — Corrente | R$ 520,00 |
