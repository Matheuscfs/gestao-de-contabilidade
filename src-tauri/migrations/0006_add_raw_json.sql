-- Armazena o payload JSON cru, exatamente como vem da Pluggy, em cada entidade
-- sincronizada. NULL para registros manuais ou ainda não sincronizados.
-- Usado para inspeção/cópia no extrato e como base do fluxo de migração.
ALTER TABLE transactions ADD COLUMN raw TEXT;
ALTER TABLE accounts ADD COLUMN raw TEXT;
ALTER TABLE credit_cards ADD COLUMN raw TEXT;
