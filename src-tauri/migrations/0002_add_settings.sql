-- Configurações persistentes do app (key-value).
-- Usada para flags como onboarding_done que precisam ser apagadas com o banco.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
