-- Módulo contábil — Fase 8: folha de pagamento com histórico.
--
-- Motivação direta da auditoria fiscal: o Fator R era calculado como
-- "(pró-labores + salários de hoje) × 12". Isso ignora reajuste, admissão e
-- demissão no meio do período — e, sobretudo, não é o que a LC 123 art. 18 §24
-- manda, que é somar o que foi **efetivamente pago nos 12 meses anteriores**.
--
-- A folha mensal fechada passa a ser esse histórico. `funcionarios.salario_cents`
-- e `empresa_socios.pro_labore_cents` continuam existindo como "valor vigente",
-- mas só para pré-preencher a competência; a verdade do período é o que está
-- gravado aqui.

-- ── Parâmetros de encargo da empresa ─────────────────────────────────────────
-- Só fazem sentido quando a CPP é recolhida por fora do DAS (Anexo IV,
-- Presumido e Real). No Simples dos demais anexos tudo está embutido no DAS.

-- RAT em centésimos de % (100 = 1%, 200 = 2%, 300 = 3%), conforme o grau de
-- risco do CNAE preponderante.
ALTER TABLE empresas ADD COLUMN rat_centesimos INTEGER NOT NULL DEFAULT 100;

-- FAP em decimilésimos (10000 = 1,0000). Vai de 0,5000 a 2,0000 e multiplica o
-- RAT. Guarda as 4 casas porque é assim que o fator é publicado.
ALTER TABLE empresas ADD COLUMN fap_decimilesimos INTEGER NOT NULL DEFAULT 10000;

-- Terceiros / Sistema S em centésimos de % (580 = 5,8%), conforme o FPAS.
-- Devido apenas por Presumido e Real: o Simples é isento, inclusive no Anexo IV.
ALTER TABLE empresas ADD COLUMN terceiros_centesimos INTEGER NOT NULL DEFAULT 580;

-- ── Competência de folha ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folha_competencias (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  mes        INTEGER NOT NULL,
  ano        INTEGER NOT NULL,

  -- ABERTA ainda aceita edição e recálculo; FECHADA vira histórico e é o que
  -- alimenta o Fator R. Sem essa distinção, um rascunho de folha entraria no
  -- cálculo do anexo e mudaria o imposto sem querer.
  status     TEXT NOT NULL DEFAULT 'ABERTA' CHECK(status IN ('ABERTA','FECHADA')),
  fechada_em TEXT,

  -- Cópia dos parâmetros da empresa no momento do fechamento: RAT e FAP mudam
  -- de ano para ano, e refazer a conta de uma competência antiga com os
  -- parâmetros de hoje daria um número que nunca foi recolhido.
  rat_centesimos       INTEGER NOT NULL DEFAULT 100,
  fap_decimilesimos    INTEGER NOT NULL DEFAULT 10000,
  terceiros_centesimos INTEGER NOT NULL DEFAULT 0,

  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_folha_competencia
  ON folha_competencias(empresa_id, mes, ano);
CREATE INDEX IF NOT EXISTS ix_folha_empresa
  ON folha_competencias(empresa_id, ano, mes);

-- ── Item da folha: uma pessoa numa competência ───────────────────────────────
CREATE TABLE IF NOT EXISTS folha_itens (
  id       TEXT PRIMARY KEY,
  folha_id TEXT NOT NULL REFERENCES folha_competencias(id) ON DELETE CASCADE,

  -- SALARIO = vínculo celetista; PRO_LABORE = retirada de sócio.
  tipo TEXT NOT NULL CHECK(tipo IN ('SALARIO','PRO_LABORE')),

  -- Origem do item. ON DELETE SET NULL de propósito: apagar um funcionário do
  -- cadastro não pode reescrever a folha de meses já fechados.
  funcionario_id TEXT REFERENCES funcionarios(id) ON DELETE SET NULL,
  socio_id       TEXT REFERENCES socios(id)       ON DELETE SET NULL,

  -- Nome congelado no fechamento, pelo mesmo motivo.
  nome TEXT NOT NULL,

  -- ── Proventos ─────────────────────────────────────────────────────────────
  base_cents              INTEGER NOT NULL DEFAULT 0, -- salário ou retirada do mês
  decimo_terceiro_cents   INTEGER NOT NULL DEFAULT 0,
  ferias_cents            INTEGER NOT NULL DEFAULT 0,
  terco_ferias_cents      INTEGER NOT NULL DEFAULT 0,
  outros_proventos_cents  INTEGER NOT NULL DEFAULT 0,

  -- ── Descontos do trabalhador ──────────────────────────────────────────────
  inss_cents             INTEGER NOT NULL DEFAULT 0,
  irrf_cents             INTEGER NOT NULL DEFAULT 0,
  outros_descontos_cents INTEGER NOT NULL DEFAULT 0,
  dependentes            INTEGER NOT NULL DEFAULT 0,

  -- ── Encargos do empregador (não descontados da pessoa) ───────────────────
  fgts_cents      INTEGER NOT NULL DEFAULT 0,
  cpp_cents       INTEGER NOT NULL DEFAULT 0,
  rat_cents       INTEGER NOT NULL DEFAULT 0,
  terceiros_cents INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_folha_itens ON folha_itens(folha_id);

-- Uma pessoa aparece uma vez por competência. Índices parciais separados
-- porque um item tem funcionário OU sócio, nunca os dois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_folha_item_funcionario
  ON folha_itens(folha_id, funcionario_id) WHERE funcionario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_folha_item_socio
  ON folha_itens(folha_id, socio_id) WHERE socio_id IS NOT NULL;
