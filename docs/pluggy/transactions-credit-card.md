# transactions-credit-card

Transações de cartão de crédito. Retornadas por `GET /transactions?accountId={id}`. Mesma estrutura das transações bancárias, com o campo adicional `creditCardMetadata`.

## Campos específicos de cartão

| Campo | Tipo | Descrição |
|---|---|---|
| `creditCardMetadata` | object \| null | Presente apenas em transações de cartão |
| `creditCardMetadata.cardNumber` | string | Últimos 4 dígitos do cartão que realizou a compra |
| `creditCardMetadata.purchaseDate` | ISO 8601 | Data real da compra |
| `creditCardMetadata.totalInstallments` | number \| null | Total de parcelas |
| `creditCardMetadata.installmentNumber` | number \| null | Número desta parcela |
| `creditCardMetadata.payeeMCC` | number \| null | Código MCC do estabelecimento |

## Diferenças em relação à conta bancária

- `amount` é **sempre positivo** mesmo sendo um gasto — representa o valor cobrado na fatura.
- `date` é a data em que aparece na **fatura**, não a data da compra (`purchaseDate` é a data real).
- Parcelas futuras aparecem com `status: "PENDING"` e `date` no mês da cobrança.
- `paymentData` costuma ser `null` em transações de crédito.
- `operationType` costuma ser `null` (diferente de débito/PIX onde é preenchido).

## Observações sobre parcelas

Uma compra parcelada gera **uma transação por parcela**, cada uma com:
- `date` = mês de cobrança daquela parcela na fatura
- `creditCardMetadata.installmentNumber` = número da parcela atual
- `creditCardMetadata.totalInstallments` = total de parcelas
- IDs diferentes por parcela (são registros independentes na Pluggy)

Ao importar, tratar cada parcela como um lançamento independente — não agrupar.

## Observações

- `amount` float → centavos: `round(amount * 100)`.
- Parcelas pagas e futuras coexistem na mesma listagem.
- Cartões adicionais aparecem com `cardNumber` diferente do titular.
- `additionalCards` em `creditData` (em `accounts`) lista os números dos cartões adicionais.

## Amostra

Arquivo: `transactions-credit-card.json`
Conta: `08eebba0` — Itau Uniclass Mastercard Black ••0069
Total disponível na API: **395 transações**
Amostra: 20 mais recentes (mix de `POSTED` e `PENDING`)
