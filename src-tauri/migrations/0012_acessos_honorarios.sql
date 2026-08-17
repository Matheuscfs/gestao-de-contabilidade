-- Módulo contábil — Fase 6: acessos, honorários e ponte com o Open Finance.
--
-- Lacunas expostas pela migração da planilha do escritório (PARALEGAL):
--   1. As credenciais de portal (NFSe do município, gov.br, código do Simples)
--      são o dado mais consultado no dia a dia e não tinham onde morar.
--   2. `empresas` não guardava contato, honorário nem capital social.
--   3. `processos` não guardava protocolo nem link de acompanhamento — que é
--      exatamente do que vivem os processos de Junta e Corpo de Bombeiros.
--   4. Nada ligava uma conta bancária PJ à empresa dona dela.

-- ── Acessos a portais ─────────────────────────────────────────────────────────
-- Senhas em texto plano: o banco é local, mono-usuário e nunca sai da máquina
-- (mesma decisão de `app_settings`, que guarda as chaves de API BYOK). A UI
-- exibe mascarado; revelar é um gesto explícito.
CREATE TABLE IF NOT EXISTS empresa_acessos (
  id         TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  tipo TEXT NOT NULL CHECK(tipo IN (
         'NFSE','GOV_BR','SIMPLES_NACIONAL','ECAC','JUNTA',
         'PREFEITURA','ESTADUAL','BOMBEIROS','BANCO','OUTRO'
       )),
  -- Rótulo livre para distinguir dois acessos do mesmo tipo
  -- (ex.: "NFSe Cascavel" vs "NFSe Nova Santa Rosa").
  rotulo  TEXT,
  usuario TEXT,
  senha   TEXT,
  link    TEXT,
  notes   TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_acessos_empresa ON empresa_acessos(empresa_id, tipo);

-- Chave natural do acesso: uma empresa não tem dois acessos do mesmo tipo com o
-- mesmo rótulo. É o que torna o import da planilha reexecutável.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acesso_empresa_tipo_rotulo
  ON empresa_acessos(empresa_id, tipo, COALESCE(rotulo, ''));

-- ── Campos novos em empresas ──────────────────────────────────────────────────
ALTER TABLE empresas ADD COLUMN email    TEXT;
ALTER TABLE empresas ADD COLUMN telefone TEXT;

-- Honorário mensal cobrado pelo escritório, em centavos. 0 = sem honorário.
ALTER TABLE empresas ADD COLUMN honorarios_cents INTEGER NOT NULL DEFAULT 0;

-- Capital social / quotas, em centavos.
ALTER TABLE empresas ADD COLUMN capital_social_cents INTEGER NOT NULL DEFAULT 0;

-- Quem detém a procuração eletrônica (e-CAC) da empresa.
ALTER TABLE empresas ADD COLUMN procuracao_responsavel TEXT;

-- Empresa ativa porém sem movimento no período ("zerada" no jargão do
-- escritório): continua entregando obrigação, só que zerada. Não é status de
-- ciclo de vida — por isso é flag, e não mais um valor em `status`.
ALTER TABLE empresas ADD COLUMN sem_movimento INTEGER NOT NULL DEFAULT 0;

-- ── Processos: protocolo e acompanhamento ─────────────────────────────────────
ALTER TABLE processos ADD COLUMN protocolo TEXT;
ALTER TABLE processos ADD COLUMN link      TEXT;

-- ── Open Finance ↔ contábil ───────────────────────────────────────────────────
-- Conta/cartão sincronizado pela Pluggy passa a poder pertencer a uma empresa.
-- ON DELETE SET NULL: apagar a empresa não pode levar junto o histórico
-- bancário, que é dado do usuário.
ALTER TABLE accounts      ADD COLUMN empresa_id TEXT REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE credit_cards  ADD COLUMN empresa_id TEXT REFERENCES empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_accounts_empresa     ON accounts(empresa_id);
CREATE INDEX IF NOT EXISTS ix_credit_cards_empresa ON credit_cards(empresa_id);
