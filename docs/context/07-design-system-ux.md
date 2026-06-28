# Quibo — Design System & UX

> A linguagem visual e de interação do Quibo, consolidada. Tokens, voz, o shell desktop (sidebar-trilho + header solto), a home "Mês", o gesto de confirmar, os componentes e as telas por categoria. É a fonte da verdade do que se constrói no Claude Design e se implementa em Next.js/Tailwind. Pré-requisitos: [00](./00-visao-geral-produto.md), [02](./02-estrutura-de-dados.md), [06](./06-motor-de-insights.md).

---

## Sumário

1. [Princípios de design](#1-princípios-de-design)
2. [Direção estética](#2-direção-estética)
3. [Design tokens](#3-design-tokens)
4. [Voz e copy](#4-voz-e-copy)
5. [O shell: sidebar e header](#5-o-shell-sidebar-e-header)
6. [Navegação e arquitetura de telas](#6-navegação-e-arquitetura-de-telas)
7. [A home "Mês"](#7-a-home-mês)
8. [O gesto central: confirmar](#8-o-gesto-central-confirmar)
9. [Catálogo de componentes](#9-catálogo-de-componentes)
10. [As telas por categoria](#10-as-telas-por-categoria)
11. [Adicionar: captura sem atrito](#11-adicionar-captura-sem-atrito)
12. [Estados vazios, carregamento e erro](#12-estados-vazios-carregamento-e-erro)
13. [Acessibilidade](#13-acessibilidade)
14. [Responsividade](#14-responsividade)
15. [Implementação em Tailwind](#15-implementação-em-tailwind)
16. [Decisões](#16-decisões)

---

## 1. Princípios de design

Derivados dos princípios de produto (00 §3), traduzidos para a interface.

- **Um número manda (P1):** a home tem um herói — "Sobra esse mês". O resto é secundário.
- **Anti-dashboard (P2):** recebe com calma e espaço, não com gráfico. Conteúdo flutua, respira.
- **Um gesto central (P3):** confirmar um item com um toque é a interação mais satisfatória.
- **Linguagem de gente (P4):** copy calorosa, curta, brasileira; zero jargão.
- **Separado pra criar, unificado pra usar (P5):** cada domínio tem seu formulário; o consumo é numa tela só.
- **Calma, não alarme (P6):** vermelho de estado, sem pânico; reconfortante mesmo na má notícia.
- **Esconder a complexidade (P9):** o dia a dia é simples; o avançado mora atrás de "Mais".

### Restrições firmes (decididas pelo autor)

- **Apenas desktop.** Sem versão mobile no v1.
- **Apenas tema claro.** Sem dark mode no v1.
- **Sidebar e header visíveis, mas diferentes** do admin template padrão.
- **Next.js + Tailwind** como alvo de implementação.

---

## 2. Direção estética

**Limpo, frio e nítido.** A paleta do usuário (preto + azul) levou o produto de "papel quente" para uma linguagem **crisp e moderna**: base quase-branca fria, tinta preta suavizada, azul como única cor de marca. A calma não vem mais do calor, e sim do **espaço** e da **linguagem**.

### A sensação-alvo

> "Tão simples que assusta." A interface deve parecer que faz pouco — mas faz exatamente o que importa. Ar generoso, tipografia confiante, uma cor de marca usada com disciplina.

### O que evitar

- Branco clínico chapado (frio demais) → usar o canvas levemente cinza.
- Gráfico e card empilhado na home → anti-dashboard.
- Cor como enfeite → cor é significado.
- Sombra pesada / skeuomorfismo → separação por cor e hairline.
- CAIXA ALTA e Title Case → sempre sentence case.

---

## 3. Design tokens

### 3.1 Cor

Base azul + preto, expandida num sistema fechado. Origem do usuário: preto, `#87BBF8`, `#4078E6`.

**Azul — cor de marca (única): ações, FAB, nav ativo, links.**

| Token | Hex |
|---|---|
| `blue-50` | `#EEF4FE` |
| `blue-100` | `#DCE8FD` |
| `blue-200` | `#BBD3FB` |
| `blue-300` | `#87BBF8` (origem) |
| `blue-400` | `#6098F0` |
| `blue-500` | `#4078E6` (origem · **primária**) |
| `blue-600` | `#2F63D4` (hover) |
| `blue-700` | `#244FB0` (pressed/texto sobre claro) |
| `blue-800` | `#1B3C84` |

**Neutros — base nítida.**

| Token | Hex | Uso |
|---|---|---|
| `surface` | `#FFFFFF` | cards, sheets |
| `canvas` | `#F7F8FA` | fundo do app |
| `fill-100` | `#EFF1F5` | preenchimento sutil |
| `line` | `#E3E6EC` | hairlines, divisores |
| `line-strong` | `#D4D8E0` | bordas de controle |
| `ink-faint` | `#8A909C` | legendas, hints |
| `ink-soft` | `#5B616E` | texto secundário |
| `ink` | `#0E1116` | texto principal (preto suavizado) |
| `true-black` | `#000000` | logo / título de impacto |

**Estado — significado, não decoração.**

| Token | Hex | Soft |
|---|---|---|
| `positive` (sobra, entrada) | `#12A06B` | `#E2F4EC` |
| `negative` (falta) | `#D74A45` | `#FBE9E7` |
| `attention` (vencendo) | `#E5982B` | `#FCF1DF` |

Regra: **azul = marca; verde/vermelho = estado.** Texto é `#0E1116`, nunca `#000000` puro no corpo.

### 3.2 Tipografia

- Família única: **Hanken Grotesk** (Google Fonts). Caráter sem ser quirky; ótima em número.
- Números **sempre tabulares**: `font-variant-numeric: tabular-nums lining-nums`.
- Escala: herói `54px/700` · título `21px/600` · valor em linha `15–17px/600` · corpo `14–15px/500` · legenda `12px/400`.
- Tracking levemente negativo em números grandes (`-.02em`).
- **Sentence case sempre.**

### 3.3 Espaçamento, raio, sombra

- Escala de espaço: `4 · 8 · 12 · 16 · 20 · 24 · 32`.
- Raio: controles `14px` · cards `16px` · sheets/modais `24px` · pills `99px` · avatar `50%`.
- Sombra: quase nenhuma. Só o botão primário/FAB tem sombra de marca: `0 6px 18px rgba(64,120,230,.30)`. Separação por cor/hairline, não elevação.

### 3.4 Movimento

- Confirmar: `scale(.96)` no toque (120ms) + "tique" (círculo se enche, item desliza pra fora).
- Troca de mês: deslize horizontal suave.
- Spring discreto. Nada de bounce exagerado.
- Respeitar `prefers-reduced-motion`.

### 3.5 Ícones

- Conjunto único **outline** (Tabler ou Lucide), espessura consistente.
- Ícone herda cor do contexto (`currentColor`); em tile arredondado `fill-100`/`blue-50`.
- Tamanho: 18–20px inline · 24px decorativo.

---

## 4. Voz e copy

| Situação | Texto |
|---|---|
| Saldo positivo | "Tá tranquilo. Dá pra respirar." |
| Saldo apertado | "Tá no limite. Cuidado com o que falta." |
| Saldo negativo | "Esse mês fechou no vermelho. Bora ajustar?" |
| Item recorrente | "Vira todo mês?" |
| Salário a confirmar | "Recebeu?" |
| Lista vazia (pendências) | "Tudo confirmado por aqui." |
| Sobra confortável | "Sobrou bem — pode se permitir um gosto também." |
| Botões | "Confirmar" · "Adicionar" · "Salvar" (verbo primeiro, sem ponto) |

Evitar sempre: "status", "pendente/quitado", "fatura vencida", "conciliação", "gerar transações". Traduzir tudo em ação humana (P4).

---

## 5. O shell: sidebar e header

Desktop, tema claro. **Visíveis, mas fora do clichê** de admin template.

### 5.1 Sidebar (trilho-ilha)

- **Estreita, só de ícones** (sem lista de texto sempre visível).
- **Flutua destacada da borda esquerda**: respiro em volta, cantos arredondados, como uma ilha branca sobre o `canvas` — não colada na parede.
- Itens são ícones em tiles. **Ativo = tile azul `#4078E6`** com ícone branco. Inativos = ícone cinza que escurece no hover.
- **Rótulo aparece no hover** (tooltip ou painel que desliza expandindo a sidebar).
- Itens: Mês · Receitas · Custo de vida · Dívidas · Cartões · Lançamentos · Contas · Categorias · Personas · (Investimentos). Embaixo, separado: avatar/ajustes.

### 5.2 Header (solto)

- **NÃO atravessa a largura toda** nem fica colado no topo com barra cinza. Começa depois da sidebar e fica "solto", **sem borda inferior dura**.
- Centro-esquerda: **seletor de mês** "Junho 2026" com setas ‹ › em destaque tipográfico.
- Direita: avatar + **botão primário azul "Adicionar"** com ícone +.

### 5.3 Estrutura do shell

```
┌──────────────────────────────────────────────────────────┐
│ canvas #F7F8FA                                            │
│  ┌────┐   ┌─────────────────────────────────────────┐    │
│  │ ▢  │   │  Junho 2026  ‹ ›        [avatar][+ Add]  │    │  header solto
│  │ ▢  │   └─────────────────────────────────────────┘    │
│  │[▣] │                                                   │
│  │ ▢  │      ÁREA DE CONTEÚDO (arejada, centralizada)     │
│  │ ▢  │                                                   │
│  │ ▢  │                                                   │
│  │────│                                                   │
│  │ 👤 │                                                   │
│  └────┘   trilho-ilha                                     │
└──────────────────────────────────────────────────────────┘
```

### 5.4 Modais e overlays

Cadastros e modais aparecem como **overlay central** sobre o shell, com fundo levemente escurecido, card `surface` com raio 24px. O shell permanece visível por trás (contexto preservado).

---

## 6. Navegação e arquitetura de telas

A navegação respeita "separado pra criar, unificado pra usar" (P5): a sidebar dá acesso aos domínios (autoria); a home unifica o consumo.

```
Mês (home)            ← consumo unificado; confirmar
Receitas              ← lista + cadastro + modais (autoria)
Custo de vida         ← lista + cadastro + gerar
Dívidas               ← lista + cadastro + parcelas + pagamento
Cartões               ← lista + cadastro + faturas + transações
Lançamentos           ← lista + cadastro + editar recorrente
Contas                ← lista + cadastro
Categorias            ← lista + cadastro
Personas              ← lista + cadastro
Investimentos         ← patrimônio + cadastro (v2)
Ajustes               ← integrações (Pluggy, IA), preferências
Fechar o mês          ← ritual (a partir da home)
```

### O botão "Adicionar"

O "+" do header abre um **menu rápido** com os tipos: Salário/Receita · Custo de vida · Dívida · Cartão · Lançamento avulso. Cada um abre **seu formulário dedicado** (campos próprios). Decisão: menu de tipos (mais rápido) em vez de levar direto a um só fluxo.

---

## 7. A home "Mês"

A cara do produto. Anti-dashboard, um número manda.

### 7.1 Anatomia

```
Header (mês, +Add)
───────────────────────────────────────────
                                            
        Sobra esse mês                       ← label
        R$ 1.847                             ← herói (verde se positivo)
        Tá tranquilo. Dá pra respirar.       ← frase humana (motor de insights)
                                            
   ┌─────────────────────────────────────┐
   │  Entra R$ 6.200      Sai R$ 4.353    │  ← par entra/sai
   │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░                  │  ← barra de proporção (azul/cinza)
   └─────────────────────────────────────┘
                                            
   Falta confirmar  ③                       ← contador em chip azul claro
   ┌─────────────────────────────────────┐
   │ ▢ Aluguel        vence dia 10  R$1.500  ◯ │  ← linha confirmável
   │ ▢ Fatura Nubank  vence dia 15  R$ 842   ◯ │
   │ ▢ Salário        recebeu?      R$6.200  ◯ │
   └─────────────────────────────────────┘
                                            
   [movimento do motor de insights]         ← 1 card discreto, opcional
```

### 7.2 Layout desktop

- Coluna principal arejada. O herói pode ficar à esquerda e o "Falta confirmar" numa coluna à direita em telas largas, ou empilhados centralizados em telas médias.
- Muito espaço em volta; nada disputa com o herói.

### 7.3 Os três estados (P6)

| Estado | Herói | Frase | Acento |
|---|---|---|---|
| **Sobra boa** | "R$ 1.847" em `positive` | "Tá tranquilo. Dá pra respirar." | calmo |
| **Apertado** | valor em `ink` | "Tá no limite. Cuidado com o que falta." | `attention` sutil |
| **Vermelho** | "−R$ 320" em `negative` | "Esse mês fechou no vermelho. Bora ajustar?" | `negative` sem pânico |

A frase humana vem do motor de insights (doc 06) — template sem IA, narrativa com IA. **A home mostra os números na hora (local); a frase de IA entra depois** (doc 04 §12).

---

## 8. O gesto central: confirmar

O movimento mais importante da interface (P3). Ele materializa o `previsto → confirmado` (doc 02).

### Anatomia da linha confirmável (o átomo)

```
[ícone em tile]  Nome              valor   (◯ confirmar)
                 sublegenda
```

- **Tile de ícone**: `fill-100` (ou `blue-50` para receita), ícone outline.
- **Nome** em `ink` 15px/500; **sublegenda** ("vence dia 10", "recebeu?") em `ink-faint` 12px.
- **Valor** em `ink` 15px/600 (verde se receita).
- **Botão circular de confirmar**: contorno `line-strong`, ícone de check `ink-faint`.

### A interação

```
toque → scale(.96) (120ms)
      → o círculo se ENCHE (azul ou verde)
      → o item desliza pra fora da lista de "Falta confirmar"
      → contador decrementa
      → (desfazer disponível por alguns segundos)
```

### Por que importa

É a recompensa do produto. Tem que ser **tátil e satisfatório**. Confirmar tudo deixa a lista vazia → "Tudo confirmado por aqui." — um pequeno fechamento prazeroso.

### Desfazer

Confirmar por engano é fácil de reverter (toast "desfazer" por ~5s, ou tocar de novo). Sem diálogo de confirmação para o gesto principal — atrito mata o prazer.

---

## 9. Catálogo de componentes

| Componente | Descrição |
|---|---|
| **Herói do mês** | label + número grande (cor por estado) + frase humana |
| **Par entra/sai** | dois valores + barra de proporção fina (azul/cinza) |
| **Linha confirmável** | átomo: tile + nome + sublegenda + valor + botão circular |
| **Card de movimento** | sugestão do motor de insights (discreta, 1 ação) |
| **Botão primário** | azul, com sombra de marca; verbo primeiro |
| **Botão secundário** | contorno `line-strong`, texto `ink-soft` |
| **Chip/contador** | pill `blue-50`/`blue-700` (ex.: "Falta confirmar ③") |
| **Seletor de mês** | "Junho 2026" + ‹ › |
| **Tile de ícone** | quadrado arredondado com ícone outline |
| **Sidebar item** | ícone em tile; ativo = azul cheio; rótulo no hover |
| **Modal/overlay** | card `surface` raio 24px sobre fundo escurecido |
| **Bottom sheet de adicionar** | (no desktop, modal central) valor primeiro |
| **Barra de progresso** | dívida/meta: trilho `fill-100`, preenchimento azul/positive |
| **Filtros/chips** | filtro ativo como chip removível |
| **Tabela de domínio** | lista de receitas/custos/dívidas/cartões (linhas calmas, hairline) |
| **Calculadora de valor** | input monetário com calculadora integrada (no cadastro de lançamento) |
| **Toggle pago/pendente** | reuso do botão circular de confirmar em listas de domínio |
| **Estado vazio** | ilustração leve + frase humana + ação |
| **Toast** | confirmação/desfazer, discreto |

---

## 10. As telas por categoria

Resumo das telas (detalhe e prompts de construção estão no arquivo de prompts do Claude Design). Cada categoria gera suas telas em linha (lista → cadastro → modais).

### Acesso (sem shell)

Login · Cadastro · Onboarding (perfil: ocupação, CLT, casado, filhos, salário base). Telas standalone, centralizadas, com painel de marca.

### Dashboard / Mês

A home (§7), nos estados positivo, apertado e negativo.

### Receitas / Salários

- **Lista:** 3 cards (total, pagamento do mês, do próximo) + tabela (nome, tipo, valor, recorrência, vigência, status).
- **Cadastro:** FIXED vs HOURLY (com cálculo horista, dias úteis, feriados), recorrência, offset de pagamento, datas.
- **Modais:** registrar recebimento; visualizar anual (12 meses).

### Custo de Vida

- **Lista:** total mensal, filtros (categoria/persona/agrupamento), tabela.
- **Cadastro:** ACCOUNT vs CREDIT_CARD, dia do mês, vigência.
- **Modal:** gerar/conciliar transações (preview).

### Dívidas

- **Lista:** tabs (Todas/Ativas/Quitadas), progresso, "falta".
- **Cadastro:** 4 tipos (parcelada/empréstimo/pendente/flexível), juros.
- **Modais:** parcelas (toggle pago, juros de atraso); registrar pagamento.

### Cartões

- **Lista:** 3 cards (limite total/em uso/próxima fatura), tabela com limite disponível (barra colorida).
- **Cadastro:** bandeira, limite, fechamento, vencimento, cor.
- **Modais:** faturas (por mês/ano, marcar paga); transações do cartão.

### Lançamentos

- **Lista:** 3 cards (Receita/Despesa/Sobra), filtros, tabela paginada.
- **Cadastro:** tipo (entrada/saída/transferência), forma de pagamento (conta/cartão), recorrência, calculadora de valor.
- **Modal:** editar recorrente (apenas esta / todas / esta e próximas).

### Contas

- **Lista:** grid de cards de conta com saldo; primária com selo.
- **Cadastro:** tipo, banco, saldo inicial, cor, ícone, primária.

### Categorias

- **Lista:** grade por tipo (Receita/Despesa/Transferência), cor + ícone.
- **Cadastro:** nome, tipo, cor, ícone.

### Personas

- **Lista:** grade de personas (cor + ícone + descrição).
- **Cadastro:** nome, descrição, cor, ícone.

### Investimentos (v2)

- **Patrimônio:** total + rentabilidade + alocação (gráfico calmo).
- **Lista de ativos** + observações educativas (concentração, ocioso).
- **Cadastro** de ativo + status da importação Pluggy.

### Ajustes / Integrações

- **Pluggy:** conectar/desconectar, status, mapeamento de contas.
- **IA:** ligar/desligar, provedor, chave (testar), modelo, privacidade.
- **Preferências:** limites do "clima", perfil de risco, metas de reserva.

### Fechar o mês

Ritual (doc 06 §13): resumo + pendências + movimentos + comparação + transição.

---

## 11. Adicionar: captura sem atrito

O fluxo de criar um lançamento avulso (o caso mais frequente) precisa ser quase instantâneo.

### O fluxo

```
1. Valor primeiro (input grande, calculadora integrada)
2. "Entrou ou saiu?" (2 botões)
3. Categoria (opcional, chips)
4. Conta ou cartão
5. "Vira todo mês?" (switch → vira compromisso)
→ Salvar em 1 clique
```

### Princípios

- **Valor primeiro:** o que a pessoa tem na cabeça é o número.
- **Defaults inteligentes:** data = hoje; conta = primária; status = conforme contexto.
- **Mínimo obrigatório:** descrição + valor + tipo. O resto é opcional.
- **Recorrência fácil:** um switch transforma o lançamento em compromisso.

### Futuro (doc 08): captura por linguagem natural

"gastei 80 no mercado ontem" → lançamento estruturado. Reduz o atrito a quase zero. É a evolução natural deste fluxo.

---

## 12. Estados vazios, carregamento e erro

### Vazios (importantes para o primeiro uso)

- Tom acolhedor + uma ação. Ex.: home sem dados → "Vamos começar? Adicione sua primeira receita." com botão.
- Nunca uma tela morta. O vazio é uma oportunidade de guiar (P4).

### Carregamento

- **Número primeiro:** dados locais aparecem instantâneos; só integrações (Pluggy/IA/cotação) têm loading.
- Loading discreto ("atualizando…"), nunca spinner agressivo.
- A frase de IA tem um "pensando…" leve enquanto os números já estão na tela.

### Erro

- Linguagem de gente (P4): "Não consegui atualizar agora." em vez de stack trace.
- Degradação graciosa: o app continua usável com dados locais.
- Erros de integração ficam contidos na área da integração, nunca derrubam a home.

---

## 13. Acessibilidade

- **Contraste:** texto `ink` sobre `surface`/`canvas` passa AA. `ink-soft` para secundário; `ink-faint` só para hints (não para informação crítica).
- **Foco visível:** anel de foco azul em controles (teclado).
- **Navegação por teclado:** tudo acionável por Tab/Enter; o gesto de confirmar tem equivalente de teclado.
- **Tamanho de alvo:** botões e linhas confirmáveis com área de toque/clique confortável.
- **`prefers-reduced-motion`:** desliga animações de deslize/spring.
- **Leitores de tela:** labels nos ícones-só (sidebar, botão de confirmar), estados anunciados ("confirmado").
- **Números tabulares** ajudam leitura/comparação de valores.

---

## 14. Responsividade

Desktop-first (v1 é desktop only), mas o conteúdo se adapta a larguras de janela:

| Largura | Comportamento |
|---|---|
| Largo (≥1200px) | herói à esquerda + "Falta confirmar" à direita; tabelas espaçadas |
| Médio (~900–1200px) | conteúdo centralizado, herói e lista empilhados |
| Estreito (janela pequena) | colunas únicas; sidebar pode recolher para só ícones |

> Mobile (Tauri 2) é um caminho futuro (doc 08). O design já evita depender de hover como único meio (rótulos da sidebar também acessíveis por foco), o que facilita a portabilidade depois.

---

## 15. Implementação em Tailwind

### Tokens → `tailwind.config`

```js
// tailwind.config.js (extract)
theme: {
  extend: {
    colors: {
      blue: { 50:"#EEF4FE",100:"#DCE8FD",200:"#BBD3FB",300:"#87BBF8",
              400:"#6098F0",500:"#4078E6",600:"#2F63D4",700:"#244FB0",800:"#1B3C84" },
      ink: { DEFAULT:"#0E1116", soft:"#5B616E", faint:"#8A909C" },
      canvas:"#F7F8FA", line:"#E3E6EC", "line-strong":"#D4D8E0",
      positive:"#12A06B", "positive-soft":"#E2F4EC",
      negative:"#D74A45", "negative-soft":"#FBE9E7",
      attention:"#E5982B", "attention-soft":"#FCF1DF",
    },
    fontFamily: { sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"] },
    borderRadius: { card:"16px", sheet:"24px" },
    boxShadow: { brand:"0 6px 18px rgba(64,120,230,.30)" },
  }
}
```

### `globals.css` (essência)

```css
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
:root { color-scheme: light; }
body { background: #F7F8FA; color: #0E1116; font-family: "Hanken Grotesk", system-ui, sans-serif; }
.tnum { font-variant-numeric: tabular-nums lining-nums; }
```

### Convenções de implementação

- **Money helper:** centavos → BRL só na borda de exibição (`formatBRL(cents)`); nunca calcular em float (doc 02 §3.1).
- **Componentes "burros" + lógica fora:** componentes de UI recebem props já calculadas; a aritmética vem da camada de domínio (P8).
- **Sem `localStorage` para estado de dados:** estado de tela em memória/Zustand; dados no SQLite (doc 01).
- **Classe utilitária `tnum`** em todo valor monetário.

---

## 16. Decisões

| # | Decisão | Racional |
|---|---|---|
| UX-1 | Desktop only, tema claro (v1) | Foco; restrição do autor |
| UX-2 | Sidebar-trilho + header solto | Visível mas fora do clichê de admin template |
| UX-3 | Azul = marca; verde/vermelho = estado | Disciplina de cor; significado |
| UX-4 | Herói "Sobra esse mês" como centro da home | Um número manda (P1) |
| UX-5 | Botão circular de confirmar como átomo | Gesto central (P3); tátil e satisfatório |
| UX-6 | Número primeiro, frase de IA depois | UI nunca espera a IA para mostrar dinheiro |
| UX-7 | "+" abre menu de tipos → formulário dedicado | Separado pra criar (P5); captura rápida |
| UX-8 | Sem diálogo de confirmação no gesto principal | Atrito mata o prazer; usar "desfazer" |
| UX-9 | Hanken Grotesk + números tabulares | Caráter + leitura de dinheiro |
| UX-10 | Estados vazios acolhedores com ação | Primeiro uso guiado (P4) |
| UX-11 | Hover não é o único meio (foco também) | Acessibilidade + portabilidade futura |

---

*Fim do documento 07. Próximo: [08 — Ideias de Melhoria & Roadmap](./08-ideias-melhoria-roadmap.md). Anterior: [06 — Motor de Insights](./06-motor-de-insights.md).*
