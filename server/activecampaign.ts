// Integração com o ActiveCampaign: SOMENTE base de contatos.
// O site nunca inscreve em lista, nunca adiciona a automação e nunca envia e-mail.
// Ações vão para a fila ac_outbox e são processadas com nova tentativa.
import { config } from './config';
import { q, one } from './db';

type Action =
  | { action: 'sync'; payload: { marketing?: boolean; marketingAt?: string } }
  | { action: 'tag'; payload: { tag: string } };

export function acActive() {
  return config.acEnabled && !!config.acApiUrl && !!config.acApiKey;
}

/** Enfileira uma ação para o contato da pessoa. */
export async function enqueue(userId: string, a: Action) {
  await q(`INSERT INTO ac_outbox (user_id, action, payload) VALUES ($1, $2, $3)`, [userId, a.action, JSON.stringify(a.payload)]);
}

/** Enfileira uma tag de uso uma única vez por pessoa. */
export async function enqueueTagOnce(userId: string, tag: string) {
  const r = await q(`INSERT INTO ac_tags_sent (user_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING tag`, [userId, tag]);
  if (r.length) await enqueue(userId, { action: 'tag', payload: { tag } });
}

async function ac(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${config.acApiUrl}/api/3${path}`, {
    method,
    headers: { 'Api-Token': config.acApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err: any = new Error(`ActiveCampaign ${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const tagIdCache = new Map<string, string>();
async function tagId(name: string): Promise<string> {
  const cached = tagIdCache.get(name);
  if (cached) return cached;
  const found = await ac('GET', `/tags?search=${encodeURIComponent(name)}&limit=100`);
  const exact = (found?.tags ?? []).find((t: any) => t.tag === name);
  let id: string;
  if (exact) {
    id = String(exact.id);
  } else {
    const created = await ac('POST', '/tags', { tag: { tag: name, tagType: 'contact', description: 'Criada pelo site calculoamostral.com.br' } });
    id = String(created.tag.id);
  }
  tagIdCache.set(name, id);
  return id;
}

async function ensureContact(userId: string, extraFields?: Array<{ field: string; value: string }>): Promise<string> {
  const u = await one<{ email: string; ac_contact_id: string | null }>(`SELECT email, ac_contact_id FROM users WHERE id = $1`, [userId]);
  if (!u) throw new Error('usuário não existe mais');
  if (u.ac_contact_id && !extraFields?.length) return u.ac_contact_id;
  const body: any = { contact: { email: u.email } };
  if (extraFields?.length) body.contact.fieldValues = extraFields;
  const r = await ac('POST', '/contact/sync', body);
  const id = String(r.contact.id);
  if (id !== u.ac_contact_id) await q(`UPDATE users SET ac_contact_id = $2 WHERE id = $1`, [userId, id]);
  return id;
}

async function process(row: { id: string; user_id: string; action: string; payload: any }) {
  if (row.action === 'sync') {
    const fields: Array<{ field: string; value: string }> = [];
    if (row.payload?.marketing && config.acMarketingFieldId) {
      fields.push({ field: config.acMarketingFieldId, value: `Sim (${String(row.payload.marketingAt ?? '').slice(0, 10)})` });
    }
    const contactId = await ensureContact(row.user_id, fields);
    await ac('POST', '/contactTags', { contactTag: { contact: contactId, tag: await tagId(config.acTagSignup) } });
  } else if (row.action === 'tag') {
    const contactId = await ensureContact(row.user_id);
    await ac('POST', '/contactTags', { contactTag: { contact: contactId, tag: await tagId(row.payload.tag) } });
  } else {
    throw new Error(`ação desconhecida: ${row.action}`);
  }
}

let running = false;
export async function processOutboxOnce(limit = 10): Promise<number> {
  if (running || !acActive()) return 0;
  running = true;
  let n = 0;
  try {
    const rows = await q(
      `UPDATE ac_outbox SET status = 'working'
         WHERE id IN (SELECT id FROM ac_outbox WHERE status = 'pending' AND next_attempt_at <= now()
                      ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
       RETURNING id, user_id, action, payload, attempts`,
      [limit],
    );
    for (const row of rows) {
      try {
        await process(row);
        await q(`UPDATE ac_outbox SET status = 'done', done_at = now(), last_error = NULL WHERE id = $1`, [row.id]);
        n++;
      } catch (e: any) {
        const attempts = Number(row.attempts) + 1;
        const giveUp = attempts >= 8 || (e?.status && e.status >= 400 && e.status < 500 && e.status !== 429);
        const delayMin = Math.min(60, 2 ** attempts);
        await q(
          `UPDATE ac_outbox SET status = $2, attempts = $3, last_error = $4,
                  next_attempt_at = now() + ($5 || ' minutes')::interval WHERE id = $1`,
          [row.id, giveUp ? 'failed' : 'pending', attempts, String(e?.message ?? e).slice(0, 1000), String(delayMin)],
        );
        console.error('[ac] falha ao processar', row.action, String(e?.message ?? e));
      }
      await new Promise((r) => setTimeout(r, 250)); // ActiveCampaign: ~5 req/s por conta
    }
  } finally {
    running = false;
  }
  return n;
}

export function startOutboxWorker() {
  if (!acActive()) {
    console.log('[ac] ActiveCampaign desligado (AC_API_URL/AC_API_KEY ausentes ou AC_ENABLED=false); a fila acumula e será enviada quando ligar.');
  }
  // Recupera itens presos em 'working' após reinício
  q(`UPDATE ac_outbox SET status = 'pending' WHERE status = 'working'`).catch(() => {});
  const t = setInterval(() => { processOutboxOnce().catch((e) => console.error('[ac] worker', e)); }, 5_000);
  t.unref();
}
