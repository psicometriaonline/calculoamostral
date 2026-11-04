// Sobe Postgres embutido + app (com o build do cliente) para testes no navegador.
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(mkdtempSync(path.join(os.tmpdir(), 'pge2e-')), 'data');
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'calc', password: 'calc', port: 54331, persistent: false });
await pg.initialise(); await pg.start(); await pg.createDatabase('calc');
Object.assign(process.env, {
  DATABASE_URL: 'postgres://calc:calc@localhost:54331/calc', SESSION_SECRET: 'y'.repeat(48),
  APP_URL: 'http://localhost:4600', EXPOSE_CODES_FOR_TESTS: '1', AC_ENABLED: 'false',
});
const { migrate } = await import('../server/db');
const { createApp } = await import('../server/index');
await migrate();
createApp().listen(4600, () => console.log('E2E pronto em http://localhost:4600'));
process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });
