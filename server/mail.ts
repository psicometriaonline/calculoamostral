// Envio do e-mail de acesso pelo Resend.
// A conta do Resend é compartilhada com o site principal (Replit): o limite de
// 10 requisições/s vale para a conta inteira, por isso este app envia no
// máximo MAIL_PER_SECOND (padrão 2) por segundo, em fila.
import { config } from './config';
import { q } from './db';

const lastCodes = new Map<string, { code: string; link: string }>(); // só para testes

let chain: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const gap = 1000 / Math.max(1, config.mailPerSecond);
  const run = chain.then(async () => {
    const wait = lastSentAt + gap - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSentAt = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

export async function sentToday(): Promise<number> {
  const rows = await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM mail_log WHERE created_at > now() - interval '24 hours'`,
  );
  return Number(rows[0]?.n ?? 0);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function renderLoginEmail(code: string, link: string, minutes: number) {
  const subject = `Seu código de acesso: ${code}`;
  const text = [
    'Psicometria Online · Calculadora Amostral',
    '',
    `Seu código de acesso é: ${code}`,
    '',
    `Ele vale por ${minutes} minutos. Você também pode entrar direto por este link:`,
    link,
    '',
    'Se não foi você que pediu, ignore este e-mail.',
  ].join('\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F2F7F9;font-family:Arial,Helvetica,sans-serif;color:#174552">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F7F9;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #D6E3E8;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:bold;color:#174552">Psicometria Online · Calculadora Amostral</td></tr>
<tr><td style="padding:8px 32px 0;font-size:16px;line-height:1.5;color:#3D5A66">Use este código para entrar:</td></tr>
<tr><td style="padding:16px 32px"><div style="font-family:'Courier New',monospace;font-size:36px;letter-spacing:8px;font-weight:bold;color:#174552;background:#E3F3F8;border-radius:8px;padding:16px;text-align:center">${escapeHtml(code)}</div></td></tr>
<tr><td style="padding:0 32px;font-size:14px;line-height:1.5;color:#3D5A66">O código vale por ${minutes} minutos. Se preferir, entre com um clique:</td></tr>
<tr><td style="padding:16px 32px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#00749A;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">Entrar na calculadora</a></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:13px;line-height:1.5;color:#4E6874">Se não foi você que pediu, ignore este e-mail. Ninguém consegue entrar sem este código.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function sendLoginCode(email: string, code: string, link: string): Promise<{ ok: boolean; error?: string }> {
  const { subject, text, html } = renderLoginEmail(code, link, config.codeTtlMinutes);
  if (config.exposeCodesForTests) lastCodes.set(email, { code, link });

  if (!config.resendApiKey) {
    // Desenvolvimento: sem chave, o código vai para o log do servidor.
    console.log(`[mail] (sem RESEND_API_KEY) código para ${email}: ${code} · ${link}`);
    await q(`INSERT INTO mail_log (email, kind, ok) VALUES ($1, 'login', true)`, [email]);
    return { ok: true };
  }

  return throttled(async () => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: config.mailFrom,
          to: [email],
          subject,
          html,
          text,
          ...(config.mailReplyTo ? { reply_to: config.mailReplyTo } : {}),
          tags: [{ name: 'app', value: 'calculoamostral' }, { name: 'kind', value: 'login' }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = `${res.status} ${body?.message ?? body?.name ?? ''}`.trim();
        await q(`INSERT INTO mail_log (email, kind, ok, error) VALUES ($1, 'login', false, $2)`, [email, error]);
        console.error('[mail] falha no Resend:', error);
        return { ok: false, error };
      }
      await q(`INSERT INTO mail_log (email, kind, provider_id, ok) VALUES ($1, 'login', $2, true)`, [email, body?.id ?? null]);
      return { ok: true };
    } catch (e: any) {
      await q(`INSERT INTO mail_log (email, kind, ok, error) VALUES ($1, 'login', false, $2)`, [email, String(e?.message ?? e)]);
      console.error('[mail] erro de rede no Resend:', e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}

/** Somente para testes automatizados (EXPOSE_CODES_FOR_TESTS=1 fora de produção). */
export function lastCodeForTests(email: string) {
  return config.exposeCodesForTests ? lastCodes.get(email) ?? null : null;
}
