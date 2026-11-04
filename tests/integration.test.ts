// Teste de integração: Postgres real (embedded-postgres), app completo em processo,
// Resend e ActiveCampaign simulados. Roda com: npx tsx tests/integration.test.ts
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const PG_PORT = 54329;
const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'pgtest-')), 'data');
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'calc', password: 'calc', port: PG_PORT, persistent: false });

// ---- ActiveCampaign falso: registra cada chamada ----
const acCalls: Array<{ method: string; url: string; body: any }> = [];
const tags: Array<{ id: string; tag: string }> = [{ id: '1147', tag: 'usou-calculadora-amostral' }];
const acServer = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null;
    acCalls.push({ method: req.method!, url: req.url!, body });
    assert.equal(req.headers['api-token'], 'ac-test-key');
    res.setHeader('Content-Type', 'application/json');
    if (req.url!.startsWith('/api/3/contact/sync')) return res.end(JSON.stringify({ contact: { id: '9001', email: body.contact.email } }));
    if (req.url!.startsWith('/api/3/tags?')) {
      const s = decodeURIComponent(new URL(req.url!, 'http://x').searchParams.get('search') ?? '');
      return res.end(JSON.stringify({ tags: tags.filter((t) => t.tag.includes(s)) }));
    }
    if (req.url === '/api/3/tags' && req.method === 'POST') {
      const t = { id: String(2000 + tags.length), tag: body.tag.tag };
      tags.push(t);
      return res.end(JSON.stringify({ tag: t }));
    }
    if (req.url === '/api/3/contactTags') return res.end(JSON.stringify({ contactTag: { id: '1' } }));
    res.statusCode = 404;
    res.end('{}');
  });
});

// ---- Resend falso: intercepta fetch para api.resend.com ----
const sentMails: any[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://api.resend.com/')) {
    assert.equal(init.headers.Authorization, 'Bearer re_test');
    sentMails.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `mail_${sentMails.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(input, init);
}) as typeof fetch;

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FALHOU  ${name}`);
    throw e;
  }
}

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('calc');
  await new Promise<void>((r) => acServer.listen(0, r));
  const acPort = (acServer.address() as any).port;

  Object.assign(process.env, {
    DATABASE_URL: `postgres://calc:calc@localhost:${PG_PORT}/calc`,
    SESSION_SECRET: 'x'.repeat(48),
    APP_URL: 'http://localhost:4555',
    EXPOSE_CODES_FOR_TESTS: '1',
    RESEND_API_KEY: 're_test',
    MAIL_FROM: 'Psicometria Online <codigo@acesso.calculoamostral.com.br>',
    AC_API_URL: `http://127.0.0.1:${acPort}`,
    AC_API_KEY: 'ac-test-key',
    AC_MARKETING_FIELD_ID: '77',
    CODES_PER_IP_PER_HOUR: '1000',
    VERIFY_PER_IP_PER_HOUR: '1000',
  });
  const { migrate, pool, q } = await import('../server/db');
  const { createApp } = await import('../server/index');
  const { processOutboxOnce } = await import('../server/activecampaign');
  await migrate();
  await migrate(); // idempotente
  const app = createApp();
  const server = app.listen(4555);
  const base = 'http://localhost:4555';

  const jar = new Map<string, string>(); // cookie por "pessoa"
  async function call(who: string, method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const c = jar.get(who);
    if (c) h.Cookie = c;
    const res = await realFetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const sc = res.headers.get('set-cookie');
    if (sc) {
      const v = sc.split(';')[0];
      if (v.endsWith('=')) jar.delete(who); else jar.set(who, v);
    }
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, data, headers: res.headers };
  }
  const lastCode = async (email: string) => (await call('_', 'GET', `/api/test/last-code?email=${encodeURIComponent(email)}`)).data;
  const resetCooldown = (email: string) => q(`UPDATE login_codes SET created_at = created_at - interval '2 minutes' WHERE email = $1`, [email]);

  console.log('Integração');

  await test('healthz e página principal', async () => {
    assert.equal((await call('a', 'GET', '/healthz')).data.ok, true);
    const home = await call('a', 'GET', '/');
    assert.equal(home.status, 200);
    assert.match(home.data, /Quantos participantes a sua pesquisa precisa\?/);
    assert.match(home.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.equal((await call('a', 'GET', '/privacidade')).status, 200);
    assert.equal((await call('a', 'GET', '/nao-existe')).status, 404);
  });

  await test('sem sessão: calculadora redireciona e API recusa', async () => {
    const r = await call('a', 'GET', '/calculadora/poder-amostral');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/?entrar=1');
    assert.equal((await call('a', 'POST', '/api/power-analysis/calculate', { testType: 'one-sample', effectSize: 0.5, alpha: 0.05, tails: 'two', power: 0.8 })).status, 401);
    assert.equal((await call('a', 'GET', '/api/power-analysis/history')).status, 401);
    assert.equal((await call('a', 'GET', '/api/auth/me')).data.authenticated, false);
  });

  await test('validações do pedido de código', async () => {
    assert.equal((await call('a', 'POST', '/api/auth/request-code', { email: 'invalido', privacy: true })).status, 400);
    const semAceite = await call('a', 'POST', '/api/auth/request-code', { email: 'ana@exemplo.com.br', privacy: false });
    assert.equal(semAceite.status, 400);
    assert.match(semAceite.data.error, /Política de privacidade/);
    assert.equal((await call('a', 'POST', '/api/auth/request-code', { email: 'x@mailinator.com', privacy: true })).status, 400);
    const outraOrigem = await call('a', 'POST', '/api/auth/request-code', { email: 'ana@exemplo.com.br', privacy: true }, { Origin: 'https://evil.example' });
    assert.equal(outraOrigem.status, 403);
  });

  await test('pedido de código envia e-mail pelo Resend com remetente e conteúdo certos', async () => {
    const r = await call('a', 'POST', '/api/auth/request-code', { email: '  Ana@Exemplo.com.BR ', privacy: true, marketing: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.sentTo, 'a***@exemplo.com.br');
    const m = sentMails.at(-1);
    assert.deepEqual(m.to, ['ana@exemplo.com.br']);
    assert.equal(m.from, 'Psicometria Online <codigo@acesso.calculoamostral.com.br>');
    const { code, link } = await lastCode('ana@exemplo.com.br');
    assert.match(code, /^\d{6}$/);
    assert.equal(m.subject, `Seu código de acesso: ${code}`);
    assert.ok(m.text.includes(code) && m.html.includes(code) && m.text.includes(link));
    const rows = await q(`SELECT code_hash FROM login_codes WHERE email = 'ana@exemplo.com.br'`);
    assert.ok(!rows[0].code_hash.includes(code)); // só hash
  });

  await test('reenvio antes de 60 s é recusado', async () => {
    const r = await call('a', 'POST', '/api/auth/request-code', { email: 'ana@exemplo.com.br', privacy: true });
    assert.equal(r.status, 429);
    assert.ok(r.data.retryAfter > 0 && r.data.retryAfter <= 60);
  });

  await test('código errado conta tentativas; código certo entra', async () => {
    const { code } = await lastCode('ana@exemplo.com.br');
    const wrong = code === '000000' ? '111111' : '000000';
    const w = await call('a', 'POST', '/api/auth/verify-code', { email: 'ana@exemplo.com.br', code: wrong });
    assert.equal(w.status, 400);
    assert.match(w.data.error, /4 tentativas/);
    const ok = await call('a', 'POST', '/api/auth/verify-code', { email: 'ana@exemplo.com.br', code: code.slice(0, 3) + ' ' + code.slice(3) });
    assert.equal(ok.status, 200);
    assert.ok(jar.get('a')?.startsWith('ca_sess='));
    const me = await call('a', 'GET', '/api/auth/me');
    assert.deepEqual(me.data, { authenticated: true, email: 'ana@exemplo.com.br' });
    const reuse = await call('b', 'POST', '/api/auth/verify-code', { email: 'ana@exemplo.com.br', code });
    assert.equal(reuse.status, 400);
    const u = await q(`SELECT privacy_accepted_at, marketing_opt_in, marketing_opt_in_at FROM users WHERE email = 'ana@exemplo.com.br'`);
    assert.ok(u[0].privacy_accepted_at && u[0].marketing_opt_in && u[0].marketing_opt_in_at);
  });

  await test('com sessão: calculadora abre e calcula como o G*Power', async () => {
    const r = await call('a', 'GET', '/calculadora');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/calculadora/poder-amostral');
    const page = await call('a', 'GET', '/calculadora/precisao-amostral');
    assert.equal(page.status, 200);
    assert.match(page.data, /id="root"/);
    const mw = await call('a', 'POST', '/api/power-analysis/calculate', { testType: 'mann-whitney', effectSize: 0.5, alpha: 0.05, tails: 'two', power: 0.8 });
    assert.equal(mw.status, 200);
    assert.equal(mw.data.requiredN1, 67);
    assert.equal(mw.data.requiredN2, 67);
    assert.ok(Math.abs(mw.data.df - 125.9606) < 5e-5);
    assert.ok(Math.abs(mw.data.criticalValue - 1.9789766) < 5e-8);
    assert.ok(Math.abs(mw.data.actualPower - 0.8013372) < 5e-8);
    const rm = await call('a', 'POST', '/api/power-analysis/calculate', { testType: 'anova-repeated', effectSize: 0.1, alpha: 0.05, tails: 'two', power: 0.95, numMeasurements: 3, correlationBetweenMeasures: 0.5, sphericityCorrection: 1 });
    assert.equal(rm.data.requiredN, 259);
    const curve = await call('a', 'POST', '/api/power-analysis/curve-consistent', { testType: 'mann-whitney', mode: 'calculate-n', input: { effectSize: 0.5, alpha: 0.05, tails: 'two', power: 0.8 }, result: mw.data });
    assert.equal(curve.status, 200);
    assert.equal(curve.data.refX, 67);
    assert.ok(Math.abs(curve.data.refPower - mw.data.actualPower) < 1e-12);
    const prec = await call('a', 'POST', '/api/sample-size-precision/calculate', { procedureType: 'prevalence-cochran', prevalenceP: 0.5, marginD: 0.05, confidenceLevel: 95, precisionMode: 'absolute' });
    assert.equal(prec.data.n0, 385);
    const bad = await call('a', 'POST', '/api/sample-size-precision/calculate', { procedureType: 'xyz', prevalenceP: 0.5, marginD: 0.05, confidenceLevel: 95 });
    assert.equal(bad.status, 400);
    const ev = await q(`SELECT tool, test_type FROM calc_events ORDER BY id`);
    assert.deepEqual(ev.map((e) => e.tool), ['poder', 'poder', 'precisao']);
  });

  await test('histórico por pessoa: salvar, listar, isolar e excluir', async () => {
    const save = await call('a', 'POST', '/api/power-analysis/save', { testType: 'mann-whitney', inputParameters: { effectSize: 0.5 }, result: { requiredN1: 67 } });
    assert.equal(save.status, 201);
    assert.match(save.data.id, /^[0-9a-f-]{36}$/);
    const list = await call('a', 'GET', '/api/power-analysis/history');
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].result.requiredN1, 67);
    assert.equal((await call('a', 'GET', '/api/sample-size-precision/history')).data.length, 0);
    // Segunda pessoa, entrando pelo link do e-mail
    await call('b', 'POST', '/api/auth/request-code', { email: 'bruno@exemplo.com', privacy: true });
    const { link } = await lastCode('bruno@exemplo.com');
    const viaLink = await call('b', 'GET', new URL(link).pathname + new URL(link).search);
    assert.equal(viaLink.status, 302);
    assert.equal(viaLink.headers.get('location'), '/calculadora/poder-amostral');
    assert.equal((await call('b', 'GET', '/api/auth/me')).data.email, 'bruno@exemplo.com');
    assert.equal((await call('b', 'GET', '/api/power-analysis/history')).data.length, 0);
    assert.equal((await call('b', 'DELETE', `/api/power-analysis/${save.data.id}`)).status, 404);
    const reuseLink = await call('c', 'GET', new URL(link).pathname + new URL(link).search);
    assert.equal(reuseLink.headers.get('location'), '/?acesso=link-expirado');
    assert.equal((await call('a', 'DELETE', `/api/power-analysis/${save.data.id}`)).status, 200);
    assert.equal((await call('a', 'GET', '/api/power-analysis/history')).data.length, 0);
  });

  await test('código expira e bloqueia após 5 erros; novo código invalida o anterior', async () => {
    const email = 'carla@exemplo.org';
    await call('c', 'POST', '/api/auth/request-code', { email, privacy: true });
    const first = (await lastCode(email)).code;
    await resetCooldown(email);
    await call('c', 'POST', '/api/auth/request-code', { email, privacy: true });
    const second = (await lastCode(email)).code;
    if (first !== second) {
      assert.equal((await call('c', 'POST', '/api/auth/verify-code', { email, code: first })).status, 400);
    }
    const wrong = second === '999999' ? '888888' : '999999';
    for (let i = 0; i < 4; i++) await call('c', 'POST', '/api/auth/verify-code', { email, code: wrong });
    const locked = await call('c', 'POST', '/api/auth/verify-code', { email, code: second });
    assert.equal(locked.status, 400);
    assert.equal(locked.data.expired, true);
    await resetCooldown(email);
    await call('c', 'POST', '/api/auth/request-code', { email, privacy: true });
    await q(`UPDATE login_codes SET expires_at = now() - interval '1 second' WHERE email = $1 AND used_at IS NULL AND superseded_at IS NULL`, [email]);
    const exp = await call('c', 'POST', '/api/auth/verify-code', { email, code: (await lastCode(email)).code });
    assert.match(exp.data.error, /expirou/);
  });

  await test('limite de 5 códigos por e-mail por hora', async () => {
    const email = 'dani@exemplo.org';
    let last = 0;
    for (let i = 0; i < 6; i++) {
      await resetCooldown(email);
      last = (await call('d', 'POST', '/api/auth/request-code', { email, privacy: true })).status;
    }
    assert.equal(last, 429);
  });

  await test('ActiveCampaign: só contato + tag; nenhuma lista, automação ou envio', async () => {
    const pending = await q(`SELECT action, payload FROM ac_outbox ORDER BY id`);
    assert.ok(pending.some((r) => r.action === 'sync' && r.payload.marketing === true));
    await processOutboxOnce(50);
    await processOutboxOnce(50);
    const left = await q(`SELECT status, last_error FROM ac_outbox WHERE status <> 'done'`);
    assert.deepEqual(left, []);
    const urls = acCalls.map((c) => `${c.method} ${c.url.split('?')[0]}`);
    assert.ok(urls.every((u) => /^(POST \/api\/3\/contact\/sync|GET \/api\/3\/tags|POST \/api\/3\/tags|POST \/api\/3\/contactTags)$/.test(u)), urls.join('\n'));
    assert.ok(!urls.some((u) => /contactLists|contactAutomations|campaigns|messages/.test(u)));
    const anaSync = acCalls.find((c) => c.url.startsWith('/api/3/contact/sync') && c.body.contact.email === 'ana@exemplo.com.br' && c.body.contact.fieldValues);
    assert.equal(anaSync?.body.contact.fieldValues[0].field, '77');
    const created = acCalls.filter((c) => c.url === '/api/3/tags' && c.method === 'POST').map((c) => c.body.tag.tag);
    assert.ok(created.includes('[POA][CALC] - Cadastro'));
    assert.ok(created.includes('[POA][CALC] - Usou poder'));
    assert.ok(!created.includes('usou-calculadora-amostral'));
    const sent = await q(`SELECT tag FROM ac_tags_sent WHERE user_id = (SELECT id FROM users WHERE email = 'ana@exemplo.com.br') ORDER BY tag`);
    assert.deepEqual(sent.map((s) => s.tag), ['[POA][CALC] - Salvou cálculo', '[POA][CALC] - Usou poder', '[POA][CALC] - Usou precisão']);
  });

  await test('sair encerra a sessão no servidor', async () => {
    const cookie = jar.get('a')!;
    assert.equal((await call('a', 'POST', '/api/auth/logout')).status, 200);
    assert.equal((await call('a', 'GET', '/api/auth/me')).data.authenticated, false);
    const old = await realFetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
    assert.equal((await old.json()).authenticated, false);
  });

  await test('corpo grande demais e JSON inválido', async () => {
    jar.delete('z');
    const big = await realFetch(base + '/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(200_000) }) });
    assert.equal(big.status, 413);
    const bad = await realFetch(base + '/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
  });

  console.log(`\n${passed} testes de integração passaram`);
  server.close();
  acServer.close();
  await pool.end();
  await pg.stop();
}

main().catch(async (e) => {
  console.error(e);
  try { await pg.stop(); } catch { /* ignore */ }
  process.exit(1);
});
