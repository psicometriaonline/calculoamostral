import express, { type Request, type Response, type NextFunction } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, assertConfig, describeDbUrl } from './config';
import { pool, migrate } from './db';
import { securityHeaders, sameOrigin } from './security';
import { loadSession, registerAuthRoutes, startAuthJanitor, type AuthedRequest } from './auth';
import { registerAppRoutes } from './app-routes';
import { startOutboxWorker } from './activecampaign';

const here = path.dirname(fileURLToPath(import.meta.url));
// Em produção: dist/server.js + dist/client/. Em desenvolvimento: server/ + dist/client/ (após build:client).
const clientDir = [path.join(here, 'client'), path.join(here, '..', 'dist', 'client')].find((d) => existsSync(d)) ?? path.join(here, 'client');

function htmlPage(file: string): string {
  const p = path.join(clientDir, file);
  return readFileSync(p, 'utf8').replaceAll('__TURNSTILE_SITE_KEY__', config.turnstileSiteKey);
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // atrás do proxy do Coolify
  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));
  app.use(sameOrigin);
  app.use(loadSession);

  app.get('/healthz', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  registerAuthRoutes(app);
  registerAppRoutes(app);
  app.all(/^\/api\/.*/, (_req, res) => res.status(404).json({ error: 'Recurso não encontrado' }));

  // Arquivos estáticos do build (cache longo só para os arquivos com hash)
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));

  const sendHtml = (file: string) => (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(htmlPage(file));
  };

  app.get('/', sendHtml('index.html'));
  app.get(['/privacidade', '/privacidade/'], sendHtml('privacidade.html'));
  app.get(['/termos', '/termos/'], sendHtml('termos.html'));

  // Calculadora: exige sessão; sem sessão volta para a página principal
  app.get(['/calculadora', /^\/calculadora\/.*/], (req: AuthedRequest, res: Response) => {
    if (!req.user) return res.redirect(302, '/?entrar=1');
    if (req.path === '/calculadora' || req.path === '/calculadora/') return res.redirect(302, '/calculadora/poder-amostral');
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(htmlPage('calculadora.html'));
  });

  app.use((_req, res) => res.status(404).type('html').send(htmlPage('404.html')));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição grande demais.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error('[app] erro não tratado', err);
    res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  });
  return app;
}

async function main() {
  assertConfig();
  console.log(`[db] conectando em ${describeDbUrl(config.databaseUrl)}`);
  await migrate();
  if (process.argv.includes('--migrate-only')) {
    await pool.end();
    return;
  }
  startOutboxWorker();
  startAuthJanitor();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`[app] ouvindo na porta ${config.port} (${config.appUrl})`));
  const stop = () => {
    console.log('[app] encerrando…');
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((e) => {
    console.error('[app] falha ao iniciar:', e);
    process.exit(1);
  });
}
