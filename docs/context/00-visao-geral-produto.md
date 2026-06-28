# Quibo — Visão Geral do Produto

> Documento âncora. É a porta de entrada do pacote de contexto: define o que o Quibo é, para quem, com que filosofia, e indexa todos os outros documentos. Sempre que houver dúvida sobre "qual é a intenção", a resposta mora aqui.

---

## Sumário

1. [Identidade do produto](#1-identidade-do-produto)
2. [O problema e a aposta](#2-o-problema-e-a-aposta)
3. [Princípios de produto (não-negociáveis)](#3-princípios-de-produto-não-negociáveis)
4. [Modelo mental central](#4-modelo-mental-central)
5. [O ciclo mensal](#5-o-ciclo-mensal)
6. [Filosofia: local-first, open-source e BYOK](#6-filosofia-local-first-open-source-e-byok)
7. [Público-alvo e modo de distribuição](#7-público-alvo-e-modo-de-distribuição)
8. [Mapa de domínios](#8-mapa-de-domínios)
9. [Os pilares de inteligência](#9-os-pilares-de-inteligência)
10. [Mapa de documentos de contexto](#10-mapa-de-documentos-de-contexto)
11. [Escopo do v1 vs futuro](#11-escopo-do-v1-vs-futuro)
12. [Decisões arquiteturais-chave (resumo)](#12-decisões-arquiteturais-chave-resumo)
13. [Riscos e armadilhas conscientes](#13-riscos-e-armadilhas-conscientes)
14. [Como saber que deu certo](#14-como-saber-que-deu-certo)
15. [Glossário](#15-glossário)

---

## 1. Identidade do produto

O **Quibo** é um aplicativo **desktop** de **gestão financeira pessoal** para o usuário brasileiro, construído com uma única obsessão: ser **tão fácil que assusta**. Ele organiza a vida financeira em **ciclos mensais** e responde, de relance, quatro perguntas — e só essas quatro:

1. Quanto **entra** esse mês?
2. Quanto **sai**?
3. Quanto **sobra**?
4. O que ainda **falta confirmar**?

Tudo o que existe no produto serve a uma dessas perguntas ou se esconde até ser necessário. O Quibo **não é um painel de analytics**, **não é uma planilha com esteroides** e **não é um assistente que fala demais**. É uma superfície calma que diz a coisa certa na hora certa.

O produto nasce de uma dor pessoal real (gestão no Excel, que é imprática) e é construído primeiro **para o próprio autor**. A possibilidade de doar para outras pessoas é consequência, não objetivo — e essa ordem de prioridade molda quase todas as decisões: simplicidade acima de completude, propriedade do dado acima de conveniência de nuvem, qualidade acima de alcance.

### O que o Quibo é

- Um app **local-first**: os dados moram na máquina do usuário, num banco SQLite local. Sem servidor central, sem conta na nuvem obrigatória.
- Um app **open-source / source-available**: o código é público desde o primeiro commit. Em finanças, transparência de código é funcionalidade de confiança.
- Um app **BYOK** ("bring your own key"): integrações externas (Pluggy, IA) usam as chaves do próprio usuário, armazenadas localmente e nunca compartilhadas.
- Um app **desktop multiplataforma**: macOS, Windows e Linux a partir de uma base única (Tauri).

### O que o Quibo não é

- Não é um SaaS. Não há multi-tenancy, não há servidor que guarde o dado de muitos usuários, não há assinatura.
- Não é um produto comercial (ao menos não por enquanto). Sem funil, sem growth, sem captura de e-mail.
- Não é um chatbot financeiro. A IA é um recurso opcional e silencioso, não o centro da experiência.
- Não é um agregador que vende dado. O modelo de negócio (ausente, de propósito) elimina o incentivo de coletar.

---

## 2. O problema e a aposta

### O problema

Quem tenta se organizar financeiramente cai em um de dois baldes:

- **Planilha (Excel/Sheets):** flexível, mas trabalhosa, feia, sem inteligência, e que exige disciplina manual constante. Some o hábito, some a organização.
- **Apps financeiros existentes:** o mercado está **lotado** — apps mobile, web, integrações com IA que leem áudio de WhatsApp e viram gestor financeiro. Mas a maioria sofre de três males: **complexidade** (forçam o usuário a aprender muitos conceitos), **ansiedade** (recebem com gráfico e número vermelho) e **captura de dado** (o modelo de negócio é monetizar a informação financeira do usuário).

A aposta do Quibo **não é** competir nesse mercado lotado por download ou receita. A aposta é resolver a dor de um jeito que ninguém resolve bem: **radicalmente simples, com o dado 100% do usuário, e com inteligência que reduz atrito em vez de aumentar carga cognitiva.**

### Por que "mercado lotado" é a métrica errada aqui

Mercado cheio importa quando se precisa capturar cliente e receita. O Quibo, sendo ferramenta pessoal eventualmente doada, não disputa atenção nem dinheiro. A pergunta certa não é "tem espaço no mercado?", é **"as ferramentas que existem resolvem a minha dor?"** — e a resposta empírica (o autor está no Excel) é não. Isso, sozinho, justifica o esforço.

### A assimetria que torna tudo viável

As características que tornam o Quibo bom **para o autor** — rápido, local, dados próprios, sem conta, simples e bonito — são **exatamente** as mesmas que o tornam compartilhável a custo marginal quase zero. A versão "pessoal" e a versão "pro pessoal" **convergem**, desde que o produto seja local-first. O conflito entre as duas só existiria no mundo SaaS (custo de servidor, custo de inferência, responsabilidade jurídica de guardar dado alheio) — mundo que o Quibo descarta de propósito.

---

## 3. Princípios de produto (não-negociáveis)

Estes princípios são a constituição do produto. Qualquer decisão de design, dado ou código deve poder ser justificada por eles.

### P1 — Um número manda

A tela do mês tem **um herói**: "Sobra esse mês". Todo o resto é secundário. Nada de cards empilhados competindo por atenção. Se uma informação não ajuda a responder as quatro perguntas centrais, ela não aparece na tela principal.

### P2 — Anti-dashboard

O app recebe o usuário com **calma e espaço**, não com gráfico e ansiedade. Gráficos e relatórios existem, mas vivem no fundo, para quem foi procurar. A primeira impressão é de respiro, não de planilha.

### P3 — Um gesto central

Tudo gira em torno de **`previsto → confirmado`**: um toque que transforma um item em "feito". É o gesto mais satisfatório do produto. Não existem quatro formas diferentes de marcar "pago" — existe uma.

### P4 — Linguagem de gente

"Tá tranquilo", "Recebeu?", "Falta confirmar". **Nunca** "status PENDING", "fatura OVERDUE", "conciliação". Todo jargão financeiro é traduzido em ação humana. A voz é calorosa, curta e brasileira.

### P5 — Separado pra criar, unificado pra usar

Cada domínio (salário, custo de vida, dívida, cartão) tem **seu próprio formulário** com seus campos específicos — isso dá organização na hora de cadastrar. Mas o **consumo** é unificado: tudo se confirma numa tela só. Autoria especializada, consumo simples.

### P6 — Calma, não alarme

Vermelho é cor de **estado**, clara mas sem pânico. O app é reconfortante mesmo quando a notícia é ruim. Em vez de "VOCÊ ESTÁ NEGATIVO!", ele diz "Esse mês fechou no vermelho. Bora ajustar?".

### P7 — O dado é do usuário, ponto

Nenhum dado financeiro sai da máquina sem ação explícita e consciente do usuário. Integrações externas usam chaves do próprio usuário. Não há telemetria silenciosa. Privacidade não é feature de marketing — é a fundação.

### P8 — A calculadora é local e burra; a IA é a voz

Toda aritmética financeira (totais, saldos, tendências, projeções) é **determinística e local**. A IA **nunca** faz conta com o dinheiro do usuário — ela recebe fatos já calculados e só os transforma em linguagem. Isso protege confiança, privacidade e custo de uma só vez.

### P9 — Esconder a complexidade, não eliminá-la

O Quibo tem domínios ricos (salário horista, dívidas parceladas com juros, ciclos de fatura). Essa riqueza existe, mas é configurada uma vez e esquecida. A complexidade mora atrás de "Mais"; o dia a dia é simples.

### P10 — Essencial, mas muito bem feito

Preferir fazer pouco com excelência a fazer muito com mediocridade. Cada tela, cada fluxo, cada documento deve ser denso de qualidade, não de quantidade.

---

## 4. Modelo mental central

O usuário enxerga **dois conceitos**, e só dois:

### Compromisso

Qualquer coisa **esperada e recorrente**: salário, aluguel, assinatura, parcela de dívida, fatura de cartão. É a camada do **"o que deveria acontecer"**. Configurado uma vez. Cada domínio (salário, custo de vida, dívida, cartão) é um "sabor" de compromisso, com campos próprios — mas todos compartilham a mesma natureza: geram expectativa mensal.

### Lançamento

Um **movimento de dinheiro** numa linha do tempo, com **um estado só: `previsto → confirmado`**. É a camada do **"o que de fato aconteceu"**. Os compromissos projetam lançamentos automaticamente a cada mês. Um gasto avulso é só um lançamento sem compromisso. Uma transação importada da Pluggy é um lançamento já realizado.

### A grande reconciliação: esperado × realizado

```
COMPROMISSO (esperado)            LANÇAMENTO (realizado)
─────────────────────             ──────────────────────
Salário CLT R$ 6.200      ──────► Recebimento confirmado / Pluggy
Aluguel R$ 1.500          ──────► Pagamento confirmado / Pluggy
Fatura cartão (ciclo)     ──────► Pagamento da fatura
Parcela financiamento     ──────► Parcela paga
(nada)                    ──────► Compra avulsa no mercado
```

- O **cadastro manual** define o esperado (compromissos).
- A **Pluggy** (quando conectada) preenche o realizado automaticamente (lançamentos).
- O **motor de reconciliação** casa um com o outro: "esse pagamento de R$ 1.500 é o seu aluguel".
- O usuário só precisa **confirmar** o que o sistema não conseguiu casar sozinho.

Esse modelo elimina a proliferação de conceitos do sistema antigo (que tinha quatro formas diferentes de marcar "pago": status de transação, status de fatura, status de parcela e registro mensal de pagamento). No Quibo, há **um estado de confirmação unificado**.

---

## 5. O ciclo mensal

### O mês como unidade

Toda a experiência gira em torno de um **mês selecionado globalmente**. Há um seletor de mês no topo, e todas as telas analíticas (dashboard, lançamentos, relatórios) respondem a ele. O mês é a unidade de organização, de fechamento e de insight.

### Convenção "mês de trabalho × mês de pagamento"

Regra de negócio herdada e mantida, **mas tornada explícita** (não mágica global):

> A renda recebida no mês **M** corresponde ao trabalho do mês **M−1**.

No sistema antigo, isso era uma regra global invisível que confundia. No Quibo, vira um **campo por compromisso** (um offset tipo "recebo no mês seguinte"). Assim, o salário sabe sozinho que o trabalho de maio é pago em junho, sem o usuário ter que decifrar por que junho mostra os salários de maio. Explícito e local = confiança.

### Estados do mês

Cada mês tem um **estado financeiro calculado** que dirige a experiência (ver documento 06 — Motor de Insights):

| Estado | Condição (aproximada) | Tom da home |
|---|---|---|
| **Sobra boa** | sobra ≥ X% da receita | "Tá tranquilo. Dá pra respirar." |
| **Apertado** | 0 < sobra < X% | "Tá no limite. Cuidado com o que falta." |
| **No vermelho** | sobra < 0 | "Esse mês fechou no vermelho. Bora ajustar?" |
| **Neutro/início** | mês ainda em formação | quieto, sem alarme |

### O ritual de fechar o mês

Diferente de uma planilha (que nunca "fecha"), o Quibo tem um **ritual de fechamento**: ao virar o mês, ele revisa o que ficou em aberto, pergunta o que confirmar, e carrega pendências relevantes para o próximo mês. Esse ritual é parte do que torna o produto um hábito, não uma obrigação.

---

## 6. Filosofia: local-first, open-source e BYOK

As três escolhas se reforçam numa única identidade coerente.

### Local-first

Os dados vivem em SQLite **na máquina do usuário**. Consequências:

- **Privacidade real:** dado financeiro nunca sai do computador sem ação explícita.
- **Offline:** funciona sem internet.
- **Velocidade:** consultas locais são instantâneas.
- **Sem custo de servidor:** nada a hospedar, nada a pagar mensalmente.
- **Sem responsabilidade jurídica** de guardar o dado de terceiros (LGPD, vazamento, suporte).

Para finanças pessoais, local-first é quase a escolha ideal — é o caso de uso que mais se beneficia dela.

### Open-source / source-available

O código é público desde o início. Em finanças:

- **Confiança verificável:** qualquer pessoa pode auditar que o app não exfiltra dado.
- **Coerência:** open-source + local-first contam a mesma história ("é seu").
- **Custo de doação baixíssimo:** publicar binários no GitHub Releases é o esforço marginal de compartilhar.

A licença e o modelo de contribuição estão detalhados no documento 01 (Arquitetura) e 08 (Ideias/Roadmap). A postura é **"source-available sem garantia"**: a ferramenta que o autor usa, oferecida como cortesia, sem promessa de suporte.

### BYOK — Bring Your Own Key

Integrações externas (Pluggy, provedores de IA) usam as **chaves do próprio usuário**:

- O autor não paga inferência de IA nem cota de Pluggy de ninguém.
- Cada usuário é dono das próprias conexões.
- Os segredos ficam no **keychain do sistema operacional**, nunca em texto plano, nunca num servidor.

Detalhe crucial de arquitetura: a Pluggy e a maioria dos provedores assumem um "servidor seguro" para guardar segredos. No Quibo, **o backend Rust do Tauri faz esse papel localmente** — é o "servidor seguro" de cada usuário, na própria máquina. Isso resolve a tensão sem comprometer o local-first.

---

## 7. Público-alvo e modo de distribuição

### Público primário: o autor

O Quibo é construído **para o próprio autor** resolver a própria dor. Toda decisão de UX prioriza o uso diário do autor. Isso é uma força, não uma limitação — produtos feitos para uma pessoa real costumam ser melhores que produtos feitos para uma persona genérica.

### Público secundário: qualquer pessoa, sem promessa

A intenção de "fornecer para as pessoas" existe, mas **sem divulgação e sem suporte**. A armadilha consciente: fazer algo *para si* e fazer algo *distribuível para leigos* são níveis de esforço muito diferentes (onboarding, casos de borda, build assinado, migração de schema, issues). A disciplina adotada:

1. **Construir primeiro só para o autor**, sem dó, otimizando o uso pessoal.
2. **Abrir o repositório** desde o início como cortesia.
3. **Publicar binários** quando estável.
4. **Deixar explícito**: "é a ferramenta que eu uso, sem garantia, sem suporte — pega se quiser".

No instante em que se prometer UX redondinha para leigo, assina-se um trabalho de produto que o autor declarou não querer. Source-available + "sem warranty" é o jeito de baixo custo de doar.

### Trilema consciente: dado-do-usuário × fácil × mobile

Há um trilema que vale ter em mente:

- **Local-first puro** aponta para desktop (Tauri) ou self-host — trivial para o autor e para devs, mas com atrito de instalação para não-técnico, e mobile fica de fora.
- **Mobile fácil para todos** puxa de volta para hospedar — justamente a responsabilidade/negócio que o autor não quer.

Resolução para o v1: **desktop local-first, mirando quem é técnico o suficiente para instalar.** Se um dia aparecer demanda real de leigo/mobile, decide-se *naquele momento*, sem comprometer o v1. Tauri 2 abre a porta de mobile no futuro sem reescrever o frontend.

---

## 8. Mapa de domínios

Os domínios financeiros do Quibo, em alto nível. O detalhamento de cada um está no documento 02 (Estrutura de Dados).

| Domínio | Natureza | Papel | Doc |
|---|---|---|---|
| **Receitas / Salários** | Compromisso (esperado) | Fontes de renda (fixo ou horista) | 02 |
| **Custo de Vida** | Compromisso (esperado) | Despesas fixas recorrentes | 02 |
| **Dívidas** | Compromisso (esperado) | Financiamentos, empréstimos, parcelas | 02 |
| **Cartões de Crédito** | Compromisso + cálculo de ciclo | Cartões, limites, faturas | 02 |
| **Lançamentos / Transações** | Realizado | Hub de movimentações (manuais e Pluggy) | 02 |
| **Investimentos** | Patrimônio | Carteira, preço, rentabilidade | 02, 05 |
| **Contas** | Suporte | Onde o dinheiro mora; saldo | 02 |
| **Personas** | Suporte | Contextos (pessoal, PJ, família) | 02 |
| **Categorias** | Suporte | Classificação de gastos/receitas | 02 |
| **Metas** | Aspiracional | Objetivos de poupança | 02, 06 |

### Mapa lógico (alto nível)

```
Usuário
 ├── Contas ──────────── onde o dinheiro mora (saldo)
 │     └── recebem Salários, pagam Custos/Dívidas
 ├── Cartões ─────────── compromisso de ciclo + faturas
 ├── Compromissos (esperado)
 │     ├── Salário
 │     ├── Custo de Vida
 │     ├── Dívida (+ parcelas)
 │     └── Fatura de cartão
 ├── Lançamentos (realizado)
 │     ├── manuais (digitados)
 │     └── importados da Pluggy
 ├── Investimentos ───── patrimônio e rentabilidade
 ├── Personas / Categorias ── recortes transversais
 └── Estado de confirmação ── previsto/confirmado por item por mês
```

---

## 9. Os pilares de inteligência

O Quibo combina três fontes de inteligência, cada uma no seu papel — a separação é deliberada (ver P8).

### Pilar 1 — Cálculo determinístico (local, confiável)

Toda a matemática: totais, sobra, estados do mês, tendências, projeções, ciclos de cartão, progresso de dívida, "quanto dá pra guardar". Roda local, é exato, **nunca** delega ao LLM. É a fundação de confiança.

### Pilar 2 — Pluggy (dado real + inteligência pronta)

Quando conectada, a Pluggy traz transações reais já categorizadas e oferece APIs de inteligência (recorrência, enriquecimento). Ela reduz drasticamente a digitação manual e já entrega categorização e detecção de assinaturas de forma determinística — sobrando menos para o LLM. Detalhes no documento 03.

### Pilar 3 — IA generativa (a voz, opcional, BYOK)

O LLM recebe **fatos já calculados** (não dado bruto para fazer conta) e produz: narrativa humana do mês, sugestões personalizadas, respostas a perguntas livres. É opcional, usa a chave do usuário, e idealmente suporta modelo local (Ollama) para os mais cautelosos com privacidade. Detalhes nos documentos 04 e 06.

---

## 10. Mapa de documentos de contexto

Este pacote é a base de contexto de ponta a ponta do Quibo. Ordem de leitura recomendada: 00 → 01 → 02 → demais conforme necessidade.

| Doc | Título | Cobre |
|---|---|---|
| **00** | Visão Geral do Produto | Identidade, princípios, modelo mental, índice (este documento) |
| **01** | Arquitetura Desktop & Tecnologia | Tauri, Rust, frontend, SQLite, build, distribuição, segurança |
| **02** | Estrutura de Dados | Modelo compromisso×lançamento, schema SQLite/Drizzle, integridade |
| **03** | Integração Pluggy | BYOK, fluxo de connect, sync local, APIs de inteligência |
| **04** | Integração com IA (BYOK) | Abstração de provedores, OpenAI/Anthropic/local, privacidade |
| **05** | Investimentos & Mercado | Carteira, dados de mercado, análises e opções |
| **06** | Motor de Insights com IA | Estados do mês, gatilhos por "clima", prompts |
| **07** | Design System & UX | Tokens, telas, fluxos, navegação (consolida o trabalho de design) |
| **08** | Ideias de Melhoria & Roadmap | Backlog priorizado, riscos, decisões futuras |

> Documentos 03–08 são entregues após esta fundação. Este índice será mantido como fonte da verdade da estrutura.

---

## 11. Escopo do v1 vs futuro

### v1 (o essencial, muito bem feito)

- Dashboard "Mês" (estados positivo, apertado, negativo).
- Cadastro e confirmação dos compromissos: Salário, Custo de Vida, Dívida, Cartão.
- Lançamentos manuais.
- Contas, Categorias, Personas.
- Persistência local SQLite, build desktop mac/win/linux.
- Reconciliação esperado×realizado (manual).
- Motor de insights determinístico (estados + movimentos básicos).

### v1.5 / v2 (depois que o v1 estiver redondo para o autor)

- Integração Pluggy (auto-import).
- Camada de IA BYOK (narrativa do mês, perguntas livres).
- Investimentos com dados de mercado.
- Metas, Planejamento/Orçamento.
- Reconciliação automática (matching Pluggy × compromisso).
- Export/import e backup criptografado.

### Fora de escopo (consciente)

- Multi-usuário / multi-tenant.
- Sincronização em nuvem hospedada por nós.
- App mobile (até haver demanda real).
- Pagamentos / Pix via Pluggy (o Quibo lê, não move dinheiro).

---

## 12. Decisões arquiteturais-chave (resumo)

Resumo das decisões; o racional completo está nos documentos específicos.

| # | Decisão | Por quê | Doc |
|---|---|---|---|
| AD-1 | **Tauri** (não Electron/Wails) | Leve, moderno, cross-platform, porta de mobile | 01 |
| AD-2 | **SQLite + Drizzle** (não Postgres/Prisma) | Local-first; Prisma não viaja bem ao contexto Rust/local | 01, 02 |
| AD-3 | **Dinheiro como inteiro de centavos** | Evitar erro de ponto flutuante em finanças | 02 |
| AD-4 | **Estado de confirmação unificado** | Eliminar as 4 formas de "pago" do sistema antigo | 02 |
| AD-5 | **BYOK com segredos no keychain** | Privacidade, custo zero de inferência, sem servidor | 01, 03, 04 |
| AD-6 | **Backend Rust = servidor seguro local** | Resolver a exigência de "servidor" da Pluggy localmente | 01, 03 |
| AD-7 | **IA recebe fatos calculados, não dado bruto** | Confiança (sem alucinação em conta), privacidade, custo | 04, 06 |
| AD-8 | **Sem telemetria** | Coerência com privacidade como fundação | 01 |
| AD-9 | **Esperado × realizado** como espinha dorsal | Reconciliar manual e Pluggy num modelo só | 02, 03 |

---

## 13. Riscos e armadilhas conscientes

### Risco de escopo ("o esforcinho que incha")

Distribuir para leigos transforma "ferramenta pessoal" em "produto". Mitigação: postura source-available sem garantia; construir para o autor primeiro.

### Risco de migração de schema

Local-first significa que cada usuário tem o próprio banco. Mudar o schema exige **migrações versionadas e idempotentes** que rodam no app de cada um. Tratado no documento 02.

### Risco de privacidade na IA

Mandar dado financeiro para uma API de terceiro contradiz "o dado é seu". Mitigação: IA é opt-in, recebe resumos (não o extrato), e suporta modelo local. Tratado nos documentos 04 e 06.

### Risco de confiança no cálculo

Um erro de cálculo em finanças destrói a confiança. Mitigação: cálculo determinístico, testado, com dinheiro em centavos inteiros; IA jamais faz conta.

### Risco de assinatura/distribuição

macOS e Windows reclamam de apps não assinados. Mitigação para projeto pessoal: shippar sem assinar e documentar "avançar no aviso"; assinar só se incomodar. Tratado no documento 01.

### Armadilha de over-engineering

Local-first + IA + Pluggy + investimentos é muita superfície. Mitigação: o v1 (seção 11) é deliberadamente enxuto; o resto é v2.

---

## 14. Como saber que deu certo

Como é ferramenta pessoal, as métricas de sucesso são pessoais, não de negócio:

1. **O autor abandonou o Excel.** Critério número um. Se o Quibo não substituir a planilha no uso real, falhou.
2. **Fechar o mês leva minutos, não horas.** O ritual mensal é leve.
3. **Registrar um gasto é instantâneo.** Atrito de captura próximo de zero (idealmente, com Pluggy, quase nenhum).
4. **A home responde "estou bem?" em 2 segundos.** O herói + a frase humana bastam.
5. **O autor confia nos números.** Nunca pega a calculadora para conferir.
6. **Quem instalou (técnico) consegue rodar sem ajuda.** Build e setup funcionam.

Não são métricas de DAU, retenção ou receita. São métricas de **utilidade pessoal**.

---

## 15. Glossário

| Termo | Definição |
|---|---|
| **Compromisso** | Item esperado e recorrente (salário, custo fixo, dívida, fatura). Camada do "deveria acontecer". |
| **Lançamento** | Movimento de dinheiro real ou planejado na linha do tempo. Camada do "aconteceu". |
| **Confirmação** | Estado único `previsto → confirmado` de um item num mês. Substitui os status espalhados do sistema antigo. |
| **Esperado × realizado** | Espinha dorsal do modelo: compromissos (esperado) reconciliados com lançamentos (realizado). |
| **Reconciliação** | Processo de casar um lançamento (manual ou Pluggy) com o compromisso correspondente. |
| **Estado do mês / "clima"** | Classificação calculada (sobra boa / apertado / vermelho) que dirige insights e tom. |
| **Local-first** | Arquitetura em que o dado mora na máquina do usuário, sem servidor central obrigatório. |
| **BYOK** | "Bring Your Own Key": integrações usam as chaves do próprio usuário, guardadas localmente. |
| **Pluggy** | Plataforma de Open Finance brasileira que importa dados bancários. Usada via chave pessoal do usuário. |
| **Item (Pluggy)** | Uma conexão com uma instituição financeira no modelo da Pluggy. |
| **Connect Token** | Token de escopo reduzido da Pluggy, usado pelo widget no cliente, gerado pelo backend local. |
| **Mês de trabalho × mês de pagamento** | Convenção: renda recebida no mês M refere-se ao trabalho de M−1. No Quibo, é um offset explícito por compromisso. |
| **Persona** | Recorte de contexto financeiro (pessoal, PJ, família) vinculável a quase tudo. |
| **Movimento (insight)** | Ação contextual sugerida pelo motor de insights conforme o estado do mês (guardar, cortar, investir, permitir um gosto). |
| **"Permitir um gosto"** | Movimento de insight que abençoa explicitamente um gasto de prazer quando há sobra — diferencial emocional do produto. |
| **Tauri** | Framework para apps desktop com frontend web e backend Rust, binário leve. |
| **Drizzle** | ORM TypeScript usado sobre SQLite no Quibo (no lugar do Prisma). |

---

*Fim do documento 00. Próximo: [01 — Arquitetura Desktop & Tecnologia](./01-arquitetura-desktop.md).*
