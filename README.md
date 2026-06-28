# Quibo — Pacote de Contexto

Base de contexto de ponta a ponta do **Quibo**, um app **desktop, local-first e open-source** de finanças pessoais para o brasileiro. Filosofia central: **tão fácil que assusta**.

> Ferramenta pessoal, construída primeiro para o autor, oferecida como cortesia (source-available, sem garantia). Sem SaaS, sem servidor, sem coleta de dado. O dado é do usuário; integrações usam as chaves dele (BYOK).

---

## Como usar este pacote

Leia na ordem para entender o produto inteiro, ou pule para o documento que precisa. Os documentos se referenciam entre si.

| # | Documento | O que cobre |
|---|---|---|
| 00 | [Visão Geral do Produto](./00-visao-geral-produto.md) | Identidade, princípios, modelo mental (compromisso×lançamento), filosofia, glossário, índice |
| 01 | [Arquitetura Desktop & Tecnologia](./01-arquitetura-desktop.md) | Tauri, Rust, Drizzle/SQLite, local-first, segurança, build, distribuição |
| 02 | [Estrutura de Dados](./02-estrutura-de-dados.md) | Modelo unificado, schema, integridade, cálculos, reconciliação |
| 03 | [Integração Pluggy](./03-integracao-pluggy.md) | BYOK, Rust como servidor seguro local, sync sem webhook, inteligência |
| 04 | [Integração com IA (BYOK)](./04-integracao-ia-byok.md) | Provedores, "IA é a voz, não a calculadora", privacidade, Ollama |
| 05 | [Investimentos & Mercado](./05-investimentos.md) | Carteira, cotações, "opções bacanas", reserva antes de investir |
| 06 | [Motor de Insights com IA](./06-motor-de-insights.md) | Clima do mês, movimentos por estado, prompts, fechar o mês |
| 07 | [Design System & UX](./07-design-system-ux.md) | Tokens, voz, shell (sidebar/header), home "Mês", gesto de confirmar, telas |
| 08 | [Ideias de Melhoria & Roadmap](./08-ideias-melhoria-roadmap.md) | Licença, fases, backlog, ideias, riscos, anti-roadmap |

---

## Os 10 princípios (resumo)

1. Um número manda · 2. Anti-dashboard · 3. Um gesto central (confirmar) · 4. Linguagem de gente · 5. Separado pra criar, unificado pra usar · 6. Calma, não alarme · 7. O dado é do usuário · 8. A calculadora é local e burra; a IA é a voz · 9. Esconder a complexidade · 10. Essencial, mas muito bem feito.

## Stack (resumo)

Tauri 2 · Rust (core) · React + TypeScript + Tailwind (UI) · SQLite + Drizzle (dados) · keychain do SO (segredos) · GitHub Actions (build mac/win/linux). Integrações BYOK: Pluggy (dados bancários), OpenAI/Anthropic/Ollama (IA), provedores de cotação (mercado).

## Cor de marca

Azul `#4078E6` (única cor de marca) · verde `#12A06B` (positivo) · vermelho `#D74A45` (negativo) · base nítida `#F7F8FA`/`#FFFFFF` · tinta `#0E1116`. Tipografia: Hanken Grotesk, números tabulares.

---

*Pacote vivo. O documento 00 é a fonte da verdade da estrutura; o 08 lista decisões em aberto.*
