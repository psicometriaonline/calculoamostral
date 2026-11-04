// Verificação do anti-robô (Cloudflare Turnstile) no servidor.
import { config } from './config';

export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  if (!config.turnstileSecret) {
    // Sem chave configurada (desenvolvimento): não bloqueia, mas avisa em produção.
    if (config.isProduction) console.warn('[turnstile] TURNSTILE_SECRET ausente: anti-robô desligado');
    return true;
  }
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const data: any = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error('[turnstile] falha na verificação:', e);
    return false;
  }
}
