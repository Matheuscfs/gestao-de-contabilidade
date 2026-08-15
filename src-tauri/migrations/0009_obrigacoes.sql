-- Módulo contábil — Fase 2: agenda de obrigações acessórias.
--
-- O catálogo de obrigações (regras por regime, dia de vencimento, condições)
-- vive em código (`src/consts/obrigacoes.ts`), como as tabelas de INSS/IRRF em
-- `src/consts/clt.ts` — o banco guarda só as ocorrências geradas e as
-- desativações por empresa.

-- ── Ocorrências de obrigações ─────────────────────────────────────────────────
-- Uma linha por (empresa, obrigação, competência). "ATRASADA" não é status
-- gravado: é derivada (vencimento < hoje e status PENDENTE).
CREATE TABLE IF NOT EXISTS obrigacoes_ocorrencias (
  id               TEXT PRIMARY KEY,
  empresa_id       TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- código do catálogo (ex.: 'DAS', 'PGDAS_D', 'ESOCIAL_FOLHA')
  obrigacao_codigo TEXT NOT NULL,

  -- Competência de apuração: mensal = (mes, ano); trimestral = último mês do
  -- trimestre; anual = (12, ano de apuração).
  competencia_mes INTEGER NOT NULL,
  competencia_ano INTEGER NOT NULL,

  -- ISO YYYY-MM-DD, já ajustado para dia útil conforme a regra do catálogo
  vencimento TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','ENTREGUE','PAGA','DISPENSADA')),
  -- valor da guia em centavos, quando houver
  valor_cents  INTEGER,
  concluida_em TEXT,
  notes        TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_obrigacao_ocorrencia
  ON obrigacoes_ocorrencias(empresa_id, obrigacao_codigo, competencia_mes, competencia_ano);
CREATE INDEX IF NOT EXISTS ix_obrigacoes_empresa
  ON obrigacoes_ocorrencias(empresa_id, vencimento);

-- ── Obrigações desativadas por empresa ────────────────────────────────────────
-- Regras do catálogo que não se aplicam a uma empresa específica (ex.: ISS em
-- quem não presta serviço, EFD ICMS/IPI em quem não é contribuinte de ICMS).
CREATE TABLE IF NOT EXISTS obrigacoes_desativadas (
  empresa_id       TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  obrigacao_codigo TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  PRIMARY KEY (empresa_id, obrigacao_codigo)
);
