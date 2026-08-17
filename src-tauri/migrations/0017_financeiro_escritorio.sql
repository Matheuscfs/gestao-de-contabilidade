-- Financeiro do escritório — Fase 11: lançamentos manuais a receber e a pagar.
--
-- O que faltava: o app sabe tudo sobre o imposto do cliente e nada sobre o
-- caixa de quem faz a contabilidade. `empresas.honorarios_cents` guardava
-- quanto se cobra, mas não havia onde registrar se aquele mês foi pago, quando
-- venceu e com quantos dias de atraso — que é a pergunta do dia a dia.
--
-- Não é o módulo de finanças pessoais: aqui não entra Open Finance nem
-- conciliação de extrato. É lançamento manual, digitado por quem cobra.

CREATE TABLE financeiro_lancamentos (
  id                TEXT PRIMARY KEY,

  -- RECEBER = honorário ou serviço cobrado do cliente.
  -- PAGAR   = despesa do escritório (aluguel, sistema, salário, imposto).
  direcao           TEXT NOT NULL CHECK (direcao IN ('RECEBER', 'PAGAR')),

  -- Cliente da cobrança. NULL nas despesas que não são de nenhuma empresa.
  -- ON DELETE SET NULL, e não CASCADE: excluir um cliente não pode apagar o
  -- histórico de quanto ele já pagou.
  empresa_id        TEXT REFERENCES empresas(id) ON DELETE SET NULL,

  -- Nome da contraparte congelado no lançamento — sobrevive à saída do cliente
  -- e ao ON DELETE SET NULL acima. Mesma postura de `folha_itens.nome`.
  contraparte       TEXT NOT NULL,

  descricao         TEXT NOT NULL,
  -- HONORARIO | SERVICO_EXTRA | REEMBOLSO | DESPESA | IMPOSTO | FOLHA | OUTRO
  categoria         TEXT NOT NULL DEFAULT 'HONORARIO',

  -- Mês a que o lançamento se refere, AAAA-MM. Separado do vencimento porque
  -- honorário de dezembro pago em janeiro continua sendo de dezembro.
  competencia       TEXT NOT NULL,

  valor_cents       INTEGER NOT NULL,
  vencimento        TEXT NOT NULL,          -- ISO YYYY-MM-DD

  -- NULL = em aberto. O status (em aberto / atrasado / pago) é **derivado**
  -- daqui com a data de hoje, nunca gravado — mesma decisão de "ATRASADA" nas
  -- obrigações e da coluna do Kanban. Estado gravado envelhece sozinho.
  data_pagamento    TEXT,
  -- Permite baixa parcial e registra o que de fato entrou, que pode divergir
  -- do cobrado (desconto, juros, retenção).
  valor_pago_cents  INTEGER NOT NULL DEFAULT 0,
  forma_pagamento   TEXT,

  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX ix_financeiro_competencia ON financeiro_lancamentos (competencia, direcao);
CREATE INDEX ix_financeiro_empresa ON financeiro_lancamentos (empresa_id, competencia);
CREATE INDEX ix_financeiro_vencimento ON financeiro_lancamentos (vencimento);

-- Chave natural da mensalidade: uma por cliente por competência. É o que faz
-- "gerar as mensalidades do mês" poder ser clicado duas vezes sem duplicar.
-- Índice parcial de propósito: serviço extra pode acontecer duas vezes no
-- mesmo mês e não deve esbarrar nesta trava.
CREATE UNIQUE INDEX uq_financeiro_mensalidade
  ON financeiro_lancamentos (empresa_id, competencia)
  WHERE categoria = 'HONORARIO' AND direcao = 'RECEBER';

-- Dia em que o honorário daquele cliente vence. Varia por contrato; o 10 é só
-- o mais comum.
ALTER TABLE empresas ADD COLUMN honorario_dia_vencimento INTEGER NOT NULL DEFAULT 10;
