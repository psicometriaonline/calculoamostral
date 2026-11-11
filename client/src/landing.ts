// Página principal: fluxo de acesso por e-mail → código.
type ApiResult = { ok: boolean; status: number; data: any };

async function api(method: string, url: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Sem conexão. Verifique a internet e tente de novo.' } };
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const formEmail = $<HTMLFormElement>('form-email');
const formCodigo = $<HTMLFormElement>('form-codigo');
const painelLogado = $<HTMLDivElement>('painel-logado');
const inputEmail = $<HTMLInputElement>('a-email');
const inputNome = $<HTMLInputElement>('a-nome');
const inputCodigo = $<HTMLInputElement>('a-codigo');
const btnEnviar = $<HTMLButtonElement>('btn-enviar');
const btnEntrar = $<HTMLButtonElement>('btn-entrar');
const btnReenviar = $<HTMLButtonElement>('btn-reenviar');
const msgEmail = $<HTMLParagraphElement>('msg-email');
const msgCodigo = $<HTMLParagraphElement>('msg-codigo');
const turnstileBox = $<HTMLDivElement>('turnstile');

let currentEmail = '';
let currentNome = '';
let resendTimer: number | undefined;

function show(el: HTMLElement, text: string, kind: 'erro' | 'ok' = 'erro') {
  el.textContent = text;
  el.className = `msg ${kind}`;
  el.hidden = false;
}
function hide(el: HTMLElement) { el.hidden = true; el.textContent = ''; }

// ---- Anti-robô (Cloudflare Turnstile), só quando há chave configurada ----
declare global { interface Window { turnstile?: any } }
const siteKey = turnstileBox?.dataset.sitekey ?? '';
const hasTurnstile = !!siteKey && !siteKey.startsWith('__');
let widgetId: string | undefined;
let tokenWaiters: Array<(t: string) => void> = [];
let lastToken = '';

function loadTurnstile() {
  if (!hasTurnstile) { turnstileBox.hidden = true; return; }
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  s.onload = () => {
    widgetId = window.turnstile.render(turnstileBox, {
      sitekey: siteKey,
      language: 'pt-br',
      size: 'flexible',
      appearance: 'interaction-only',
      callback: (t: string) => { lastToken = t; tokenWaiters.forEach((w) => w(t)); tokenWaiters = []; },
      'expired-callback': () => { lastToken = ''; },
      'error-callback': () => { lastToken = ''; },
    });
  };
  document.head.appendChild(s);
}
function takeToken(): Promise<string> {
  if (!hasTurnstile) return Promise.resolve('');
  if (lastToken) { const t = lastToken; lastToken = ''; return Promise.resolve(t); }
  return new Promise((resolve) => {
    tokenWaiters.push((t) => { lastToken = ''; resolve(t); });
    setTimeout(() => resolve(''), 15_000);
  });
}
function resetTurnstile() {
  if (hasTurnstile && window.turnstile && widgetId !== undefined) { lastToken = ''; window.turnstile.reset(widgetId); }
}

// ---- Passos ----
function stepEmail() {
  formCodigo.hidden = true;
  painelLogado.hidden = true;
  formEmail.hidden = false;
  turnstileBox.hidden = !hasTurnstile;
  (inputNome.value.trim() ? inputEmail : inputNome).focus();
}
function stepCodigo(sentTo: string, resendAfter: number) {
  formEmail.hidden = true;
  formCodigo.hidden = false;
  $('email-destino').textContent = sentTo || currentEmail;
  inputCodigo.value = '';
  hide(msgCodigo);
  startResendCountdown(resendAfter);
  inputCodigo.focus();
}
function startResendCountdown(seconds: number) {
  window.clearInterval(resendTimer);
  let left = Math.max(0, Math.round(seconds));
  const tick = () => {
    if (left <= 0) {
      btnReenviar.disabled = false;
      btnReenviar.textContent = 'Reenviar código';
      window.clearInterval(resendTimer);
      return;
    }
    btnReenviar.disabled = true;
    btnReenviar.textContent = `Reenviar código em ${left}s`;
    left--;
  };
  tick();
  resendTimer = window.setInterval(tick, 1000);
}

async function requestCode(fromResend = false) {
  const msg = fromResend ? msgCodigo : msgEmail;
  hide(msg);
  const email = inputEmail.value.trim();
  const nome = inputNome.value.trim().replace(/\s+/g, ' ');
  if (!fromResend) {
    inputNome.setAttribute('aria-invalid', 'false');
    inputEmail.setAttribute('aria-invalid', 'false');
    if (nome.length < 2) {
      inputNome.setAttribute('aria-invalid', 'true');
      show(msg, 'Digite o seu nome.');
      inputNome.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      inputEmail.setAttribute('aria-invalid', 'true');
      show(msg, 'Digite um e-mail válido.');
      inputEmail.focus();
      return;
    }
  }
  const btn = fromResend ? btnReenviar : btnEnviar;
  const label = btn.textContent;
  btn.disabled = true;
  if (!fromResend) btn.textContent = 'Enviando…';
  const turnstileToken = await takeToken();
  const r = await api('POST', '/api/auth/request-code', {
    email: fromResend ? currentEmail : email,
    name: fromResend ? currentNome : nome,
    privacy: true,
    turnstileToken,
  });
  resetTurnstile();
  btn.disabled = false;
  if (!fromResend) btn.textContent = label;
  if (!r.ok) {
    show(msg, r.data?.error ?? 'Não foi possível enviar o código. Tente de novo.');
    if (fromResend && r.data?.retryAfter) startResendCountdown(r.data.retryAfter);
    return;
  }
  if (!fromResend) { currentEmail = email; currentNome = nome; }
  if (fromResend) {
    startResendCountdown(r.data.resendAfter ?? 60);
    inputCodigo.value = '';
    show(msgCodigo, 'Enviamos um novo código. O anterior deixou de valer.', 'ok');
    inputCodigo.focus();
  } else {
    stepCodigo(r.data.sentTo, r.data.resendAfter ?? 60);
  }
}

async function verifyCode() {
  hide(msgCodigo);
  const code = inputCodigo.value.replace(/\D/g, '');
  if (code.length !== 6) {
    show(msgCodigo, 'Digite os 6 números do código.');
    inputCodigo.focus();
    return;
  }
  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando…';
  const r = await api('POST', '/api/auth/verify-code', { email: currentEmail, code });
  if (r.ok) {
    window.location.assign(r.data.redirect || '/calculadora/poder-amostral');
    return;
  }
  btnEntrar.disabled = false;
  btnEntrar.textContent = 'Entrar';
  show(msgCodigo, r.data?.error ?? 'Não foi possível entrar. Tente de novo.');
  if (r.data?.expired) { btnReenviar.disabled = false; btnReenviar.textContent = 'Reenviar código'; window.clearInterval(resendTimer); }
  inputCodigo.select();
}

formEmail.addEventListener('submit', (e) => { e.preventDefault(); void requestCode(false); });
formCodigo.addEventListener('submit', (e) => { e.preventDefault(); void verifyCode(); });
btnReenviar.addEventListener('click', () => void requestCode(true));
$('btn-trocar').addEventListener('click', () => { window.clearInterval(resendTimer); stepEmail(); });
inputCodigo.addEventListener('input', () => {
  const digits = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
  if (inputCodigo.value !== digits) inputCodigo.value = digits;
  if (digits.length === 6 && !btnEntrar.disabled) void verifyCode();
});

// Formulário do fim da página: leva o e-mail para o formulário principal
$<HTMLFormElement>('form-cta').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $<HTMLInputElement>('a-email2').value.trim();
  const n = $<HTMLInputElement>('a-nome2').value.trim();
  if (!formEmail.hidden) {
    if (v) inputEmail.value = v;
    if (n) inputNome.value = n;
  }
  document.getElementById('entrar')?.scrollIntoView({ block: 'start' });
  if (formEmail.hidden) return;
  // O formulário de cima valida e mostra o erro, se faltar algo
  void requestCode(false);
});

// Imagem de exemplo: não abre nada; mostra um aviso curto
const exemploImg = document.getElementById('exemplo-img');
const avisoImg = document.getElementById('aviso-img');
let avisoTimer: number | undefined;
exemploImg?.addEventListener('click', () => {
  if (!avisoImg) return;
  const lado = window.matchMedia('(min-width: 1000px)').matches ? 'ao lado' : 'acima';
  avisoImg.textContent = painelLogado.hidden
    ? `Cadastre-se no formulário ${lado} para receber o seu acesso por e-mail`
    : `Você já tem acesso: clique em "Abrir a calculadora" no quadro ${lado}`;
  avisoImg.hidden = false;
  window.clearTimeout(avisoTimer);
  avisoTimer = window.setTimeout(() => { avisoImg.hidden = true; }, 4000);
});

$('btn-sair').addEventListener('click', async () => {
  await api('POST', '/api/auth/logout');
  window.location.replace('/');
});

// ---- Estado inicial ----
const params = new URLSearchParams(window.location.search);
const avisos: Record<string, string> = {
  'link-expirado': 'Este link de acesso expirou ou já foi usado. Peça um novo código.',
  'link-invalido': 'Link de acesso inválido. Peça um novo código.',
  'muitas-tentativas': 'Muitas tentativas. Aguarde um pouco e peça um novo código.',
};
const aviso = params.get('acesso');
if (aviso && avisos[aviso]) show(msgEmail, avisos[aviso]);
if (params.get('sessao') === 'expirada') show(msgEmail, 'Sua sessão expirou. Entre de novo com o seu e-mail.', 'ok');
if (params.has('acesso') || params.has('sessao') || params.has('entrar')) {
  history.replaceState(null, '', window.location.pathname + window.location.hash);
  document.getElementById('entrar')?.scrollIntoView({ block: 'start' });
}

loadTurnstile();
api('GET', '/api/auth/me').then((r) => {
  if (r.ok && r.data?.authenticated) {
    formEmail.hidden = true;
    formCodigo.hidden = true;
    turnstileBox.hidden = true;
    painelLogado.hidden = false;
    $('email-logado').textContent = r.data.email;
    const nav = $<HTMLAnchorElement>('nav-entrar');
    nav.textContent = 'Abrir calculadora';
    nav.href = '/calculadora/poder-amostral';
  }
});
