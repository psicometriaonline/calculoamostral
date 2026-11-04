import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config';

/** HMAC-SHA256 com o segredo do servidor: códigos, links e sessões nunca são guardados em claro. */
export function hmac(value: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
export function newCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
export function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  // Validação prática: local@domínio.tld, sem espaços
  if (!/^[^\s@"(),:;<>[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(e)) return null;
  return e;
}

// Domínios de e-mail descartável mais comuns (lista curta e ampliável)
const DISPOSABLE = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com',
  'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'dispostable.com',
  'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'tempail.com',
  'mintemail.com', 'mailnesia.com', 'moakt.com', 'burnermail.io', 'tmpmail.org', 'tmail.ws',
]);
export function isDisposable(email: string): boolean {
  const domain = email.split('@')[1] ?? '';
  return DISPOSABLE.has(domain);
}

/** Janela deslizante simples em memória (uma instância). Retorna segundos até liberar, ou 0. */
export class SlidingLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {
    setInterval(() => this.sweep(), Math.min(windowMs, 60_000)).unref();
  }
  hit(key: string): number {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return Math.ceil((this.windowMs - (now - arr[0])) / 1000);
    }
    arr.push(now);
    this.hits.set(key, arr);
    return 0;
  }
  reset() { this.hits.clear(); }
  private sweep() {
    const now = Date.now();
    for (const [k, arr] of this.hits) {
      const kept = arr.filter((t) => now - t < this.windowMs);
      if (kept.length) this.hits.set(k, kept); else this.hits.delete(k);
    }
  }
}

export function clientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

/** Bloqueia POST/DELETE vindos de outra origem (defesa extra contra CSRF, além do SameSite=Lax). */
export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (origin) {
    const allowed = new URL(config.appUrl).origin;
    if (origin !== allowed && !(!config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
      return res.status(403).json({ error: 'Origem não permitida' });
    }
  }
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
}
