# item

Representa a conexão entre o usuário e a instituição. É o ponto de entrada da API — todo o restante (contas, transações) é obtido a partir do `id` deste objeto.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID | Identificador único da conexão |
| `status` | enum | Estado atual: `UPDATED`, `UPDATING`, `LOGIN_ERROR`, `OUTDATED`, `WAITING_USER_INPUT` |
| `executionStatus` | enum | Resultado da última execução: `SUCCESS`, `PARTIAL_SUCCESS`, `ERROR`, etc. |
| `lastUpdatedAt` | ISO 8601 | Última vez que os dados foram sincronizados com o banco |
| `nextAutoSyncAt` | ISO 8601 | Quando a Pluggy rodará a próxima atualização automática |
| `error` | object \| null | Preenchido se `status = LOGIN_ERROR` — contém `code` e `message` |
| `connector.id` | number | ID do conector (200 = MeuPluggy) |
| `connector.name` | string | Nome legível da instituição |
| `connector.oauth` | boolean | `true` para MeuPluggy (fluxo OAuth sem credenciais diretas) |
| `products` | string[] | Escopos autorizados pelo usuário: `ACCOUNTS`, `TRANSACTIONS`, `CREDIT_CARDS`, etc. |
| `clientUserId` | string \| null | ID passado pelo desenvolvedor no `connect_token` para identificar o usuário |

## Observações

- `GET /items/{id}` retorna este objeto completo.
- `GET /items` (listar todos) **retorna 401** — bloqueado pela Pluggy por segurança.
- O ciclo de vida típico: `UPDATING` → `UPDATED`. Se as credenciais expirarem: `LOGIN_ERROR`.
- `nextAutoSyncAt` deve ser usado como referência para evitar sincronizações desnecessárias.
- O conector `200` (MeuPluggy) é o único que usa OAuth — não armazena senha do usuário.

## Amostra

Arquivo: `item.json`
Item ID: `c1137175-cf43-4223-9c4b-4c5ac2451512`
Conector: MeuPluggy (OAuth)
Status: `UPDATED` / `SUCCESS`
Última sync: `2026-06-27T16:36:30`
Próxima sync: `2026-06-28T16:36:30`
