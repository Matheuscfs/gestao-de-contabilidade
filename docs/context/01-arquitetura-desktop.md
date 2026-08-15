# Gestão de Contabilidade — Arquitetura Desktop & Tecnologia

> Como o Gestão de Contabilidade é construído por dentro. Define a stack, a topologia local-first, o papel de cada camada, segurança, build e distribuição. Pré-requisito de leitura: [00 — Visão Geral do Produto](./00-visao-geral-produto.md).

---

## Sumário

1. [Visão geral da stack](#1-visão-geral-da-stack)
2. [Por que Tauri (decisão e tradeoffs)](#2-por-que-tauri-decisão-e-tradeoffs)
3. [Topologia local-first](#3-topologia-local-first)
4. [Camadas e responsabilidades](#4-camadas-e-responsabilidades)
5. [O backend Rust como "servidor seguro local"](#5-o-backend-rust-como-servidor-seguro-local)
6. [Comunicação frontend ↔ core (IPC)](#6-comunicação-frontend--core-ipc)
7. [Persistência (SQLite)](#7-persistência-sqlite)
8. [Gestão de segredos e segurança](#8-gestão-de-segredos-e-segurança)
9. [Integrações externas (camada de saída)](#9-integrações-externas-camada-de-saída)
10. [Sincronização e backup](#10-sincronização-e-backup)
11. [Build e distribuição](#11-build-e-distribuição)
12. [Estrutura de pastas do repositório](#12-estrutura-de-pastas-do-repositório)
13. [Performance e resiliência](#13-performance-e-resiliência)
14. [Observabilidade sem telemetria](#14-observabilidade-sem-telemetria)
15. [Testes](#15-testes)
16. [Registro de decisões (ADRs)](#16-registro-de-decisões-adrs)
17. [Riscos técnicos](#17-riscos-técnicos)

---

## 1. Visão geral da stack

O Gestão de Contabilidade é um aplicativo **desktop multiplataforma** com frontend web rodando numa webview nativa e um núcleo em Rust. Tudo é **local-first**: não há servidor remoto na operação normal.

| Camada | Tecnologia | Papel |
|---|---|---|
| **Shell desktop** | Tauri 2 | Janela nativa, webview do SO, ponte IPC, empacotamento |
| **Núcleo / backend** | Rust | Comandos, segredos, integrações externas, acesso ao DB |
| **UI** | React 18 + TypeScript 5 | Telas, componentes, estado de tela |
| **Estilo** | Tailwind CSS | Design system do Gestão de Contabilidade (tokens, utilitários) |
| **Roteamento UI** | React Router (ou similar SPA) | Navegação entre telas (sidebar/header) |
| **Estado / dados (front)** | TanStack Query + Zustand | Cache de leitura, estado local de UI |
| **Persistência** | SQLite | Banco local único por usuário |
| **Acesso a dados** | Drizzle ORM (TS) via `tauri-plugin-sql` ou libsql | Schema, migrações, queries tipadas |
| **Segredos** | Keychain do SO (`tauri-plugin-stronghold` / keyring) | Chaves Pluggy e IA |
| **Datas** | date-fns | Cálculo de meses, feriados, ciclos |
| **Build/CI** | GitHub Actions + `tauri-action` | Compilação mac/win/linux, releases |
| **Atualização** | Tauri updater (opcional) | Auto-update assinado (fase futura) |

### Princípios técnicos derivados dos princípios de produto

- **P7 (dado é do usuário)** → nenhuma chamada de rede na operação normal além das integrações BYOK explicitamente acionadas.
- **P8 (calculadora local e burra)** → toda lógica financeira roda no cliente (TS no front ou Rust no core), nunca num serviço remoto.
- **AD-2** → SQLite local + Drizzle, em vez de Postgres + Prisma.

### Onde o código roda

```
┌───────────────────────────── App Tauri ─────────────────────────────┐
│                                                                      │
│   WEBVIEW (UI)                         RUST CORE                      │
│   ───────────                          ─────────                      │
│   React + TS + Tailwind     ◄──IPC──►  comandos (#[tauri::command])   │
│   TanStack Query / Zustand             - acesso a segredos (keychain) │
│   Drizzle (queries)                    - chamadas Pluggy / IA         │
│        │                               - tarefas pesadas / agendadas  │
│        ▼                                       │                      │
│   SQLite (via plugin sql) ◄────────────────────┘                      │
│        ▲                                                              │
│        └── arquivo local: ~/.../quibo/quibo.db                       │
└──────────────────────────────────────────────────────────────────────┘
                    │ (apenas quando o usuário aciona)
                    ▼
        Internet: Pluggy API, OpenAI/Anthropic, dados de mercado
```

---

## 2. Por que Tauri (decisão e tradeoffs)

A escolha do shell desktop foi entre **Tauri**, **Electron** e **Wails** (Go). O contexto: o frontend web (React/Tailwind) já está sendo desenhado e deve ser reaproveitado; o produto é local-first; "moderno, leve e legal" é um requisito explícito.

### Comparativo

| Critério | Tauri 2 | Electron | Wails (Go) |
|---|---|---|---|
| Reaproveita UI web | Sim | Sim | Sim |
| Runtime embutido | Não (webview do SO) | Sim (Chromium+Node) | Não (webview do SO) |
| Tamanho do binário | ~5–10 MB | 100+ MB | ~10–20 MB |
| Consumo de RAM | Baixo | Alto | Baixo |
| Linguagem do core | Rust | Node/JS | Go |
| Ecossistema/plugins | Grande e crescente | Maduríssimo | Menor |
| Mobile (iOS/Android) | Sim (Tauri 2) | Não | Experimental |
| Prisma/SQLite in-process | Não (core é Rust) | Sim (Node) | Não |
| Auto-update | Sim (updater) | Maduríssimo | Sim |

### Decisão: **Tauri 2 + Drizzle + SQLite**

Tauri bate com todos os adjetivos do produto: leve (sem Chromium embutido), moderno, cross-platform (mac/win/linux), com porta de mobile no futuro sem reescrever o frontend. É a stack queridinha da turma local-first justamente por ser a cara desse tipo de app.

### O preço da decisão (e como pagamos)

O único custo real é a **camada de dados**: Prisma não viaja bem para dentro do Tauri (é amarrado a Node e a um engine binário, não encaixa no contexto Rust/SQLite local). A solução elegante:

- **Drizzle ORM sobre SQLite**, acessado pela UI via `tauri-plugin-sql` (ou libsql/turso local). O esquema e as queries ficam em TypeScript no frontend; o Rust vira a casca segura.
- Resultado: **não é preciso virar dev Rust full-time.** Rust cuida de segredos, integrações e tarefas pesadas; o grosso da lógica de dados fica em TS.

### Fallback honesto

Se em algum momento a prioridade virar velocidade sobre elegância e preservar o Prisma intacto, **Electron** é o fallback sem vergonha: ele embute Node, então Prisma + SQLite funcionam in-process. O custo (binário gordo, RAM alta) é irrelevante para um app de finanças pessoal. Como a UI web porta para os dois, essa decisão **não trava o design** já em andamento.

---

## 3. Topologia local-first

### O que "local-first" significa aqui

1. O **estado canônico** do usuário vive no SQLite local. Não há "fonte da verdade" remota.
2. O app é **plenamente funcional offline**. Integrações (Pluggy, IA, mercado) são enriquecimentos opcionais, não dependências.
3. Toda chamada de rede é **explícita e acionada pelo usuário** (conectar banco, pedir análise de IA, atualizar cotações).
4. Não há conta de usuário no sentido SaaS. A "identidade" é a máquina + o arquivo do banco.

### Implicações de design

- **Sem login obrigatório.** Pode haver um PIN/biometria local opcional para abrir o app, mas isso protege acesso à máquina, não autentica num servidor.
- **Multi-perfil local** (futuro): mais de um arquivo de banco na mesma máquina, se o usuário quiser separar contextos. Personas resolvem isso na maioria dos casos sem precisar de múltiplos bancos.
- **Migração e versionamento** ganham peso: cada usuário carrega o próprio schema; mudanças precisam migrar bancos existentes (ver §7).

### Diagrama de fronteiras de confiança

```
   [ Máquina do usuário — zona de confiança ]
   ┌──────────────────────────────────────────┐
   │  UI (webview)                             │
   │  Rust core                                │
   │  SQLite (dados financeiros)               │
   │  Keychain (segredos BYOK)                 │
   └───────────────┬──────────────────────────┘
                   │  fronteira de confiança
                   │  (cruzada só por ação explícita)
                   ▼
   [ Serviços externos — fora da zona de confiança ]
     Pluggy · OpenAI/Anthropic · provedores de cotação
```

Tudo dentro da máquina é confiável; tudo que cruza a fronteira exige consentimento e mostra ao usuário o que está saindo.

---

## 4. Camadas e responsabilidades

A arquitetura segue uma separação clara entre **UI**, **lógica de domínio** e **core seguro**.

### 4.1 UI (webview)

- **Telas e componentes** (React + Tailwind, design system do Gestão de Contabilidade).
- **Estado de tela** (mês selecionado, filtros, modais abertos) via Zustand.
- **Cache de leitura** via TanStack Query, com chave por entidade+mês.
- **Sem segredos.** A UI nunca toca em chaves de API; ela pede ao core.

### 4.2 Lógica de domínio (TS, compartilhada)

- **Cálculos financeiros determinísticos**: sobra, estados do mês, ciclos de cartão, projeção de parcelas, tendências. Implementados como funções puras testáveis (`/core/domain`).
- **Reconciliação esperado×realizado**: matching de lançamentos com compromissos.
- **Queries via Drizzle**: leitura/escrita no SQLite.
- Essa camada roda na webview (TS), mas é **isolada da renderização** para ser testável e reutilizável.

### 4.3 Core seguro (Rust)

- **Acesso ao keychain** (ler/gravar segredos BYOK).
- **Chamadas a serviços externos** que exigem segredo (Pluggy auth, IA), para que a chave nunca transite pela camada JS quando isso for sensível.
- **Tarefas pesadas ou agendadas**: sync periódico, importação em lote, criptografia do banco.
- **Operações de sistema**: caminho do arquivo do DB, backup, abertura de links externos.

### Regra de ouro

> Segredo **nunca** sai do Rust core para a UI. A UI pede "faça X com a Pluggy"; o Rust resolve usando o segredo e devolve só o resultado.

---

## 5. O backend Rust como "servidor seguro local"

Este é o ponto de arquitetura mais sutil e mais importante do Gestão de Contabilidade, e o que torna BYOK viável sem servidor.

### O problema

Plataformas como a **Pluggy** (e a maioria dos provedores de IA) assumem que existe um **servidor seguro** para guardar segredos. A Pluggy exige `CLIENT_ID`/`CLIENT_SECRET` para gerar uma API Key, e a documentação é enfática que esse passo deve ocorrer só no servidor seguro; o cliente recebe apenas um Connect Token de escopo reduzido. Num app sem servidor, onde isso roda?

### A solução

**O backend Rust do Tauri É o servidor seguro — na máquina de cada usuário.**

```
   UI (webview)                Rust core (servidor seguro local)        Pluggy
   ────────────                ─────────────────────────────────        ──────
   "conectar banco"  ──IPC──►  lê CLIENT_ID/SECRET do keychain
                               POST /auth → API Key (em memória)  ─────► 
                               POST /connect_token → token curto  ─────► 
                     ◄──────── devolve só o connectToken
   widget Connect                                                       
   (na webview)      ─────────────────────────────────────────────────► autentica no banco
   onSuccess(itemId) ──IPC──►  guarda itemId; puxa dados com API Key ──► GET /transactions...
                               grava no SQLite local
```

- O segredo **nunca sai da máquina** e **nunca entra na camada JS** — vive no keychain e é usado só dentro do Rust.
- Como cada usuário tem as próprias chaves localmente e **não há servidor compartilhado**, o risco que a Pluggy alerta (segredo exposto num servidor que atende muita gente) **não se aplica**.
- O Rust cuida da expiração (API Key ~2h, Connect Token ~30min) renovando sob demanda.

O mesmo padrão vale para IA: a chave do usuário fica no keychain, e o Rust faz a chamada ao provedor. Detalhes nos documentos 03 (Pluggy) e 04 (IA).

---

## 6. Comunicação frontend ↔ core (IPC)

### Padrão

A UI invoca **comandos** Rust via `invoke()`. Cada comando é uma função `#[tauri::command]` tipada. O contrato é versionado e documentado.

```rust
// Exemplo conceitual (Rust)
#[tauri::command]
async fn pluggy_create_connect_token(state: State<'_, AppState>)
    -> Result<ConnectTokenDTO, AppError> {
    let secret = state.keychain.get("pluggy")?;     // segredo nunca sai daqui
    let api_key = pluggy::auth(&secret).await?;
    let token = pluggy::connect_token(&api_key).await?;
    Ok(ConnectTokenDTO { token })
}
```

```ts
// Exemplo conceitual (TS, na UI)
const { token } = await invoke<ConnectTokenDTO>("pluggy_create_connect_token");
```

### Categorias de comandos

| Categoria | Exemplos | Roda em |
|---|---|---|
| **Segredos** | `secret_set`, `secret_get_status` (status, nunca o valor) | Rust |
| **Pluggy** | `pluggy_create_connect_token`, `pluggy_sync_item`, `pluggy_list_items` | Rust |
| **IA** | `ai_complete`, `ai_test_key`, `ai_list_providers` | Rust |
| **Mercado** | `market_quote`, `market_refresh_portfolio` | Rust |
| **Sistema** | `db_path`, `backup_export`, `backup_import`, `open_external` | Rust |
| **Dados (CRUD)** | em geral via Drizzle direto na UI (não precisa de Rust) | UI |

### Por que CRUD comum não passa pelo Rust

Operações de dados sem segredo (criar uma transação, listar compromissos) usam Drizzle direto na webview via `tauri-plugin-sql`. Isso reduz boilerplate de IPC. O Rust entra só quando há **segredo, rede sensível ou trabalho pesado**.

### Tratamento de erro

- Erros de domínio retornam um `AppError` tipado, traduzido para mensagens humanas na UI (P4 — linguagem de gente).
- Erros de rede (Pluggy/IA offline) são **degradação graciosa**: o app continua funcional, mostra "não consegui atualizar agora".

---

## 7. Persistência (SQLite)

### Localização do arquivo

O banco fica no diretório de dados do app, resolvido pelo Tauri:

```
macOS:   ~/Library/Application Support/app.quibo/quibo.db
Windows: %APPDATA%\app.quibo\quibo.db
Linux:   ~/.local/share/app.quibo/quibo.db
```

### Configuração

- **WAL mode** (`journal_mode = WAL`) para concorrência leitura/escrita e durabilidade.
- **Foreign keys ON** (`PRAGMA foreign_keys = ON`) — SQLite não aplica FKs por padrão.
- **Busy timeout** configurado para evitar erros de lock momentâneo.

### Migrações

Local-first significa **migrar o banco de cada usuário** ao atualizar o app. Estratégia:

1. Tabela `schema_migrations` registra a versão atual do schema.
2. Na inicialização, o app compara a versão do binário com a do banco.
3. Migrações são **versionadas, ordenadas e idempotentes**, aplicadas em transação.
4. **Antes de migrar, backup automático** do arquivo `.db` (cópia com timestamp), para rollback.
5. Drizzle Kit gera as migrações a partir do schema TS; elas são embarcadas no app.

```
migrations/
  0001_init.sql
  0002_add_investments.sql
  0003_unify_confirmation_state.sql
  ...
```

> Regra: nunca editar uma migração já publicada. Sempre criar a próxima. O schema de um usuário que pulou versões deve chegar ao estado atual aplicando as migrações em ordem.

### Backup automático

- Cópia do `.db` antes de cada migração.
- Backup manual sob demanda (export para arquivo escolhido pelo usuário).
- Rotação simples (manter os N últimos backups automáticos).

### Detalhe de modelagem que afeta persistência

- **Dinheiro como inteiro de centavos** (`INTEGER`/`BIGINT`), nunca `REAL`/float (AD-3). Detalhado no documento 02.
- **Enums como `TEXT`** com checagem na aplicação (SQLite não tem enum nativo).
- **Datas como `TEXT` ISO-8601** ou inteiro epoch, com convenção única documentada.

---

## 8. Gestão de segredos e segurança

### Segredos (BYOK)

Chaves sensíveis — Pluggy (`CLIENT_ID`/`CLIENT_SECRET`), provedores de IA (API keys), tokens de mercado — vivem no **keychain do sistema operacional**:

- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (libsecret) / keyring

Implementado via `tauri-plugin-stronghold` (cofre criptografado) e/ou o keyring do SO. Características:

- A UI **nunca** recebe o valor do segredo; só um status ("conectado / não conectado").
- O segredo é lido pelo Rust no momento do uso e mantido em memória o mínimo necessário.
- Ao desconectar uma integração, o segredo é apagado do cofre.

### Criptografia do banco (opcional)

Para o usuário que quer proteção mesmo do arquivo em repouso:

- Opção de **SQLCipher** (SQLite criptografado) ou criptografia do arquivo, com chave derivada de uma senha mestra (Argon2) ou guardada no keychain.
- Desligado por padrão (atrito); ligável nas configurações.

### Superfície de ataque mínima

- **Sem servidor** = sem superfície de servidor.
- **CSP estrita** na webview: a UI só carrega recursos locais e de origens explicitamente permitidas (fontes do Google, CDNs de libs se necessário).
- **Allowlist do Tauri**: apenas os comandos e APIs de sistema realmente usados são habilitados.
- **Sem `eval`, sem conteúdo remoto arbitrário** na webview.

### Privacidade por padrão

- **Zero telemetria** (P7). Nenhuma chamada "home" para servidores do autor.
- O usuário vê, antes de qualquer integração, **o que será enviado e para onde**.
- Logs são locais e não contêm segredos nem, idealmente, valores financeiros brutos.

---

## 9. Integrações externas (camada de saída)

Todas as integrações seguem o mesmo padrão: **acionadas pelo usuário, mediadas pelo Rust, com segredo no keychain**.

| Integração | Doc | Direção | Sensibilidade |
|---|---|---|---|
| **Pluggy** | 03 | Entrada (importa dados bancários) | Alta (dado financeiro real) |
| **IA (OpenAI/Anthropic/local)** | 04 | Saída de resumos / entrada de texto | Média (resumos, não extrato) |
| **Dados de mercado** | 05 | Entrada (cotações) | Baixa (dado público) |

### Padrão comum

```
UI aciona ──► Rust lê segredo ──► Rust chama serviço ──► Rust grava/retorna ──► UI
                                         │
                                  degradação graciosa
                                  se offline/erro
```

### Contrato de transparência

Antes da primeira chamada de cada integração, a UI mostra um aviso claro: o que sai, para onde, com qual chave, e como desligar. Isso é parte do P7 (o dado é do usuário) e da confiança que o open-source promete.

---

## 10. Sincronização e backup

### v1: sem sync

O v1 **não sincroniza** entre dispositivos. O dado vive numa máquina. Isso é uma simplificação consciente — sync é difícil e é onde a maioria dos apps local-first gasta meses.

### Estratégias de continuidade (sem servidor próprio)

- **Export/import manual**: o usuário exporta o banco (ou um dump) e leva para outra máquina.
- **Backup criptografado** em pasta sincronizada pelo próprio usuário (iCloud Drive, Dropbox, Drive) — o Gestão de Contabilidade grava um arquivo criptografado; a nuvem é do usuário, não nossa.

### Sync futuro (se um dia)

Se sync virar requisito real, as opções que mantêm o local-first são:

- **CRDTs / sync e2e** (ex.: a abordagem de libs como automerge, ou um backend de sync genérico tipo Turso/libsql embedded replicas), com criptografia ponta-a-ponta — o servidor (se houver) nunca lê o dado.
- Decisão deliberadamente adiada para não inflar o v1 (ver 00 §11).

---

## 11. Build e distribuição

### CI/CD

O padrão bonito é **GitHub Actions + `tauri-action`**:

1. O autor cria uma tag (`git tag v1.0.0 && git push --tags`).
2. O Actions compila os três sistemas em paralelo.
3. Os artefatos são anexados automaticamente ao **GitHub Release**.

### Alvos por sistema

| SO | Artefatos |
|---|---|
| macOS | `.dmg`, `.app` (universal: Intel + Apple Silicon) |
| Windows | `.msi` e/ou `.exe` (NSIS) |
| Linux | `.AppImage`, `.deb` (e `.rpm`/Flatpak se desejado) |

### Assinatura de código (o ponto chato e honesto)

- **macOS**: o Gatekeeper reclama de apps não assinados. Assinatura exige Apple Developer ID + notarização (~US$99/ano).
- **Windows**: SmartScreen avisa sem certificado de assinatura.
- **Linux**: AppImage/Flatpak sem drama.

**Decisão para projeto pessoal não divulgado:** shippar **sem assinar** e documentar no README "clique em avançar no aviso de segurança". Custo zero. Se um dia incomodar (ou houver distribuição mais ampla), assina-se.

### Auto-update

- O **updater do Tauri** permite atualização assinada (precisa de chave de assinatura própria do updater, separada da assinatura de código).
- Fase futura. No v1, atualizar = baixar o novo binário do Releases.

---

## 12. Estrutura de pastas do repositório

```
quibo/                          # github.com/quiboapp/quibo
├── README.md                   # o que é, como rodar, "sem garantia"
├── LICENSE                     # ver doc 08 (AGPL vs MIT)
├── CONTRIBUTING.md             # postura de contribuição (mínima)
├── .github/
│   └── workflows/
│       └── release.yml         # tauri-action: build + release
├── src/                        # FRONTEND (React + TS + Tailwind)
│   ├── app/                    # roteamento, shell (sidebar/header)
│   ├── screens/                # Mês, Receitas, Cartões, Dívidas, ...
│   ├── components/             # design system + componentes de domínio
│   ├── core/
│   │   ├── domain/             # cálculos financeiros (puros, testáveis)
│   │   ├── db/                 # Drizzle: schema, queries, migrações
│   │   ├── insights/           # motor de insights (doc 06)
│   │   └── integrations/       # clientes TS de Pluggy/IA/mercado (parte não-secreta)
│   ├── styles/                 # tokens Tailwind, globals.css
│   └── lib/                    # utils (datas, dinheiro, feriados BR)
├── src-tauri/                  # CORE (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/           # #[tauri::command] por área
│   │   ├── secrets/            # keychain/stronghold
│   │   ├── pluggy/             # auth, connect token, sync
│   │   ├── ai/                 # chamadas a provedores
│   │   ├── market/             # cotações
│   │   └── db/                 # bootstrap SQLite, migrações, backup
│   ├── tauri.conf.json         # allowlist, CSP, bundling, updater
│   ├── Cargo.toml
│   └── icons/
├── drizzle/                    # migrações SQL geradas
└── docs/                       # este pacote de contexto (00..08)
```

---

## 13. Performance e resiliência

### Performance

- **Binário leve** (Tauri, sem Chromium) → inicialização rápida.
- **Índices SQLite** nas colunas de filtro mais quentes: `(userless) date`, `(month, year)`, `accountId`, `creditCardId`, `categoryId`, FKs. Detalhado no documento 02.
- **Cálculos memoizados** por mês (TanStack Query) — recalcular só quando o dado muda.
- **Paginação** em listas que crescem (lançamentos).
- **Carregamento preguiçoso** de telas pesadas (investimentos, relatórios).

### Resiliência

- **Degradação graciosa**: sem internet, o app é 100% funcional; integrações apenas não atualizam.
- **Transações de banco** para operações multi-passo (criar dívida + N parcelas; sync de Pluggy).
- **Idempotência** na importação (anti-duplicata por chave natural — ver documento 03).
- **Backup antes de migração** (ver §7).

---

## 14. Observabilidade sem telemetria

Coerente com P7, **não há telemetria remota**. Observabilidade é local:

- **Logs locais** rotacionados, sem segredos e sem valores financeiros sensíveis (ou com opção de redigir).
- **Tela de diagnóstico** opcional: status das integrações, versão do schema, caminho do banco, últimos erros — útil para o próprio usuário/dev depurar.
- **Modo verbose** acionável para depuração, desligado por padrão.

Se um dia houver desejo de entender uso de forma agregada, terá que ser **opt-in explícito e anônimo**, jamais silencioso — mas a postura padrão é não coletar nada.

---

## 15. Testes

| Nível | O que cobre | Ferramenta |
|---|---|---|
| **Unitário (domínio)** | Cálculos financeiros: sobra, ciclos de cartão, juros de atraso, projeção de parcelas, estados do mês | Vitest |
| **Unitário (Rust)** | Lógica do core, parsing de respostas Pluggy/IA | cargo test |
| **Integração (DB)** | Migrações, queries Drizzle, integridade referencial | Vitest + SQLite em memória |
| **Reconciliação** | Matching esperado×realizado com casos reais | Vitest |
| **E2E (opcional)** | Fluxos críticos na webview | Playwright / WebDriver Tauri |

Prioridade absoluta: **testes do núcleo financeiro determinístico** (P8). Um erro de cálculo destrói a confiança; esses testes são inegociáveis. A IA não é testada por exatidão numérica porque ela nunca produz número — ela só narra fatos já calculados e testados.

---

## 16. Registro de decisões (ADRs)

Decisões arquiteturais relevantes, em formato curto. O resumo cruzado está em 00 §12.

### ADR-1 — Tauri como shell desktop
**Contexto:** precisa de desktop cross-platform, leve, reaproveitando UI web, com porta de mobile.
**Decisão:** Tauri 2.
**Consequência:** core em Rust; Prisma não viaja; adotar Drizzle+SQLite. Fallback Electron documentado.

### ADR-2 — SQLite + Drizzle (não Postgres + Prisma)
**Contexto:** local-first; o banco vive na máquina do usuário.
**Decisão:** SQLite local com Drizzle ORM em TS.
**Consequência:** migrações versionadas embarcadas; FKs habilitadas manualmente; dinheiro em centavos inteiros.

### ADR-3 — Backend Rust como servidor seguro local
**Contexto:** Pluggy/IA exigem "servidor seguro" para segredos.
**Decisão:** o core Rust desempenha esse papel localmente; segredos no keychain.
**Consequência:** segredo nunca entra na UI; BYOK viável sem servidor.

### ADR-4 — Sem telemetria
**Contexto:** privacidade como fundação.
**Decisão:** nenhuma coleta remota.
**Consequência:** observabilidade só local; futura coleta apenas opt-in anônima.

### ADR-5 — Sem sync no v1
**Contexto:** sync é caro e arriscado.
**Decisão:** uma máquina; export/import e backup em nuvem do usuário.
**Consequência:** sync e2e adiado; modelo de dados pensado para tolerar sync futuro.

---

## 17. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Migração de schema quebra banco do usuário** | Alto (perda de dado) | Migrações idempotentes em transação + backup automático pré-migração |
| **Plugin SQL do Tauri imaturo para algum caso** | Médio | Avaliar libsql/Turso embedded como alternativa; manter camada de DB abstraída |
| **Curva de Rust no core** | Médio | Manter o core fino; grosso da lógica em TS; usar crates maduras |
| **Assinatura/notarização atrita instalação** | Médio | Documentar bypass; assinar só se necessário |
| **Pluggy/IA mudam contrato de API** | Médio | Clientes isolados e versionados; degradação graciosa |
| **Concorrência de escrita no SQLite** | Baixo | WAL + busy timeout + transações curtas |
| **Crescimento de dados (anos de transações)** | Baixo | Índices + paginação desde o início |

---

*Fim do documento 01. Próximo: [02 — Estrutura de Dados](./02-estrutura-de-dados.md). Anterior: [00 — Visão Geral](./00-visao-geral-produto.md).*
