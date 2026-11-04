// Login só com e-mail: código de 6 dígitos (ou link) enviado pelo Resend.
import type { Express, Request, Response, NextFunction } from 'express';
import { config } from './config';
import { q, one, pool } from './db';
import { hmac, safeEqualHex, newCode, newToken, normalizeEmail, isDisposable, SlidingLimiter, clientIp } from './security';
import { sendLoginCode, sentToday, lastCodeForTests } from './mail';
import { verifyTurnstile } from './turnstile';
import { enqueue } from './activecampaign';

export const COOKIE = 'ca_sess';

export const limiters = {
  requestPerIp: new SlidingLimiter(config.codesPerIpPerHour, 60 * 60_000),
  verifyPerIp: new SlidingLimiter(config.verifyPerIpPerHour, 60 * 60_000),
};

export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: config.appUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

/** Carrega a sessão (se houver) e renova a validade no máximo uma vez por hora. */
export async function loadSession(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = readCookie(req, COOKIE);
  if (!token || token.length > 200) return next();
  try {
    const row = await one<{ user_id: string; email: string; last_seen_at: Date }>(
      `SELECT s.user_id, u.email, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id_hash = $1 AND s.expires_at > now()`,
      [hmac(token)],
    );
    if (row) {
      req.user = { id: row.user_id, email: row.email };
      if (Date.now() - new Date(row.last_seen_at).getTime() > 60 * 60_000) {
        await q(
          `UPDATE sessions SET last_seen_at = now(), expires_at = now() + ($2 || ' days')::interval WHERE id_hash = $1`,
          [hmac(token), String(config.sessionDays)],
        );
        setSessionCookie(res, token);
      }
    }
  } catch (e) {
    console.error('[auth] falha ao ler sessão', e);
  }
  next();
}

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente com o seu e-mail.' });
  next();
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

async function createSession(req: Request, res: Response, userId: string) {
  const token = newToken(32);
  await q(
    `INSERT INTO sessions (id_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hmac(token), userId, String(config.sessionDays), clientIp(req), (req.get('user-agent') ?? '').slice(0, 300)],
  );
  setSessionCookie(res, token);
}

/** Conclui o login a partir de um código válido: cria/atualiza a pessoa, a sessão e a fila do ActiveCampaign. */
async function completeLogin(req: Request, res: Response, codeRow: any) {
  const ip = clientIp(req);
  const client = await pool.connect();
  let userId: string;
  let isNew = false;
  let marketingNow = false;
  try {
    await client.query('BEGIN');
    const used = await client.query(`UPDATE login_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id`, [codeRow.id]);
    if (!used.rowCount) { await client.query('ROLLBACK'); return false; }
    const existing = (await client.query(`SELECT id, marketing_opt_in FROM users WHERE email = $1 FOR UPDATE`, [codeRow.email])).rows[0];
    if (existing) {
      userId = existing.id;
      marketingNow = codeRow.marketing_opt_in && !existing.marketing_opt_in;
      await client.query(
        `UPDATE users SET last_login_at = now(),
                privacy_accepted_at = COALESCE(privacy_accepted_at, now()), privacy_ip = COALESCE(privacy_ip, $2),
                marketing_opt_in = marketing_opt_in OR $3,
                marketing_opt_in_at = CASE WHEN $3 AND NOT marketing_opt_in THEN now() ELSE marketing_opt_in_at END,
                marketing_ip = CASE WHEN $3 AND NOT marketing_opt_in THEN $2 ELSE marketing_ip END
          WHERE id = $1`,
        [userId, ip, !!codeRow.marketing_opt_in],
      );
    } else {
      isNew = true;
      marketingNow = !!codeRow.marketing_opt_in;
      const r = await client.query(
        `INSERT INTO users (email, last_login_at, privacy_accepted_at, privacy_ip, marketing_opt_in, marketing_opt_in_at, marketing_ip)
         VALUES ($1, now(), now(), $2, $3, CASE WHEN $3 THEN now() END, CASE WHEN $3 THEN $2 END) RETURNING id`,
        [codeRow.email, ip, marketingNow],
      );
      userId = r.rows[0].id;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await createSession(req, res, userId);
  if (isNew || marketingNow) {
    await enqueue(userId, { action: 'sync', payload: { marketing: marketingNow, marketingAt: new Date().toISOString() } });
  }
  return true;
}

export function registerAuthRoutes(app: Express) {
  app.post('/api/auth/request-code', async (req: Request, res: Response) => {
    const ip = clientIp(req);
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Digite um e-mail válido.' });
    if (req.body?.privacy !== true) return res.status(400).json({ error: 'Para continuar, aceite a Política de privacidade.' });
    if (isDisposable(email)) return res.status(400).json({ error: 'Use um e-mail permanente, como o institucional ou o pessoal.' });

    const ipWait = limiters.requestPerIp.hit(ip);
    if (ipWait) return res.status(429).json({ error: 'Muitos pedidos de código a partir desta rede. Tente de novo mais tarde.', retryAfter: ipWait });

    if (!(await verifyTurnstile(req.body?.turnstileToken, ip))) {
      return res.status(400).json({ error: 'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.' });
    }

    const recent = await q<{ created_at: Date }>(
      `SELECT created_at FROM login_codes WHERE email = $1 AND created_at > now() - interval '1 hour' ORDER BY created_at DESC`,
      [email],
    );
    if (recent.length) {
      const since = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
      if (since < config.resendCooldownSeconds) {
        const wait = Math.ceil(config.resendCooldownSeconds - since);
        return res.status(429).json({ error: `Aguarde ${wait} segundos para pedir um novo código.`, retryAfter: wait });
      }
    }
    if (recent.length >= config.codesPerEmailPerHour) {
      return res.status(429).json({ error: 'Você pediu muitos códigos na última hora. Tente de novo mais tarde.', retryAfter: 3600 });
    }
    if ((await sentToday()) >= config.mailDailyCap) {
      console.error('[auth] teto diário de e-mails atingido');
      return res.status(503).json({ error: 'O envio de códigos está temporariamente pausado. Tente de novo em algumas horas.' });
    }

    const code = newCode();
    const linkToken = newToken(32);
    await q(`UPDATE login_codes SET superseded_at = now() WHERE email = $1 AND used_at IS NULL AND superseded_at IS NULL`, [email]);
    await q(
      `INSERT INTO login_codes (email, code_hash, link_token_hash, privacy_accepted, marketing_opt_in, expires_at, ip)
       VALUES ($1, $2, $3, true, $4, now() + ($5 || ' minutes')::interval, $6)`,
      [email, hmac(`${email}:${code}`), hmac(linkToken), req.body?.marketing === true, String(config.codeTtlMinutes), ip],
    );
    const link = `${config.appUrl}/api/auth/link?t=${linkToken}`;
    const sent = await sendLoginCode(email, code, link);
    if (!sent.ok) {
      return res.status(502).json({ error: 'Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos.' });
    }
    res.json({ ok: true, sentTo: maskEmail(email), resendAfter: config.resendCooldownSeconds });
  });

  app.post('/api/auth/verify-code', async (req: Request, res: Response) => {
    const ip = clientIp(req);
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\D/g, '') : '';
    if (!email || code.length !== 6) return res.status(400).json({ error: 'Digite os 6 números do código.' });
    const wait = limiters.verifyPerIp.hit(ip);
    if (wait) return res.status(429).json({ error: 'Muitas tentativas. Tente de novo mais tarde.', retryAfter: wait });

    const row = await one<any>(
      `SELECT * FROM login_codes WHERE email = $1 AND used_at IS NULL AND superseded_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Este código expirou. Peça um novo.', expired: true });
    }
    if (row.attempts >= config.codeMaxAttempts) {
      return res.status(400).json({ error: 'Muitas tentativas com este código. Peça um novo.', expired: true });
    }
    if (!safeEqualHex(row.code_hash, hmac(`${email}:${code}`))) {
      const r = await one<{ attempts: number }>(`UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`, [row.id]);
      const left = Math.max(0, config.codeMaxAttempts - (r?.attempts ?? config.codeMaxAttempts));
      return res.status(400).json({
        error: left ? `Código incorreto. Você ainda tem ${left} ${left === 1 ? 'tentativa' : 'tentativas'}.` : 'Código incorreto. Peça um novo.',
        expired: left === 0,
      });
    }
    if (!(await completeLogin(req, res, row))) return res.status(400).json({ error: 'Este código já foi usado. Peça um novo.', expired: true });
    res.json({ ok: true, redirect: '/calculadora/poder-amostral' });
  });

  app.get('/api/auth/link', async (req: Request, res: Response) => {
    const t = typeof req.query.t === 'string' ? req.query.t : '';
    if (!t || t.length > 100) return res.redirect(302, '/?acesso=link-invalido');
    const wait = limiters.verifyPerIp.hit(clientIp(req));
    if (wait) return res.redirect(302, '/?acesso=muitas-tentativas');
    const row = await one<any>(
      `SELECT * FROM login_codes WHERE link_token_hash = $1 AND used_at IS NULL AND superseded_at IS NULL`,
      [hmac(t)],
    );
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.redirect(302, '/?acesso=link-expirado');
    if (!(await completeLogin(req, res, row))) return res.redirect(302, '/?acesso=link-expirado');
    res.redirect(302, '/calculadora/poder-amostral');
  });

  app.get('/api/auth/me', (req: AuthedRequest, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.user) return res.json({ authenticated: false });
    res.json({ authenticated: true, email: req.user.email });
  });

  app.post('/api/auth/logout', async (req: AuthedRequest, res: Response) => {
    const token = readCookie(req, COOKIE);
    if (token) await q(`DELETE FROM sessions WHERE id_hash = $1`, [hmac(token)]);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  if (config.exposeCodesForTests) {
    app.get('/api/test/last-code', (req, res) => res.json(lastCodeForTests(String(req.query.email ?? ''))));
  }
}

/** Limpeza periódica de códigos e sessões vencidos. */
export function startAuthJanitor() {
  const t = setInterval(() => {
    q(`DELETE FROM login_codes WHERE created_at < now() - interval '1 day'`).catch(() => {});
    q(`DELETE FROM sessions WHERE expires_at < now()`).catch(() => {});
  }, 60 * 60_000);
  t.unref();
}
