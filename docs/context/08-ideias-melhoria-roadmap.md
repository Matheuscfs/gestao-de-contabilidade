# Quibo — Ideias de Melhoria & Roadmap

> O futuro do Quibo: licença, fases de entrega, backlog priorizado, ideias de produto que valem a pena, riscos consolidados e o que deliberadamente NÃO fazer. Pré-requisitos: todos os documentos anteriores (00–07).

---

## Sumário

1. [Como ler este documento](#1-como-ler-este-documento)
2. [Licença e postura open-source](#2-licença-e-postura-open-source)
3. [Roadmap por fases](#3-roadmap-por-fases)
4. [Backlog priorizado](#4-backlog-priorizado)
5. [Ideias de melhoria — captura sem atrito](#5-ideias-de-melhoria--captura-sem-atrito)
6. [Ideias de melhoria — inteligência](#6-ideias-de-melhoria--inteligência)
7. [Ideias de melhoria — experiência](#7-ideias-de-melhoria--experiência)
8. [Ideias de melhoria — dados e continuidade](#8-ideias-de-melhoria--dados-e-continuidade)
9. [Ideias de melhoria — mobile](#9-ideias-de-melhoria--mobile)
10. [Ideias de melhoria — comunidade e OSS](#10-ideias-de-melhoria--comunidade-e-oss)
11. [Riscos consolidados e mitigações](#11-riscos-consolidados-e-mitigações)
12. [Métricas de sucesso](#12-métricas-de-sucesso)
13. [Decisões em aberto](#13-decisões-em-aberto)
14. [Anti-roadmap: o que NÃO fazer](#14-anti-roadmap-o-que-não-fazer)
15. [Marcos sugeridos](#15-marcos-sugeridos)

---

## 1. Como ler este documento

Este é um documento **vivo de direção**, não um compromisso. Como o Quibo é ferramenta pessoal (00 §7), o roadmap serve ao autor: o que fazer primeiro para abandonar o Excel, e o que guardar para depois sem inflar o v1.

Prioridade-mãe: **o v1 enxuto e excelente** (00 §11). Toda ideia aqui é avaliada por uma régua: *isso ajuda o autor a largar a planilha, ou é vaidade de feature?*

---

## 2. Licença e postura open-source

O repositório é público desde o início (00 §6). Duas decisões: **qual licença** e **qual postura de suporte**.

### Escolha de licença

| Licença | Efeito | Quando faz sentido |
|---|---|---|
| **MIT** | permissiva; qualquer um usa/forka/comercializa | máxima adoção; tanto faz se alguém hospedar |
| **AGPL-3.0** | copyleft forte; quem hospedar como serviço deve abrir o código | protege contra alguém transformar em SaaS fechado |
| **Apache-2.0** | permissiva + patente | como MIT, com cláusula de patente |

**Recomendação:** como há uma *possibilidade* remota de um dia oferecer versão hospedada (mesmo que improvável), **AGPL-3.0** protege essa porta sem custo para o uso pessoal/self-host. Se o objetivo for puramente "doar e que façam o que quiserem", **MIT**. Para o Quibo (pessoal, mas com a fresta de futuro), **AGPL** é o default prudente. Decisão final é do autor (§13).

### Postura de suporte: "source-available sem garantia"

- README com tom claro: **"é a ferramenta que eu uso, sem garantia, sem suporte — pegue se quiser"** (00 §7).
- `CONTRIBUTING.md` mínimo: PRs bem-vindos, mas sem promessa de revisão rápida.
- Issues abertas, mas sem SLA. Expectativas honestas evitam o "esforcinho que incha".
- Sem roadmap público de promessas; sem captura de e-mail; sem divulgação ativa.

### Higiene de repositório público desde o commit 1

- Sem segredos no histórico (chaves Pluggy/IA jamais commitadas; `.env.example` apenas).
- `LICENSE`, `README`, `SECURITY.md` (como reportar), `.gitignore` cuidando de `.db`, builds, env.
- CI de build verde (doc 01 §11) para quem clonar conseguir rodar.

---

## 3. Roadmap por fases

### v1 — "Largar o Excel" (núcleo)

Objetivo: o autor gerencia tudo no Quibo, sem planilha.

- Home "Mês" (estados positivo/apertado/vermelho).
- Compromissos: Salário, Custo de Vida, Dívida, Cartão (cadastro + confirmação).
- Lançamentos manuais; captura sem atrito.
- Contas, Categorias, Personas.
- SQLite local + migrações + backup; build mac/win/linux.
- Reconciliação manual esperado×realizado.
- Motor de insights determinístico (estados + movimentos + frase-template).
- Fechar o mês (ritual).

### v1.5 — "Parar de digitar" (Pluggy + IA)

- Integração Pluggy (auto-import + reconciliação automática).
- Camada de IA BYOK (narrativa do mês, perguntas livres, Ollama).
- Detecção de recorrência (Pluggy) alimentando o motor.

### v2 — "Patrimônio e profundidade"

- Investimentos + dados de mercado (doc 05).
- Metas e Planejamento/Orçamento.
- Tendências históricas mais ricas; comparações.
- Export/import e backup criptografado em nuvem do usuário.

### v3 — "Alcance" (se houver vontade)

- Mobile via Tauri 2 (reusa o frontend).
- Sync e2e entre dispositivos.
- MCP da Pluggy para IA consultar dados diretamente.
- Plugins/extensibilidade pela comunidade.

> As fases são guias, não contratos. v3 só existe se o autor quiser — e provavelmente nunca, dado o foco no Pitrace (00 §7).

---

## 4. Backlog priorizado

Régua: **impacto na dor do autor × esforço**. Ordenado por prioridade.

| Prioridade | Item | Fase | Impacto | Esforço |
|---|---|---|---|---|
| P0 | Home "Mês" + confirmar | v1 | altíssimo | médio |
| P0 | Cadastro dos 4 compromissos | v1 | altíssimo | médio |
| P0 | Persistência local + migrações + backup | v1 | altíssimo | médio |
| P0 | Build/release mac/win/linux | v1 | alto | médio |
| P1 | Motor de insights determinístico | v1 | alto | médio |
| P1 | Captura sem atrito (lançamento avulso) | v1 | alto | baixo |
| P1 | Fechar o mês (ritual) | v1 | alto | médio |
| P2 | Integração Pluggy (import + reconciliação) | v1.5 | altíssimo | alto |
| P2 | IA BYOK (narrativa + Ollama) | v1.5 | médio-alto | médio |
| P3 | Investimentos + cotações | v2 | médio | alto |
| P3 | Metas + orçamento | v2 | médio | médio |
| P3 | Backup e2e em nuvem do usuário | v2 | médio | médio |
| P4 | Captura por linguagem natural | v2 | alto | médio |
| P4 | Mobile (Tauri 2) | v3 | alto | alto |
| P4 | Sync e2e | v3 | médio | altíssimo |
| P5 | MCP Pluggy para IA | v3 | médio | médio |
| P5 | Plugins/comunidade | v3 | baixo | alto |

> Nota: a Pluggy é "altíssimo impacto" porque mata a digitação (a dor original), mas fica em v1.5 por ser "alto esforço" e por o v1 precisar fechar primeiro com entrada manual robusta.

---

## 5. Ideias de melhoria — captura sem atrito

A digitação é a dor original (00 §2). Reduzi-la é o tema de maior alavancagem.

### 5.1 Captura por linguagem natural (com IA)

"gastei 80 no mercado ontem" → lançamento estruturado (valor 80, EXPENSE, categoria Mercado, data ontem). A IA **extrai estrutura** (não calcula dinheiro — extrai), o usuário confirma. Reduz o atrito a quase zero. Excelente sinergia com BYOK e Ollama.

### 5.2 OCR de comprovante / nota

Foto/print de um recibo → extrai valor, data, estabelecimento → lançamento. Local-first ideal (OCR on-device). Médio esforço, alto valor para quem não tem Pluggy.

### 5.3 Import OFX / CSV / extrato

Para bancos sem cobertura Pluggy ou para quem não quer conectar: importar um OFX/CSV e mapear colunas → entries (com anti-duplicata). Fallback universal e barato.

### 5.4 Atalhos de teclado / quick add

No desktop, um atalho global abre o "adicionar" sem navegar. Power-users (o público técnico, 00 §7) amam isso.

### 5.5 Templates de lançamento

Gastos frequentes (almoço, uber) viram botões de 1 clique que pré-preenchem. Reduz repetição.

---

## 6. Ideias de melhoria — inteligência

Sempre respeitando P8 (IA é a voz, não a calculadora).

### 6.1 Previsão de fluxo de caixa (determinística)

Projetar o saldo dos próximos meses a partir dos compromissos conhecidos ("em 3 meses, no ritmo atual, você terá R$ X"). Cálculo determinístico; IA narra. Ajuda a antecipar apertos.

### 6.2 Simulações "e se" (what-if)

"E se eu cortar a assinatura X?" / "E se eu adiantar a dívida?" → recalcula o impacto (determinístico) e a IA explica. Educativo e poderoso.

### 6.3 Detecção de anomalias

Gasto muito acima do padrão de uma categoria → aviso calmo ("comida 40% acima da média — algo diferente esse mês?"). Estatística simples, sem alarme.

### 6.4 MCP da Pluggy para perguntas livres

A IA consulta a Pluggy via MCP (doc 03 §8) para responder "quanto gastei com streaming esse ano?" sem o app pré-agregar tudo. v3.

### 6.5 Resumo anual / retrospectiva

Um "retrospecto do ano" (tipo Spotify Wrapped, mas sóbrio e útil): para onde foi o dinheiro, evolução da sobra, metas batidas. Momento de fechamento prazeroso.

---

## 7. Ideias de melhoria — experiência

### 7.1 Command palette opcional (power-user)

O autor recusou command bar como navegação principal (correto — precisa ser descobrível). Mas como **atalho power-user** (Cmd+K) *além* da sidebar visível, é um bônus para quem é técnico, sem prejudicar o leigo. Opt-in, não o caminho padrão.

### 7.2 Temas (além do claro)

v1 é só claro (UX-1). Dark mode e variações de tema são candidatos a v2+, se houver vontade — a base de tokens já facilita.

### 7.3 Widgets / visão rápida

Um modo "glance" (saldo + sobra) acessível rápido, sem abrir o app inteiro. No desktop, poderia ser uma janela compacta.

### 7.4 Personalização da home

Escolher o que aparece abaixo do herói (ordem dos blocos), respeitando o limite anti-dashboard.

### 7.5 Sons e microinterações

O gesto de confirmar com um som sutil opcional — aumenta o prazer tátil. Desligável.

---

## 8. Ideias de melhoria — dados e continuidade

### 8.1 Backup criptografado em nuvem do usuário

Gravar um `.db` criptografado numa pasta que o próprio usuário sincroniza (iCloud/Drive/Dropbox). Continuidade sem servidor nosso (doc 01 §10). v2.

### 8.2 Sync e2e entre dispositivos

Se virar necessidade real: CRDT/replicação com criptografia ponta-a-ponta (o servidor, se houver, nunca lê). Alto esforço; v3; provavelmente nunca.

### 8.3 Multi-moeda

Para quem tem gasto/investimento em outra moeda. Requer câmbio (provedor) e cuidado de modelagem (valor + moeda). v2+ se necessário.

### 8.4 Multi-perfil local

Mais de um banco na mesma máquina (separar contextos fortemente). Personas resolvem a maioria dos casos; multi-perfil só se Personas não bastarem.

### 8.5 Versionamento / histórico de alterações

Trilha de auditoria local ("esse lançamento foi editado em X"). Útil para confiança; barato com `updatedAt` + um log opcional.

---

## 9. Ideias de melhoria — mobile

### 9.1 Mobile via Tauri 2

Tauri 2 abre iOS/Android **reusando o frontend** (doc 01 §2). É o caminho mais barato para mobile se a demanda aparecer. Mas reabre o trilema (00 §7): mobile fácil para leigo puxa para sync/nuvem. Decisão deliberadamente adiada.

### 9.2 Companion de captura

Mesmo sem app mobile completo, um fluxo leve de **captura** no celular (foto de nota, áudio "gastei 50") que sincroniza depois — combina com 5.1/5.2. Mas depende de sync (8.2).

> Realismo: mobile provavelmente fica fora para sempre, dado o foco do autor no Pitrace. O design já é portável (UX-11) caso a vontade mude.

---

## 10. Ideias de melhoria — comunidade e OSS

### 10.1 Plugins / extensibilidade

Permitir conectores de mercado/banco da comunidade via uma interface (como a abstração de provedor, doc 04 §3 / 05 §5). Aumenta cobertura sem o autor manter tudo. v3.

### 10.2 Conjuntos de categorias / temas compartilhados

A comunidade compartilha "packs" de categorias, ícones, temas. Baixo esforço, simpático.

### 10.3 Documentação como produto

Este próprio pacote de contexto (00–08) pode virar a documentação pública do repo, mostrando seriedade desde o início e facilitando contribuição.

### 10.4 Traduções

i18n (a partir do pt-BR) se algum dia houver interesse fora do Brasil. Improvável, mas a arquitetura de copy centralizada facilita.

---

## 11. Riscos consolidados e mitigações

Reunião dos riscos espalhados pelos documentos.

| Risco | Doc | Mitigação |
|---|---|---|
| Escopo inchar (ferramenta → produto) | 00 §13 | source-available sem garantia; v1 enxuto; foco no autor |
| Migração de schema quebra banco | 01 §17, 02 §13 | migrações idempotentes + backup pré-migração |
| Privacidade na IA | 04 §9 | opt-in; só resumos; modelo local |
| Confiança no cálculo | 04 §1, 06 | determinístico + testado; centavos inteiros; IA nunca calcula |
| Assinatura/distribuição atrita | 01 §11 | documentar bypass; assinar só se necessário |
| Pluggy/IA mudam contrato | 03, 04 | clientes isolados e versionados; degradação graciosa |
| Limite do plano Pluggy free | 03 §13 | refresh ≤1×/dia; confirmar limites |
| Over-engineering (Rust+IA+Pluggy+invest) | 00 §13 | v1 deliberadamente enxuto |
| Aconselhamento de investimento indevido | 05 §13 | acompanhar, não aconselhar; falar em opções |
| Abandono (projeto pessoal sem pressão) | — | manter v1 útil e fechado; valor ao autor garante uso contínuo |

---

## 12. Métricas de sucesso

Pessoais, não de negócio (00 §14):

1. O autor **abandonou o Excel**.
2. **Fechar o mês** leva minutos.
3. **Registrar um gasto** é instantâneo.
4. A home responde **"estou bem?"** em 2 segundos.
5. O autor **confia nos números** (nunca confere na mão).
6. Quem instalou (técnico) **roda sem ajuda**.

Sinais de alerta (anti-métricas): se o autor voltar ao Excel para "algo que o Quibo não faz bem", isso é um bug de produto a investigar — não uma feature faltando.

---

## 13. Decisões em aberto

Decisões que ainda dependem do autor:

| # | Decisão | Opções | Inclinação |
|---|---|---|---|
| OPEN-1 | Licença | AGPL-3.0 / MIT / Apache-2.0 | AGPL (protege a fresta de futuro) |
| OPEN-2 | Tauri vs Electron (final) | Tauri+Drizzle / Electron+Prisma | Tauri (moderno/leve); Electron se quiser preservar Prisma |
| OPEN-3 | Nome do repo | `quibo` / `quibo-desktop` | `quiboapp/quibo` (limpo) |
| OPEN-4 | "Salário" e "Receita" separados ou um fluxo só | separados / unificado com seletor | unificado (menos itens = mais simples) |
| OPEN-5 | Criptografia do banco por padrão | on / off | off por padrão, ligável (atrito) |
| OPEN-6 | Limite do "clima" apertado | 10% / outro | 10% default, configurável |
| OPEN-7 | Onboarding captura perfil pessoal? | sim / não | opcional, pulável |
| OPEN-8 | Investimentos no v2 ou cortar | manter / cortar | manter modelo, construir só se usar |

---

## 14. Anti-roadmap: o que NÃO fazer

Tão importante quanto o roadmap. O Quibo **não** vai:

- Virar **SaaS** hospedado por nós (custo, responsabilidade, contradiz local-first).
- Guardar **dado de terceiros** num servidor nosso.
- **Mover dinheiro** (Pix/pagamentos via Pluggy) — só leitura.
- Dar **recomendação de investimento** específica (compra/venda).
- Ter **telemetria** silenciosa.
- Virar **rede social** financeira / gamificação tóxica / comparação com outros.
- Adicionar **anúncios** ou monetizar dado.
- Prometer **suporte** ou UX redondinha para leigo (sem assinar esse trabalho).
- Inflar a home com **dashboard** de dez gráficos.
- Deixar a **IA calcular** dinheiro.

> O anti-roadmap protege a identidade do produto tanto quanto o roadmap a constrói.

---

## 15. Marcos sugeridos

Uma sequência realista, do zero ao Quibo útil.

```
Marco 1 — Esqueleto
  shell (sidebar/header) + tema + tokens + roteamento
  SQLite + migração inicial + seed

Marco 2 — Núcleo de dados
  CRUD dos 4 compromissos + contas/categorias/personas
  entries + cálculo de sobra + saldo

Marco 3 — A home viva
  home "Mês" (3 estados) + gesto de confirmar
  motor de insights determinístico (frase-template)

Marco 4 — Fechar o mês
  ritual + tendências básicas + captura sem atrito
  >>> aqui o autor já consegue largar o Excel <<<

Marco 5 — Distribuição
  CI release mac/win/linux + repo público arrumado

Marco 6 — Parar de digitar (v1.5)
  Pluggy (import + reconciliação) + IA BYOK + Ollama

Marco 7 — Profundidade (v2)
  investimentos + metas + backup e2e
```

O **Marco 4** é a linha de chegada do que importa: a partir dele, o Quibo cumpre sua razão de existir. Tudo depois é melhoria.

---

*Fim do documento 08 e do pacote de contexto do Quibo. Anterior: [07 — Design System & UX](./07-design-system-ux.md). Índice: [00 — Visão Geral](./00-visao-geral-produto.md).*
