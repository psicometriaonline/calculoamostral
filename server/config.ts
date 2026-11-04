// Configuração lida das variáveis de ambiente (definidas no Coolify).
const env = process.env;

function bool(v: string | undefined, def: boolean) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'sim'].includes(v.toLowerCase());
}
function int(v: string | undefined, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export const config = {
  port: int(env.PORT, 3000),
  appUrl: (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  databaseUrl: env.DATABASE_URL || '',
  sessionSecret: env.SESSION_SECRET || '',
  isProduction: env.NODE_ENV === 'production',

  // E-mail (Resend)
  resendApiKey: env.RESEND_API_KEY || '',
  mailFrom: env.MAIL_FROM || 'Psicometria Online <codigo@acesso.calculoamostral.com.br>',
  mailReplyTo: env.MAIL_REPLY_TO || '',
  mailPerSecond: int(env.MAIL_PER_SECOND, 2),
  mailDailyCap: int(env.MAIL_DAILY_CAP, 3000),

  // Anti-robô (Cloudflare Turnstile)
  turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
  turnstileSecret: env.TURNSTILE_SECRET || '',

  // ActiveCampaign (só base de contatos; nenhuma lista, nenhum envio)
  acApiUrl: (env.AC_API_URL || '').replace(/\/+$/, ''),
  acApiKey: env.AC_API_KEY || '',
  acEnabled: bool(env.AC_ENABLED, true),
  acTagSignup: env.AC_TAG_SIGNUP || '[POA][CALC] - Cadastro',
  acTagUsedPower: env.AC_TAG_USED_POWER || '[POA][CALC] - Usou poder',
  acTagUsedPrecision: env.AC_TAG_USED_PRECISION || '[POA][CALC] - Usou precisão',
  acTagSaved: env.AC_TAG_SAVED || '[POA][CALC] - Salvou cálculo',
  acMarketingFieldId: env.AC_MARKETING_FIELD_ID || '',

  // Login
  codeTtlMinutes: int(env.CODE_TTL_MINUTES, 10),
  codeMaxAttempts: int(env.CODE_MAX_ATTEMPTS, 5),
  resendCooldownSeconds: int(env.RESEND_COOLDOWN_SECONDS, 60),
  codesPerEmailPerHour: int(env.CODES_PER_EMAIL_PER_HOUR, 5),
  codesPerIpPerHour: int(env.CODES_PER_IP_PER_HOUR, 10),
  verifyPerIpPerHour: int(env.VERIFY_PER_IP_PER_HOUR, 30),
  sessionDays: int(env.SESSION_DAYS, 30),
  calcPerMinute: int(env.CALC_PER_MINUTE, 120),

  // Testes: expõe o último código enviado (NUNCA em produção)
  exposeCodesForTests: env.EXPOSE_CODES_FOR_TESTS === '1' && env.NODE_ENV !== 'production',
};

export function assertConfig() {
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.sessionSecret || config.sessionSecret.length < 32) missing.push('SESSION_SECRET (mínimo 32 caracteres)');
  if (config.isProduction) {
    if (!config.resendApiKey) missing.push('RESEND_API_KEY');
    if (!config.appUrl.startsWith('https://')) missing.push('APP_URL (https://…)');
  }
  if (missing.length) {
    throw new Error(`Configuração ausente: ${missing.join(', ')}`);
  }
}
