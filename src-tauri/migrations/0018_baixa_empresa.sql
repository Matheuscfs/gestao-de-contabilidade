-- Baixa de empresa — Fase 12.
--
-- `status = 'BAIXADA'` já existia, mas era só um rótulo: o motor de obrigações
-- continuava gerando DAS e eSocial para empresa encerrada, e o financeiro
-- continuaria cobrando honorário de quem não é mais cliente. Faltava a data —
-- sem ela não dá para saber até que competência a empresa ainda devia entregar
-- alguma coisa.
--
-- A data é o que separa "não gerar mais nada" de "apagar o passado". Empresa
-- baixada em março ainda deve as obrigações de janeiro a março, e elas têm que
-- continuar na agenda; o que não pode existir é a competência de abril.

-- ISO YYYY-MM-DD. NULL enquanto a empresa não foi baixada.
ALTER TABLE empresas ADD COLUMN data_baixa TEXT;
