# transactions-checking

Transações de conta bancária (corrente ou poupança). Retornadas por `GET /transactions?accountId={id}`.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | ID único da transação na Pluggy (usar como chave de idempotência) |
| `accountId` | UUID | Conta à qual pertence |
| `description` | string | Descrição processada/normalizada pela Pluggy |
| `descriptionRaw` | string | Descrição original do banco |
| `amount` | float | Valor em reais. **Negativo = saída, positivo = entrada** |
| `date` | ISO 8601 | Data da transação |
| `type` | enum | `DEBIT` ou `CREDIT` |
| `operationType` | string \| null | `PIX`, `CARTAO`, `TED`, `DOC`, `BOLETO`, `OUTROS`, `OPERACAO_CREDITO` |
| `status` | enum | `POSTED` (confirmada) ou `PENDING` (pendente) |
| `category` | string \| null | Categoria em inglês atribuída pela Pluggy |
| `categoryId` | string \| null | ID numérico da categoria |
| `paymentData` | object \| null | Detalhes do pagamento (pagador, recebedor, chave Pix) |
| `balance` | float \| null | Saldo após a transação (nem sempre presente) |

### paymentData

| Campo | Tipo | Descrição |
|---|---|---|
| `paymentMethod` | string | `PIX`, `OTHER`, `TED`, `DOC`, `BOLETO` |
| `payer.documentNumber` | object | CPF/CNPJ do pagador com `type` e `value` |
| `receiver.name` | string | Nome do recebedor |
| `receiver.documentNumber` | object | CPF/CNPJ do recebedor |
| `receiver.routingNumber` | string | ISPB do banco do recebedor |

## Observações

- `amount` é float na API. Converter para centavos inteiros: `round(amount * 100)`.
- Transações de **débito** chegam com `amount` negativo. Créditos chegam positivos.
- `operationType = "CARTAO"` indica compra no débito (não confundir com fatura).
- `operationType = "OPERACAO_CREDITO"` inclui seguros, empréstimos, capitalização.
- `paymentData.payer.documentNumber` é o CPF do titular na maioria das saídas.
- `category` vem em inglês — o Gestão de Contabilidade deve mapear para categorias próprias.
- Paginação: `pageSize` máximo é 500. Usar `page` para iterar.

## Amostra

Arquivo: `transactions-checking.json`
Conta: `2136bd9f` — itau Conta Corrente
Total disponível na API: **1.597 transações**
Amostra: 20 mais recentes

Operações encontradas na amostra: `PIX`, `CARTAO`, `OUTROS`, `OPERACAO_CREDITO`
