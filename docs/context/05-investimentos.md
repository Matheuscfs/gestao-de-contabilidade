# Quibo — Investimentos & Mercado

> Como o Quibo acompanha o patrimônio investido, traz cotações de mercado e oferece "opções bacanas" de investimento — sempre como acompanhamento e opções, nunca como corretora ou recomendação definitiva. Pré-requisitos: [00](./00-visao-geral-produto.md), [02](./02-estrutura-de-dados.md), [04](./04-integracao-ia-byok.md), [06](./06-motor-de-insights.md).

---

## Sumário

1. [Papel dos investimentos no Quibo](#1-papel-dos-investimentos-no-quibo)
2. [Filosofia: acompanhar, não aconselhar](#2-filosofia-acompanhar-não-aconselhar)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Tipos de investimento](#4-tipos-de-investimento)
5. [Dados de mercado (cotações)](#5-dados-de-mercado-cotações)
6. [Cálculos de carteira](#6-cálculos-de-carteira)
7. [Integração com a Pluggy](#7-integração-com-a-pluggy)
8. [Reserva de emergência: o gate antes de investir](#8-reserva-de-emergência-o-gate-antes-de-investir)
9. [Análises e "opções bacanas"](#9-análises-e-opções-bacanas)
10. [Conexão com o motor de insights](#10-conexão-com-o-motor-de-insights)
11. [Como aparece nas telas](#11-como-aparece-nas-telas)
12. [Atualização de cotações](#12-atualização-de-cotações)
13. [Guardrails e perfil de risco](#13-guardrails-e-perfil-de-risco)
14. [Privacidade](#14-privacidade)
15. [Decisões](#15-decisões)

---

## 1. Papel dos investimentos no Quibo

O domínio de investimentos cumpre dois papéis:

1. **Patrimônio:** mostrar quanto o usuário tem investido e como está rendendo — uma foto do patrimônio que complementa o fluxo de caixa mensal.
2. **Destino da sobra:** quando o mês fecha com sobra (estado `SOBRA_BOA`, doc 06), investir é um dos **movimentos** sugeridos — e o Quibo precisa oferecer **opções bacanas** de forma inteligente.

### Onde se encaixa

```
Fluxo mensal (entra/sai/sobra)          Patrimônio (investimentos)
─────────────────────────────          ──────────────────────────
sobra do mês  ───────────────────────►  aporte sugerido
                                         valor de mercado + rentabilidade
                                         alocação e diversificação
```

Investimentos **não fazem parte do v1** (00 §11) — entram em v1.5/v2, depois que o núcleo de fluxo mensal estiver redondo. Mas o modelo já é desenhado aqui para não retrabalhar.

---

## 2. Filosofia: acompanhar, não aconselhar

O Quibo **não é** uma corretora, **não é** um robô-trader, **não é** um consultor de investimentos registrado. Ele:

- **Acompanha** o que o usuário já tem (carteira manual ou via Pluggy).
- **Calcula** valor de mercado, rentabilidade, alocação — determinístico (Pilar 1, P8).
- **Sugere opções** de forma educativa e genérica ("você tem muita concentração em renda variável; diversificar reduz risco"), **nunca** "compre X" ou "venda Y".

### Por que essa linha é firme

- **Legal/ético:** recomendação de investimento específica é atividade regulada. O Quibo, sendo ferramenta pessoal open-source sem registro, **não** entra nesse terreno.
- **Confiança:** prometer "dicas que enriquecem" é o caminho de apps duvidosos. O Quibo é honesto: ele organiza e mostra opções, a decisão é do usuário.
- **Coerência com P8:** a IA **nunca** decide nem calcula retorno futuro; ela **explica** análises determinísticas e fala em **opções**, não certezas (ver doc 04 §13).

### A régua mental

> "Opções bacanas" = recortes inteligentes e educativos sobre a **carteira que já existe** e sobre **onde a sobra poderia ir**, em linguagem de gente. Nunca = sinal de compra/venda, nunca = promessa de rentabilidade.

---

## 3. Modelo de dados

(Recapitulado de 02 §7, com detalhes.)

### `investments`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | TEXT (uuid) | PK |
| `name` | TEXT | "PETR4", "Tesouro Selic 2029" |
| `type` | TEXT | STOCK \| CRYPTO \| FIXED_INCOME \| REAL_ESTATE \| ETF \| PENSION \| OTHER |
| `ticker` | TEXT? | símbolo (PETR4, BTC, HGLG11) |
| `quantity` | REAL | quantidade (8 casas p/ cripto) |
| `purchasePriceCents` | INTEGER | preço médio de compra (centavos) |
| `currentPriceCents` | INTEGER? | última cotação conhecida |
| `purchaseDate` | TEXT | data do aporte/compra |
| `broker` | TEXT? | corretora |
| `personaId` | TEXT? | SET NULL |
| `notes` | TEXT? | |
| `accountId` | TEXT? | conta de investimento associada (opcional) |
| `lastQuoteAt` | TEXT? | quando a cotação foi atualizada |

### `investment_transactions` (aportes/resgates — v2)

| Campo | Tipo |
|---|---|
| `id` | TEXT |
| `investmentId` | TEXT (FK, CASCADE) |
| `type` | TEXT (BUY \| SELL \| DIVIDEND \| YIELD) |
| `quantity` | REAL |
| `priceCents` | INTEGER |
| `date` | TEXT |

### O que é derivado (nunca armazenado)

- **valor de mercado** = `quantity × currentPrice`
- **lucro/prejuízo** = `valorAtual − (quantity × purchasePrice)`
- **rentabilidade %** = `(valorAtual − custo) / custo`
- **alocação por tipo/ticker** = participação no total

Derivar evita inconsistência: a carteira sempre reflete a última cotação + os aportes.

---

## 4. Tipos de investimento

| Tipo | Exemplos | Cotação | Notas |
|---|---|---|---|
| `STOCK` | PETR4, VALE3, ITUB4 | B3 (intraday/fechamento) | quantidade inteira |
| `ETF` | BOVA11, IVVB11 | B3 | como ação |
| `REAL_ESTATE` | FIIs: HGLG11, MXRF11 | B3 | rendimento mensal (dividendos) |
| `FIXED_INCOME` | Tesouro, CDB, LCI/LCA | curva/indexador | rentabilidade por indexador (Selic, CDI, IPCA+) |
| `CRYPTO` | BTC, ETH | exchanges/agregadores | 8 casas decimais; alta volatilidade |
| `PENSION` | previdência (PGBL/VGBL) | cotas | atualização menos frequente |
| `OTHER` | o que não encaixa | manual | valor informado pelo usuário |

### Particularidades de cálculo

- **Renda fixa** não tem "preço" de mercado simples como ação; modela-se por **indexador + data** (ex.: "100% do CDI desde 01/2026"), e o valor atual é projetado, não cotado. Para o v2, manter simples: o usuário informa o valor atual ou conecta via Pluggy.
- **Cripto** precisa de precisão decimal alta na `quantity`.
- **FIIs e ações** com dividendos/proventos: tratados como **entradas** (entries INCOME) quando recebidos, separados do valor da cota.

---

## 5. Dados de mercado (cotações)

Para mostrar valor atual e rentabilidade, o Quibo busca cotações — coerente com local-first e BYOK.

### Princípios

- **Cotação é dado público** (preço de um ativo), então a sensibilidade de privacidade é baixa (diferente do extrato).
- **A carteira é local;** o que sai para o provedor de cotação é só o **ticker** ("quanto vale PETR4?"), não quanto o usuário tem.
- **BYOK quando necessário:** provedores que exigem chave usam a chave do usuário (keychain).

### Provedores candidatos

| Provedor | Cobre | Chave | Notas |
|---|---|---|---|
| **brapi.dev** | ações/FIIs/ETFs B3 | opcional/BYOK | focado em mercado brasileiro |
| **Yahoo Finance** (não oficial) | global + B3 | não | instável; usar com cuidado |
| **Alpha Vantage** | global | BYOK | rate limit no free |
| **CoinGecko** | cripto | opcional | bom para cripto |
| **Pluggy (Investments)** | carteira do usuário | já conectado | traz posição e valor direto do banco |

A interface de cotação é abstrata (como a de IA, doc 04 §3): trocar de provedor é configuração.

```ts
interface MarketProvider {
  id: string;
  quote(tickers: string[]): Promise<Record<string, QuoteCents>>;
  supports(type: InvestmentType): boolean;
}
```

### Arquitetura da chamada

- Chamadas que usam chave passam pelo **Rust** (chave no keychain).
- Cotações são **cacheadas** localmente com timestamp; refresh controlado (§12).
- Sem internet → mostra a última cotação conhecida com "atualizado há X".

---

## 6. Cálculos de carteira

Tudo determinístico (Pilar 1). Funções puras em `src/core/domain/investments`.

### 6.1 Valor e rentabilidade por ativo

```
valorAtual   = quantity × currentPrice
custo        = quantity × purchasePrice
lucro        = valorAtual − custo
rentabilidade = lucro / custo            (em %)
```

### 6.2 Patrimônio total

```
patrimonio = Σ valorAtual de todos os investimentos
custoTotal = Σ custo
lucroTotal = patrimonio − custoTotal
```

### 6.3 Alocação

```
alocacaoPorTipo[t]   = Σ valorAtual(tipo=t) / patrimonio
alocacaoPorTicker[k] = valorAtual(k) / patrimonio
```

### 6.4 Concentração / diversificação (sinal, não conselho)

```
concentracaoMax = max(alocacaoPorTicker)   // o maior peso individual
sinalConcentracao = concentracaoMax > limiteAlerta  // ex.: 1 ativo > 40%
```

Esse "sinal" alimenta uma **observação educativa** ("um ativo concentra 45% da carteira; diversificar reduz risco"), nunca uma ordem.

### 6.5 Aporte sugerido (a partir da sobra)

```
aporteSugerido(mes) = f(sobra(mes), reservaOk, perfilRisco, preferências)
```

Onde `f` é uma regra simples e transparente (ex.: "se reserva ok e sobra > 0, sugerir X% da sobra para investir"), não um otimizador opaco. Detalhe na §9.

---

## 7. Integração com a Pluggy

A Pluggy cobre **Investments** e **Investment Transactions** (doc 03 §7), então parte da carteira pode vir automática:

- **Posição:** a Pluggy traz ativos, quantidades e valores atuais → popula/atualiza `investments`.
- **Aportes/resgates:** histórico → `investment_transactions` (v2).
- **Reconciliação:** investimentos da Pluggy reconciliam com cadastros manuais (não duplicar), com confirmação do usuário.

> Com Pluggy conectada, a carteira pode ser quase 100% automática — coerente com a promessa de "app que já sabe" (doc 03 §1).

Quando não há Pluggy, o usuário cadastra manualmente e o Quibo busca cotações via provedor de mercado (§5).

---

## 8. Reserva de emergência: o gate antes de investir

Decisão de produto importante: **investir não é o primeiro movimento quando sobra** — **ter reserva é**.

### A regra

```
reserva = saldo líquido facilmente acessível (contas CASH/CHECKING/SAVINGS)
mesesCobertos = reserva / despesaMensalMédia
reservaOk = mesesCobertos >= metaReserva   // ex.: 3 a 6 meses (configurável)
```

### Como isso dirige os movimentos (doc 06)

| Situação | Movimento priorizado |
|---|---|
| sobra boa **e** sem reserva | "Antes de investir, vale formar uma reserva. Guardar R$ X cobriria N meses." |
| sobra boa **e** reserva ok | "Reserva tá de boa. Dá pra investir/curtir parte da sobra." |

Essa ordem (reserva → investir → curtir) é responsável e educativa, e diferencia o Quibo de apps que empurram investimento cedo demais.

---

## 9. Análises e "opções bacanas"

O que o usuário pediu: "quando sobrar, opções de investir bacanas" e "análises para trazer opções bacanas". Aqui está o que isso significa **sem cruzar a linha do aconselhamento**.

### O que são "opções bacanas"

São **recortes determinísticos + redação de IA** que ajudam o usuário a decidir **sozinho**:

1. **Aporte sugerido:** "Sobrou R$ 1.847. Com sua reserva ok, dá pra investir R$ 900 e ainda guardar uma folga." (regra transparente, não promessa de retorno.)
2. **Observação de alocação:** "Sua carteira tá 80% em renda variável. Diversificar com renda fixa reduziria o srandom." (educativo.)
3. **Concentração:** "Um ativo concentra 45%. Vale olhar." (sinal.)
4. **Rendimento ocioso:** "Você tem R$ 5.000 parados na conta corrente sem render. Em renda fixa básica renderiam algo." (genérico, sem indicar produto específico.)
5. **Metas vinculadas:** "Esse aporte te deixa a X meses da meta da viagem." (conecta com metas, doc 06.)
6. **Proventos:** "Seus FIIs pingaram R$ 120 esse mês." (informativo.)

### O que NÃO são

- "Compre PETR4." / "Venda BTC." / "Esse fundo vai subir."
- Promessa ou projeção de rentabilidade futura como certeza.
- Indicação de produto específico de uma instituição.

### Divisão de trabalho (P8)

| Camada | Faz |
|---|---|
| Determinístico | calcula sobra, reserva, alocação, concentração, aporte sugerido, rendimento ocioso |
| IA (doc 04) | **redige** essas observações em linguagem humana e educativa, fala em **opções** |

### Perfil de risco (leve)

Um campo simples de **perfil** (conservador / moderado / arrojado), informado pelo usuário, modula as observações (ex.: conservador → enfatiza renda fixa e reserva; arrojado → tolera mais concentração). É um filtro educativo, não um algoritmo de suitability regulado.

---

## 10. Conexão com o motor de insights

Investimentos são um dos **destinos da sobra** no motor de insights (doc 06). No estado `SOBRA_BOA`, os movimentos relacionados a investimento entram no catálogo:

| Movimento | Condição |
|---|---|
| **Formar reserva** | sobra > 0 e `!reservaOk` |
| **Investir parte da sobra** | sobra > 0 e `reservaOk` |
| **Diversificar** | concentração alta |
| **Aproveitar dinheiro ocioso** | muito saldo parado sem render |
| **Permitir um gosto** | sobra confortável (equilíbrio com o lado prazer) |

O motor (doc 06 §10) prioriza e mostra no máximo 1–3. A IA redige (doc 04 §6.2). Os números vêm daqui (determinístico).

---

## 11. Como aparece nas telas

(Detalhe visual no doc 07.)

### Na home "Mês"

- Investimentos **não poluem** a home (P1). Quando há sobra, aparece um movimento ("dá pra investir R$ X") como card discreto, não um painel.

### Na seção Investimentos (em "Mais")

- **Patrimônio total** em destaque + lucro/rentabilidade.
- **Alocação** (por tipo/ticker) — um gráfico simples, calmo.
- **Lista de ativos** com valor atual, rentabilidade, "atualizado há X".
- **Observações educativas** (concentração, dinheiro ocioso) em linguagem de gente.
- Cadastro de ativo (manual) e status da importação Pluggy.

### No "Fechar o mês"

- Se houve sobra e reserva ok, o ritual oferece o aporte sugerido como um passo opcional.

---

## 12. Atualização de cotações

- **Cache local** com timestamp por ticker.
- **Refresh sob demanda** (abrir a seção Investimentos) e/ou **1×/dia** agendado.
- **Coalescência:** atualizar todos os tickers numa chamada quando o provedor suporta batch.
- **Rate limit:** respeitar limites do provedor (especialmente free); backoff e "atualizado há X" quando não dá para atualizar.
- **Mercado fechado:** usar último fechamento; não tentar intraday fora de pregão.
- **Offline:** última cotação conhecida, claramente datada.

---

## 13. Guardrails e perfil de risco

Reforço dos limites (cruzando doc 04 §13):

- **Nunca** apresentar o Quibo como consultor de investimentos. Disclaimer leve e honesto na seção: "O Quibo organiza e mostra opções. As decisões e os riscos são seus."
- **Nunca** projetar retorno futuro como certeza. Rentabilidade passada é histórico, não promessa.
- **Nunca** indicar produto específico de instituição.
- **IA fala em opções**, não em ordens. Validação de saída (doc 04 §13) garante que números citados batem com os calculados.
- **Perfil de risco** é um filtro educativo informado pelo usuário, não suitability regulada.
- **Cripto** ganha um aviso extra de volatilidade quando relevante, sem moralismo.

---

## 14. Privacidade

- **Cotações são dado público:** o que sai para o provedor é o **ticker**, não a posição do usuário. Baixa sensibilidade.
- **A carteira mora local** (SQLite). Valor investido, quantidades e corretora **não saem** para provedores de cotação.
- **Via Pluggy:** a posição vem do banco do usuário, com as chaves dele, para a máquina dele (doc 03 §12).
- **Via IA:** se a carteira entrar numa análise de IA, vai **agregada** (alocação %, concentração), não a lista de ativos com valores, salvo opção explícita e/ou modelo local (doc 04 §5, §10).

---

## 15. Decisões

| # | Decisão | Racional |
|---|---|---|
| INV-1 | Acompanhar, não aconselhar | Legal/ético; confiança; coerência com P8 |
| INV-2 | Valor/rentabilidade/alocação derivados, não armazenados | Sempre refletir última cotação + aportes |
| INV-3 | Cotação via provedor abstrato (BYOK quando precisa) | Trocar provedor é configuração; carteira fica local |
| INV-4 | Só o ticker sai para cotação, não a posição | Privacidade da carteira |
| INV-5 | Reserva antes de investir (gate) | Responsável; diferencia de apps que empurram investimento |
| INV-6 | "Opções bacanas" = recorte determinístico + redação de IA | Educativo e seguro; nunca sinal de compra/venda |
| INV-7 | Perfil de risco leve, informado pelo usuário | Modula observações sem virar suitability regulada |
| INV-8 | Pluggy pode preencher a carteira automaticamente | "App que já sabe"; reduz digitação |
| INV-9 | Fora do v1 | Núcleo de fluxo mensal primeiro; modelo pronto para v2 |
| INV-10 | Disclaimers honestos e leves | Transparência sem poluir |

---

*Fim do documento 05. Próximo: [06 — Motor de Insights com IA](./06-motor-de-insights.md). Anterior: [04 — Integração IA (BYOK)](./04-integracao-ia-byok.md).*
