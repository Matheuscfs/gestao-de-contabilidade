-- Módulo contábil — Fase 4: processos por empresa.
--
-- Um processo é um trabalho administrativo com prazo e checklist de etapas
-- (abertura, alteração contratual, parcelamento, certidões, defesa, baixa…).
-- "Atrasado" não é status gravado: é derivado (prazo < hoje e não concluído).

CREATE TABLE IF NOT EXISTS processos (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK(tipo IN (
               'ABERTURA','ALTERACAO','PARCELAMENTO','CERTIDAO',
               'DEFESA','REGULARIZACAO','BAIXA','OUTRO'
             )),
  descricao  TEXT,
  prazo      TEXT,   -- ISO YYYY-MM-DD, opcional
  status     TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK(status IN (
               'EM_ANDAMENTO','AGUARDANDO','CONCLUIDO','CANCELADO'
             )),
  concluido_em TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_processos_empresa ON processos(empresa_id, status);

-- ── Etapas (checklist) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processo_etapas (
  id           TEXT PRIMARY KEY,
  processo_id  TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  descricao    TEXT NOT NULL,
  ordem        INTEGER NOT NULL DEFAULT 0,
  concluida    INTEGER NOT NULL DEFAULT 0,
  concluida_em TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_etapas_processo ON processo_etapas(processo_id, ordem);
