-- Modalidade da fonte de renda (receita): PJ | CLT | OUTRO.
-- Usada para estimar descontos (INSS/IRRF) quando CLT. NULL = não informada.
ALTER TABLE transactions ADD COLUMN income_modality TEXT;
