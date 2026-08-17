-- Módulo contábil — Fase 7: fluxo de etapas por obrigação e quadro Kanban.
--
-- O catálogo de obrigações (o que a lei exige, quando vence) continua em
-- código, em `src/consts/obrigacoes.ts`. O que entra aqui é outra coisa: o
-- **procedimento do escritório** para cumprir cada obrigação — gerar a guia,
-- mandar pro cliente, conferir o pró-labore. Isso é rotina de trabalho, muda
-- de escritório para escritório e o usuário precisa poder editar, então é
-- dado, não código.

-- ── Fluxo: as etapas configuradas para uma obrigação ──────────────────────────
CREATE TABLE IF NOT EXISTS obrigacao_fluxo_etapas (
  id TEXT PRIMARY KEY,
  -- Código do catálogo em código (ex.: 'DAS', 'ECD', 'EFD_ICMS_IPI').
  obrigacao_codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ordem     INTEGER NOT NULL DEFAULT 0,

  -- Etapa condicional: só é instanciada quando a empresa se encaixa.
  -- NULL = sempre. As condições são avaliadas na geração do quadro.
  condicao TEXT CHECK(condicao IN (
             'TEM_PRO_LABORE','SEM_PRO_LABORE',
             'TEM_FUNCIONARIOS','SEM_MOVIMENTO','COM_MOVIMENTO'
           )),

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_fluxo_obrigacao
  ON obrigacao_fluxo_etapas(obrigacao_codigo, ordem);

-- ── Checklist instanciado numa ocorrência (o conteúdo do card) ────────────────
CREATE TABLE IF NOT EXISTS obrigacao_ocorrencia_etapas (
  id TEXT PRIMARY KEY,
  ocorrencia_id TEXT NOT NULL
    REFERENCES obrigacoes_ocorrencias(id) ON DELETE CASCADE,

  -- Etapa do fluxo que originou esta (NULL = avulsa, criada à mão no card).
  -- Sem FK: apagar a etapa do fluxo não pode apagar o histórico já cumprido.
  fluxo_etapa_id TEXT,

  descricao TEXT NOT NULL,
  ordem     INTEGER NOT NULL DEFAULT 0,
  concluida INTEGER NOT NULL DEFAULT 0,
  concluida_em TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ocorrencia_etapas
  ON obrigacao_ocorrencia_etapas(ocorrencia_id, ordem);

-- Chave natural que torna a geração do quadro reexecutável: uma etapa do fluxo
-- só existe uma vez por ocorrência. Etapas avulsas (fluxo_etapa_id NULL) ficam
-- de fora do índice e podem repetir livremente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ocorrencia_fluxo_etapa
  ON obrigacao_ocorrencia_etapas(ocorrencia_id, fluxo_etapa_id)
  WHERE fluxo_etapa_id IS NOT NULL;
