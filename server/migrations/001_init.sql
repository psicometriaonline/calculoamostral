-- Estrutura inicial do site calculoamostral.com.br

CREATE TABLE IF NOT EXISTS users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_login_at       timestamptz,
  privacy_accepted_at timestamptz,
  privacy_ip          text,
  marketing_opt_in    boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  marketing_ip        text,
  ac_contact_id       text
);

-- Códigos (e links) de acesso pendentes. Só o hash é guardado.
CREATE TABLE IF NOT EXISTS login_codes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  code_hash        text NOT NULL,
  link_token_hash  text NOT NULL UNIQUE,
  privacy_accepted boolean NOT NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  expires_at       timestamptz NOT NULL,
  attempts         integer NOT NULL DEFAULT 0,
  used_at          timestamptz,
  superseded_at    timestamptz,
  ip               text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_codes_email_created ON login_codes (email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash      text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip           text,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- Histórico salvo pela pessoa (mesmo formato do app da Academy)
CREATE TABLE IF NOT EXISTS calc_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool       text NOT NULL CHECK (tool IN ('poder', 'precisao')),
  payload    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calc_history_user_tool ON calc_history (user_id, tool, created_at DESC);

-- Uso da calculadora (relatórios e tags no ActiveCampaign)
CREATE TABLE IF NOT EXISTS calc_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  tool       text NOT NULL,
  test_type  text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calc_events_created ON calc_events (created_at);

-- Fila de envios ao ActiveCampaign, com nova tentativa
CREATE TABLE IF NOT EXISTS ac_outbox (
  id              bigserial PRIMARY KEY,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  action          text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending',
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  done_at         timestamptz
);
CREATE INDEX IF NOT EXISTS ac_outbox_pending ON ac_outbox (status, next_attempt_at);

-- Cada tag de uso vai uma única vez por pessoa
CREATE TABLE IF NOT EXISTS ac_tags_sent (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     text NOT NULL,
  PRIMARY KEY (user_id, tag)
);

-- Envios de e-mail (teto diário e auditoria)
CREATE TABLE IF NOT EXISTS mail_log (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL,
  kind       text NOT NULL,
  provider_id text,
  ok         boolean NOT NULL,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_log_created ON mail_log (created_at);
