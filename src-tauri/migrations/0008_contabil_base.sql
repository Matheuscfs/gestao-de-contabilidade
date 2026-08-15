-- Módulo contábil — Fase 1: empresas, sócios e funcionários.
--
-- Tabelas novas e independentes do financeiro pessoal: nenhuma tabela
-- existente é alterada. O domínio contábil usa nomes em português por ser
-- intraduzível (pró-labore, anexo do Simples, CNAE etc.).

-- ── Empresas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id                  TEXT PRIMARY KEY,
  razao_social        TEXT NOT NULL,
  nome_fantasia       TEXT,
  cnpj                TEXT NOT NULL,   -- só dígitos (14)
  inscricao_estadual  TEXT,
  inscricao_municipal TEXT,
  data_abertura       TEXT,            -- ISO YYYY-MM-DD
  cnae_principal      TEXT,
  cnaes_secundarios   TEXT,            -- JSON array serializado: string[]
  uf                  TEXT,
  municipio           TEXT,

  -- Regime tributário vigente
  regime_tributario TEXT NOT NULL CHECK(regime_tributario IN ('MEI','SIMPLES','PRESUMIDO','REAL')),
  -- Anexo do Simples Nacional (I–V); NULL fora do Simples
  anexo_simples     TEXT CHECK(anexo_simples IN ('I','II','III','IV','V')),
  -- Reforma tributária (IBS/CBS): opção da empresa na transição; NULL = não definida
  regime_ibs_cbs    TEXT CHECK(regime_ibs_cbs IN ('REGULAR','SIMPLES_DAS','SIMPLES_HIBRIDO')),

  status           TEXT NOT NULL DEFAULT 'ATIVA' CHECK(status IN ('ATIVA','INATIVA','BAIXADA')),
  -- Flag declarativa para o motor de obrigações (Fase 2); o cadastro
  -- individual em `funcionarios` é opcional e liga esta flag automaticamente.
  tem_funcionarios INTEGER NOT NULL DEFAULT 0,

  notes      TEXT,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_cnpj ON empresas(cnpj)
  WHERE archived = 0;

-- ── Sócios ────────────────────────────────────────────────────────────────────
-- Cadastro global: o mesmo sócio pode participar de várias empresas.
CREATE TABLE IF NOT EXISTS socios (
  id         TEXT PRIMARY KEY,
  nome       TEXT NOT NULL,
  cpf        TEXT,               -- só dígitos (11)
  email      TEXT,
  telefone   TEXT,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_socio_cpf ON socios(cpf)
  WHERE cpf IS NOT NULL AND archived = 0;

-- ── Vínculo societário (N:N empresa ↔ sócio) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa_socios (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  socio_id   TEXT NOT NULL REFERENCES socios(id)   ON DELETE CASCADE,

  -- Participação societária em centésimos de % (5000 = 50,00%)
  participacao_centesimos INTEGER NOT NULL DEFAULT 0,
  is_administrador        INTEGER NOT NULL DEFAULT 0,
  -- Pró-labore mensal em centavos; 0 = não retira pró-labore
  pro_labore_cents        INTEGER NOT NULL DEFAULT 0,
  recebe_distribuicao     INTEGER NOT NULL DEFAULT 1,
  data_entrada            TEXT,   -- ISO YYYY-MM-DD
  data_saida              TEXT,   -- preenchida = sócio retirado da sociedade

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_socio ON empresa_socios(empresa_id, socio_id);
CREATE INDEX IF NOT EXISTS ix_empresa_socios_empresa ON empresa_socios(empresa_id);
CREATE INDEX IF NOT EXISTS ix_empresa_socios_socio   ON empresa_socios(socio_id);

-- ── Funcionários ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funcionarios (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf           TEXT,            -- só dígitos (11)
  cargo         TEXT,
  vinculo       TEXT NOT NULL DEFAULT 'CLT' CHECK(vinculo IN ('CLT','ESTAGIO','APRENDIZ','TEMPORARIO','OUTRO')),
  salario_cents INTEGER NOT NULL DEFAULT 0,
  data_admissao TEXT,            -- ISO YYYY-MM-DD
  data_demissao TEXT,            -- preenchida = desligado

  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_funcionarios_empresa ON funcionarios(empresa_id);
