-- Marca a persona principal (o próprio dono do app) — criada no onboarding,
-- sincronizada com nome/foto do perfil e protegida contra exclusão.
ALTER TABLE personas ADD COLUMN is_self INTEGER NOT NULL DEFAULT 0;
