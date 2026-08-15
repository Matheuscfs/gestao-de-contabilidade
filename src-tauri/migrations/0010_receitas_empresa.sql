-- Módulo contábil — Fase 3: receitas mensais por empresa.
--
-- Alimentam o RBT12 (Simples), as bases do Lucro Presumido e o
-- acompanhamento do limite do MEI. As regras de cálculo vivem em código
-- (`src/consts/tributos.ts`).

CREATE TABLE IF NOT EXISTS empresa_receitas (
  id            TEXT PRIMARY KEY,
  empresa_id    TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  mes           INTEGER NOT NULL,   -- 1–12
  ano           INTEGER NOT NULL,
  receita_cents INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_empresa_receita
  ON empresa_receitas(empresa_id, mes, ano);

-- Atividade para as presunções do Lucro Presumido:
-- COMERCIO_INDUSTRIA (8%/12%) | TRANSPORTE_PASSAGEIROS (16%/12%) | SERVICOS (32%/32%)
ALTER TABLE empresas ADD COLUMN atividade_presumido TEXT;
