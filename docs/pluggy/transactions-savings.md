# transactions-savings

Transações de conta poupança. Estrutura idêntica à conta corrente (`transactions-checking`), com diferenças pontuais de operationType.

## Diferenças em relação à conta corrente

- Operações típicas: rendimento (`CREDITO`), transferência entre contas do mesmo banco, débito automático.
- `operationType` pode ser `null` em alguns lançamentos de rendimento.
- Menor volume: poupanças tendem a ter muito menos transações que contas correntes.
- `paymentData` pode ser `null` em rendimentos automáticos.

## Campos principais

Consultar `transactions-checking.md` — os campos são os mesmos.

## Observações

- Rendimento da poupança aparece como `type: "CREDIT"` com `amount` positivo.
- Transferência entre contas do mesmo CPF aparece em ambas as contas (saída na corrente, entrada na poupança).
- `balance` após a transação raramente é preenchido neste conector.

## Amostra

Arquivo: `transactions-savings.json`
Conta: `bae3fda3` — itau Poupança
Total disponível na API: **27 transações**
Amostra: 20 mais recentes
