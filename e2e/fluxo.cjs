const { chromium } = require('playwright');
const B = 'http://localhost:4600';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_CONNECTION|net::/.test(m.text())) errs.push(m.text()); });
  const log = (...a) => console.log(...a);
  await p.goto(B + '/');
  await p.screenshot({ path: 'e2e/01-home.png', fullPage: false });
  // validação: sem aceite
  await p.fill('#a-email', 'pesquisadora2@universidade.br');
  await p.click('#btn-enviar');
  log('sem aceite:', await p.textContent('#msg-email'));
  await p.check('#a-priv');
  await p.check('#a-mkt');
  await p.click('#btn-enviar');
  await p.waitForSelector('#form-codigo:not([hidden])', { timeout: 5000 });
  log('destino:', await p.textContent('#email-destino'), '| reenviar:', await p.textContent('#btn-reenviar'));
  await p.screenshot({ path: 'e2e/02-codigo.png' });
  const { code } = await (await p.request.get(B + '/api/test/last-code?email=pesquisadora2@universidade.br')).json();
  // código errado
  await p.fill('#a-codigo', code === '123456' ? '654321' : '123456');
  await p.waitForSelector('#msg-codigo:not([hidden])');
  log('código errado:', await p.textContent('#msg-codigo'));
  // código certo (autoenvio ao completar 6 dígitos)
  await p.fill('#a-codigo', '');
  await p.type('#a-codigo', code);
  await p.waitForURL('**/calculadora/poder-amostral', { timeout: 8000 });
  await p.waitForSelector('[data-testid=button-calculate]');
  log('calculadora aberta; conta:', await p.textContent('[data-testid=account-email]'));
  // Mann-Whitney
  await p.click('[data-testid=select-test]'); await p.waitForTimeout(200);
  await p.locator('[data-radix-popper-content-wrapper] button', { hasText: 'Mann-Whitney' }).first().click();
  await p.fill('[data-testid=input-effect-size]', '0,5');
  await p.click('[data-testid=button-calculate]');
  await p.waitForSelector('[data-testid=result-required-n1]', { timeout: 8000 });
  await p.waitForSelector('[data-testid=power-curve]', { timeout: 8000 });
  log('MW:', await p.textContent('[data-testid=result-required-n1]'), await p.textContent('[data-testid=result-required-n2]'), 'gl', await p.textContent('[data-testid=result-df]'), 'crit', await p.textContent('[data-testid=result-critical]'), 'real', await p.textContent('[data-testid=result-actual-power]'));
  log('curva:', await p.textContent('[data-testid=curve-marker-text]'));
  await p.waitForTimeout(5500);
  await p.screenshot({ path: 'e2e/03-calculadora.png' });
  // salvar e histórico
  await p.click('[data-testid=button-save-result]'); await p.waitForTimeout(500);
  await p.click('[data-testid=button-toggle-history]'); await p.waitForTimeout(500);
  log('histórico:', await p.locator('[data-testid^=card-calculation-]').count());
  // download TXT (navegador comum)
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('[data-testid=button-download-txt]')]);
  log('TXT:', dl ? dl.suggestedFilename() : 'NENHUM');
  // aba precisão
  await p.click('[data-testid=tab-precisao-amostral]');
  await p.waitForURL('**/calculadora/precisao-amostral');
  await p.click('[data-testid=btn-calcular]'); await p.waitForTimeout(600);
  log('precisão n:', (await p.textContent('[data-testid=result-n]').catch(() => '?')).replace(/\s+/g, ' '));
  // recarregar mantém sessão e histórico vem do servidor
  await p.goto(B + '/calculadora/poder-amostral');
  await p.click('[data-testid=button-toggle-history]'); await p.waitForTimeout(500);
  log('histórico após recarregar:', await p.locator('[data-testid^=card-calculation-]').count());
  // página principal mostra "já entrou"
  await p.goto(B + '/');
  await p.waitForSelector('#painel-logado:not([hidden])');
  log('home logado:', await p.textContent('#email-logado'), '| nav:', await p.textContent('#nav-entrar'));
  // sair pela calculadora
  await p.goto(B + '/calculadora/poder-amostral');
  await p.click('[data-testid=button-logout]');
  await p.waitForURL(B + '/');
  await p.goto(B + '/calculadora/poder-amostral');
  log('após sair:', p.url());
  // celular
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(B + '/');
  log('mobile scrollWidth:', await m.evaluate(() => document.documentElement.scrollWidth));
  await m.screenshot({ path: 'e2e/04-mobile.png', fullPage: true });
  await p.goto(B + '/privacidade');
  await p.screenshot({ path: 'e2e/05-privacidade.png' });
  log('ERROS:', errs);
  await browser.close();
})();
