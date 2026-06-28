# Quibo — Motor de Insights com IA

> Como o Quibo decide a coisa certa para dizer a cada mês. Define a máquina de estados do "clima financeiro", o catálogo de movimentos por estado, a divisão entre cálculo determinístico e redação por IA, e os prompts certeiros. Pré-requisitos: [00](./00-visao-geral-produto.md), [02](./02-estrutura-de-dados.md), [04](./04-integracao-ia-byok.md), [05](./05-investimentos.md).

---

## Sumário

1. [Conceito: o clima do mês manda](#1-conceito-o-clima-do-mês-manda)
2. [Filosofia: a coisa certa na hora certa](#2-filosofia-a-coisa-certa-na-hora-certa)
3. [Os estados do mês](#3-os-estados-do-mês)
4. [Inputs do motor](#4-inputs-do-motor)
5. [Arquitetura do motor](#5-arquitetura-do-motor)
6. [O catálogo de movimentos](#6-o-catálogo-de-movimentos)
7. [Movimentos por estado](#7-movimentos-por-estado)
8. [Gatilhos e regras de disparo](#8-gatilhos-e-regras-de-disparo)
9. [Tendências e comparação histórica](#9-tendências-e-comparação-histórica)
10. [Priorização: no máximo 1–3](#10-priorização-no-máximo-13)
11. [A camada de IA: redação](#11-a-camada-de-ia-redação)
12. [Prompts por estado](#12-prompts-por-estado)
13. [O ritual de fechar o mês](#13-o-ritual-de-fechar-o-mês)
14. [Personalização e aprendizado leve](#14-personalização-e-aprendizado-leve)
15. [Anti-padrões](#15-anti-padrões)
16. [Decisões](#16-decisões)

---

## 1. Conceito: o clima do mês manda

O motor de insights é o cérebro que transforma os números do mês em **uma ou duas coisas úteis para fazer agora**. A ideia central, em vez de espalhar gráfico e dica aleatória:

> Todo mês tem um **estado financeiro calculado** (o "clima"), e cada estado destrava **1 a 3 movimentos relevantes**.

Isso mantém a promessa de simplicidade (P1): o app diz **a coisa certa**, não um painel de analytics. O usuário pediu exatamente isso — "opções dependendo de como está o clima".

### O fluxo em uma imagem

```
   números do mês          ┌──────────────────────┐
   + histórico        ───► │  CALCULAR O ESTADO   │  (clima: sobra boa / apertado / vermelho)
   + recorrência           └──────────┬───────────┘
   + metas/reserva                    │
                          ┌───────────▼───────────┐
                          │  SELECIONAR MOVIMENTOS │  (catálogo filtrado pelo estado + regras)
                          └───────────┬───────────┘
                                      │  (no máx. 1–3, priorizados)
                          ┌───────────▼───────────┐
                          │  REDIGIR (IA opcional) │  (linguagem humana; doc 04)
                          └───────────┬───────────┘
                                      ▼
                              home "Mês" / fechar o mês
```

### Divisão de trabalho (P8)

| Etapa | Quem faz |
|---|---|
| Calcular estado, tendências, valores dos movimentos | **determinístico** (local) |
| Selecionar e priorizar movimentos | **determinístico** (regras) |
| Redigir em linguagem humana | **IA** (opcional; fallback template) |

---

## 2. Filosofia: a coisa certa na hora certa

### Por que não um painel

Apps financeiros costumam jogar dez gráficos na cara do usuário e deixá-lo decidir o que fazer. Isso é carga cognitiva, não ajuda. O Quibo faz o trabalho de **curadoria**: olha tudo, e mostra só o que importa **agora**, dado o clima.

### Princípios do motor

- **Curadoria, não exposição:** o motor decide o que vale dizer; o resto fica disponível, mas não na cara.
- **Acionável, não descritivo:** cada movimento é uma **ação possível** ("cortar X", "guardar Y"), não um fato solto ("você gastou Z").
- **Calmo, não alarmista (P6):** mesmo no vermelho, o tom é "bora ajustar?", não "VOCÊ ESTÁ FALIDO".
- **Equilíbrio prazer × disciplina:** quando sobra, o motor também **abençoa o gosto** ("permitir um gosto") — não é só poupar e cortar.
- **Honesto:** nunca inventa urgência nem promete retorno. Os números são determinísticos.

---

## 3. Os estados do mês

O "clima" é calculado a partir da sobra relativa à receita, com limites configuráveis.

```
ratio = sobra / max(receita, 1)

estado:
  sobra < 0                      → VERMELHO
  0 <= ratio < limiteApertado    → APERTADO     (ex.: ratio < 0,10)
  ratio >= limiteApertado        → SOBRA_BOA
  (mês ainda em formação)        → NEUTRO
```

| Estado | Significado | Tom (P6) | Frase-template (fallback) |
|---|---|---|---|
| **SOBRA_BOA** | folga saudável | celebra com leveza | "Tá tranquilo. Dá pra respirar." |
| **APERTADO** | sobra pequena | atento e prático | "Tá no limite. Cuidado com o que falta." |
| **VERMELHO** | sobra negativa | reconfortante e acionável | "Esse mês fechou no vermelho. Bora ajustar?" |
| **NEUTRO** | início do mês / pouco dado | quieto | (sem alarme; só os números) |

### Notas sobre os limites

- `limiteApertado` é **configurável** (default ~10%). Usuário com renda alta pode querer 5%; outro, 20%.
- O estado considera a convenção trabalho×pagamento (doc 02 §3): a receita do mês usa os salários do mês de trabalho correto.
- O estado é recalculado sempre que o dado do mês muda (confirmar item, importar Pluggy).

---

## 4. Inputs do motor

O motor combina sinais determinísticos. Nenhum vem do LLM.

| Input | Origem | Uso |
|---|---|---|
| receita / despesa / sobra | cálculo do mês (doc 02 §11) | define o estado |
| média histórica por categoria | histórico de entries | tendências (§9) |
| pagamentos recorrentes | Pluggy Recurring (doc 03 §8) ou detecção local | movimento "revisar assinaturas" |
| maiores categorias do mês | agregação de entries | movimento "onde cortar / o que pesou" |
| metas | `goals` (doc 02 §5.4) | movimento "mandar pra meta" |
| reserva de emergência | saldo líquido / despesa média (doc 05 §8) | gate "formar reserva" antes de investir |
| carteira / alocação | investimentos (doc 05) | movimentos de investir/diversificar |
| dívidas ativas / parcelas | `debts` (doc 02 §4.3) | alerta de fatura/parcela no vermelho |
| dinheiro ocioso | saldo parado sem render | movimento "aproveitar ocioso" |
| preferências do usuário | configurações (§14) | modula seleção (perfil, gostos) |

---

## 5. Arquitetura do motor

Código em `src/core/insights`.

```
insights/
  state.ts        # calcula o estado do mês (clima)
  facts.ts        # monta os sinais determinísticos (entrada do catálogo)
  catalog.ts      # define todos os movimentos possíveis (regra + payload)
  select.ts       # filtra por estado + dispara regras + pontua
  prioritize.ts   # ordena e corta para no máx. N
  render.ts       # gera texto: template (sempre) + IA (opcional, doc 04)
  types.ts
```

### Pipeline

```
1. state = computeState(month)                 // VERMELHO/APERTADO/SOBRA_BOA/NEUTRO
2. signals = buildSignals(month)               // todos os sinais determinísticos
3. candidates = catalog.filter(state, signals) // movimentos cujas regras dispararam
4. ranked = prioritize(candidates)             // ordena por relevância
5. top = ranked.slice(0, N)                     // 1 a 3
6. text = render(top, { ai: settings.aiEnabled })  // template + (IA)
```

### Contrato de um movimento (saída)

```ts
interface Movement {
  id: string;                 // "save_to_goal", "review_subscriptions", ...
  state: MonthState;          // estado em que se aplica
  priority: number;           // base de prioridade
  amountCents?: number;       // valor calculado (ex.: aporte sugerido)
  data: Record<string, any>;  // dados para a redação (ex.: lista de assinaturas)
  templateText: string;       // fallback sem IA
}
```

---

## 6. O catálogo de movimentos

Cada movimento é uma entrada no catálogo com: estado-alvo, regra de disparo, cálculo do valor, prioridade base e texto-template.

### Estrutura de uma entrada (exemplo)

```ts
{
  id: "review_subscriptions",
  state: "APERTADO",
  trigger: (s) => s.subscriptions.length > 0,
  compute: (s) => ({
    amountCents: sum(s.subscriptions.map(x => x.valueCents)),
    data: { items: s.subscriptions },
  }),
  priority: 70,
  templateText: (m) =>
    `Você tem ${m.data.items.length} assinaturas somando ${brl(m.amountCents)}. Dá pra cortar alguma?`,
}
```

O catálogo é **dado**, não código espalhado — fácil de auditar, testar e estender.

---

## 7. Movimentos por estado

### SOBRA_BOA — "tem folga, o que fazer com ela"

| Movimento | Dispara quando | Mensagem (essência) |
|---|---|---|
| **Formar reserva** | `!reservaOk` | "Antes de investir, formar reserva. Guardar R$ X cobre N meses." |
| **Mandar pra meta** | há meta ativa | "Dá pra mandar R$ X pra meta da viagem." |
| **Investir parte da sobra** | `reservaOk` | "Reserva ok. Dá pra investir R$ X." |
| **Aproveitar dinheiro ocioso** | muito saldo parado sem render | "Você tem R$ Y parados sem render." |
| **Permitir um gosto** | sobra confortável | "Sobrou bem. Pode se permitir um gosto também." |
| **Adiantar dívida** | há dívida com juros | "Dá pra adiantar parte da dívida e economizar juros." |

### APERTADO — "tá no limite, onde mexer"

| Movimento | Dispara quando | Mensagem |
|---|---|---|
| **Revisar assinaturas** | há recorrentes | "N assinaturas somam R$ X. Cortar alguma libera folga." |
| **Onde pesou** | categoria acima da média | "Comida subiu 20% esse mês. Vale olhar." |
| **Adiar gasto não-essencial** | há previsto adiável | "Adiar X traria mais folga." |
| **Confirmar pendências** | há muito previsto | "Faltam confirmar N itens; conferir te dá clareza." |

### VERMELHO — "fechou negativo, o que resolve"

| Movimento | Dispara quando | Mensagem |
|---|---|---|
| **Cortar com impacto** | há gastos cortáveis | "Cortar X e Y traz o mês pro azul." |
| **Renegociar/adiar compromisso** | há compromisso flexível | "Adiar Z (com juros) alivia esse mês." |
| **Alerta de fatura/parcela** | fatura/parcela alta vencendo | "A fatura do cartão pesa esse mês; atenção ao vencimento." |
| **Usar reserva (consciente)** | há reserva | "Dá pra cobrir com a reserva — e repor depois." |

### NEUTRO — "mês em formação"

Nenhum movimento forçado. Só os números e, no máximo, um lembrete leve ("ainda no começo do mês"). Silêncio é uma resposta válida (anti-padrão de empurrar dica sempre — §15).

---

## 8. Gatilhos e regras de disparo

### Como um movimento entra na lista

1. **Filtro de estado:** o movimento só é candidato se seu `state` casa com o clima do mês.
2. **Trigger:** a função `trigger(signals)` retorna true (ex.: existe assinatura, existe meta, reserva insuficiente).
3. **Compute:** calcula o valor/dado do movimento (ex.: soma das assinaturas, aporte sugerido).
4. **Pontuação:** prioridade base + ajustes (urgência, valor envolvido, preferências).

### Precedência entre movimentos

Quando vários disparam, a precedência segue a lógica financeira responsável:

```
VERMELHO:  cortar/alertar  >  renegociar  >  usar reserva
APERTADO:  revisar assinaturas  >  onde pesou  >  adiar
SOBRA_BOA: formar reserva  >  adiantar dívida cara  >  meta  >  investir  >  ocioso  >  permitir um gosto
```

Note a ordem em SOBRA_BOA: **reserva e dívida cara primeiro**, prazer por último — responsável, mas sem ser puritano (o "gosto" está lá).

---

## 9. Tendências e comparação histórica

Insights ficam mais ricos comparando o mês com o passado — tudo determinístico.

### Cálculos

```
médiaCategoria(c) = média dos últimos K meses de gasto em c
variação(c) = (gastoMês(c) − médiaCategoria(c)) / médiaCategoria(c)
```

- Variações relevantes (acima de um limite) viram o movimento "onde pesou" ou um aparte na narrativa ("comida subiu 20%").
- Tendência de **sobra** ao longo dos meses pode gerar observações ("sua sobra vem caindo há 3 meses").
- **Sazonalidade** (dezembro gasta mais) pode ser reconhecida com mais histórico (v2).

### Cuidado estatístico

- Com poucos meses de dado, evitar conclusões fortes (intervalo de confiança pobre). O motor **suaviza** e só fala de tendência com histórico suficiente.
- Nunca extrapolar como previsão certa (P8, doc 04 §13).

---

## 10. Priorização: no máximo 1–3

A regra de ouro do anti-dashboard (P1): **mostrar pouco**.

- A home exibe **1 movimento** em destaque (o de maior prioridade) + no máximo mais 1–2 secundários, discretos.
- O "fechar o mês" (§13) pode mostrar mais, porque é um momento de revisão deliberada.
- Se nada relevante dispara, **não mostra nada** — o silêncio é melhor que ruído.

### Função de priorização

```
score(m) = m.priority
         + pesoUrgencia(m)        // vencendo? vermelho?
         + pesoValor(m)           // quanto dinheiro envolve
         + pesoPreferencia(m)     // gostos do usuário (§14)
ordenar desc, cortar em N
```

---

## 11. A camada de IA: redação

(Mecânica completa no doc 04.)

O motor produz **movimentos com dados e um texto-template**. A IA, se ligada, **reescreve** o(s) movimento(s) numa narrativa única, calorosa e fluida — recebendo só os **fatos** já calculados (doc 04 §5).

### Divisão precisa

| O motor entrega | A IA faz |
|---|---|
| estado + valores + lista de movimentos priorizados | uma frase/parágrafo humano que costura tudo |
| `templateText` de cada movimento (fallback) | versão mais natural e contextual |

### Exemplo

**Motor (determinístico):**
```
estado: SOBRA_BOA, sobra: 184700
movimentos: [ {save_to_goal, 80000, meta:"viagem"}, {permitir_um_gosto} ]
```

**Template (sem IA):**
> "Sobrou R$ 1.847. Dá pra mandar R$ 800 pra meta da viagem. Sobrou bem — pode se permitir um gosto também."

**IA (ligada):**
> "Junho fechou redondo: R$ 1.847 de folga. Que tal mandar uns R$ 800 pra viagem e ainda guardar um trocado pra você curtir? Mereceu."

Os **números** são idênticos (vêm do motor). A IA só deixa **vivo**.

---

## 12. Prompts por estado

O system prompt base está no doc 04 §8. Aqui, instruções específicas do motor por estado — o "prompt bacana e acertivo" que você pediu.

### Instrução comum (anexada aos fatos)

```
Você recebe o estado do mês e uma lista priorizada de "movimentos" já calculados.
Escreva 1 a 3 frases que costurem os movimentos numa fala humana e calorosa.
Use APENAS os valores fornecidos. Não calcule nada. Não invente movimentos.
Tom conforme o estado (abaixo). Português brasileiro, curto, sem jargão.
```

### Por estado

**SOBRA_BOA**
```
Tom: leve e celebrativo, sem exagero. Reconheça a folga.
Equilibre disciplina e prazer: pode incentivar guardar/investir E se permitir um gosto.
Nunca pressione. Ex.: "Sobrou bem esse mês — dá pra [movimento] e ainda curtir um pouco."
```

**APERTADO**
```
Tom: atento e prático, sem alarme. Aponte o movimento mais útil com clareza.
Foque em UMA ação concreta. Ex.: "Tá no limite. Olhar as assinaturas (R$ X) é o caminho mais rápido."
```

**VERMELHO**
```
Tom: reconfortante e acionável. NUNCA culpe ou dramatize.
Foque no que resolve, com esperança. Ex.: "Fechou no vermelho, mas tem saída: [movimento] já traria pro azul."
```

**NEUTRO**
```
Não force insight. Uma linha leve ou nada. Ex.: "Mês ainda no começo — sem novidade por enquanto."
```

### Princípios de prompt

- **Fatos como JSON**, não prosa (doc 04 §7).
- **Proibição explícita de calcular/inventar.**
- **Tom amarrado ao estado** (P6).
- **Curto** (P1): 1–3 frases.
- **Validação de saída** (doc 04 §13): números citados devem bater com os enviados.

---

## 13. O ritual de fechar o mês

O momento em que o motor mais brilha — e que diferencia o Quibo de uma planilha (que nunca "fecha").

### O fluxo

```
1. Resumo do mês: estado + sobra + a narrativa (motor + IA).
2. Pendências: o que ficou "previsto" e não foi confirmado → confirmar/ajustar.
3. Movimentos do estado: as 1–3 ações sugeridas, agora com mais espaço para agir
   (mandar pra meta, registrar aporte, cortar assinatura).
4. Comparação leve com o mês anterior (sobra subiu/caiu, onde pesou).
5. Transição: leva pendências relevantes e compromissos para o próximo mês.
```

### Por que isso vira hábito

- É um **ritual curto e recompensador**, não uma auditoria.
- Dá **fechamento psicológico** ("acabei o mês"), algo que planilha não dá.
- Conecta o passado (o que foi) com o futuro (o que vem) num gesto só.

---

## 14. Personalização e aprendizado leve

O motor melhora conhecendo o usuário — sem virar vigilância.

### Sinais de preferência (locais)

- **Perfil de risco** (doc 05 §9): modula movimentos de investimento.
- **Gostos** (o usuário pediu "gostos"): categorias que ele marca como "prazer ok" (ex.: gastar com viagem/hobby é abençoado, não repreendido).
- **Movimentos ignorados:** se o usuário sempre dispensa "investir", o motor reduz a prioridade dele.
- **Mapeamentos confirmados** (reconciliação, doc 02 §12): melhoram a precisão.
- **Metas ativas:** direcionam para onde a sobra "quer" ir.

### Aprendizado leve, não modelo

Tudo isso é **regra simples e local** (ajuste de prioridade, flags), não um modelo de ML opaco. Transparente, auditável, sob controle do usuário, e nunca enviado para fora.

### O movimento "permitir um gosto" como assinatura emocional

Vale destacar: a maioria dos apps financeiros só sabe cortar e poupar — gera culpa. O Quibo **abençoa o prazer quando dá** ("sobrou bem, pode curtir"). Isso é um diferencial emocional real e deve ser tratado com carinho na redação e na priorização.

---

## 15. Anti-padrões

O que o motor **nunca** faz.

| Anti-padrão | Por que evitar |
|---|---|
| **Empurrar dica todo mês** | ruído; o silêncio é resposta válida (estado NEUTRO) |
| **Alarme e culpa** | viola P6; afasta o usuário |
| **Mais de 3 movimentos na home** | viola P1; vira painel |
| **Inventar urgência** | desonesto; quebra confiança |
| **Prometer retorno/futuro como certeza** | viola P8 e guardrails (doc 04/05) |
| **Calcular com IA** | viola P8; risco de alucinação numérica |
| **Moralizar o gasto de prazer** | mata o diferencial "permitir um gosto" |
| **Psicologizar o usuário** | inferir estado mental a partir de gasto é indevido |
| **Insight genérico de blog** | "gaste menos que ganha" é inútil; insight tem que ser do mês dele |

---

## 16. Decisões

| # | Decisão | Racional |
|---|---|---|
| INS-1 | Estado do mês ("clima") dirige tudo | Curadoria > exposição; a coisa certa na hora certa |
| INS-2 | Catálogo de movimentos como dado | Auditável, testável, extensível |
| INS-3 | No máximo 1–3 movimentos na home | Anti-dashboard (P1) |
| INS-4 | Determinístico seleciona e calcula; IA só redige | P8; confiança e custo |
| INS-5 | Reserva/dívida cara antes de meta/investir; prazer por último mas presente | Responsável sem ser puritano |
| INS-6 | "Permitir um gosto" como movimento de primeira classe | Diferencial emocional; equilíbrio prazer×disciplina |
| INS-7 | Silêncio é resposta válida (NEUTRO) | Evitar ruído; honestidade |
| INS-8 | Tendência só com histórico suficiente | Rigor estatístico; não extrapolar |
| INS-9 | Personalização por regra local, não ML opaco | Transparência e privacidade |
| INS-10 | Prompts amarrados ao estado + proibição de calcular | "Prompt acertivo"; segurança contra alucinação |
| INS-11 | O motor brilha no "fechar o mês" | Ritual que vira hábito; diferencia de planilha |

---

*Fim do documento 06. Próximos (em entrega): 07 — Design System & UX, 08 — Ideias & Roadmap. Anterior: [05 — Investimentos](./05-investimentos.md).*
