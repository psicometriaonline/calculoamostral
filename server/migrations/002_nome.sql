-- Nome informado no formulário de acesso (11/11/2026)
ALTER TABLE users       ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE login_codes ADD COLUMN IF NOT EXISTS name text;
