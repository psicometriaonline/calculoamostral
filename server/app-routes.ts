// Rotas de cálculo, histórico e compatibilidade com o front-end da Academy.
import type { Express, Response } from 'express';
import { dispatchCalc } from './calc/core';
import { q, one } from './db';
import { config } from './config';
import { requireUser, type AuthedRequest } from './auth';
import { SlidingLimiter } from './security';
import { enqueueTagOnce } from './activecampaign';

const calcLimiter = new SlidingLimiter(config.calcPerMinute, 60_000);

const TOOLS = {
  'power-analysis': 'poder',
  'sample-size-precision': 'precisao',
} as const;

function calcGuard(req: AuthedRequest, res: Response): boolean {
  const wait = calcLimiter.hit(req.user!.id);
  if (wait) {
    res.status(429).json({ error: 'Muitos cálculos em sequência. Aguarde alguns segundos.', retryAfter: wait });
    return false;
  }
  return true;
}

export function registerAppRoutes(app: Express) {
  // ---- Cálculo (mesmos handlers do app da Academy, via calc/core) ----
  const calcPaths = [
    '/api/power-analysis/calculate',
    '/api/power-analysis/curve',
    '/api/power-analysis/curve-consistent',
    '/api/sample-size-precision/calculate',
  ];
  for (const p of calcPaths) {
    app.post(p, requireUser, async (req: AuthedRequest, res: Response) => {
      if (!calcGuard(req, res)) return;
      const r = await dispatchCalc('POST', p, req.body ?? {});
      if (r.status === 200 && p.endsWith('/calculate')) {
        const tool = p.startsWith('/api/power') ? 'poder' : 'precisao';
        const testType = String(req.body?.testType ?? req.body?.procedureType ?? '').slice(0, 64);
        q(`INSERT INTO calc_events (user_id, tool, test_type) VALUES ($1, $2, $3)`, [req.user!.id, tool, testType]).catch(() => {});
        enqueueTagOnce(req.user!.id, tool === 'poder' ? config.acTagUsedPower : config.acTagUsedPrecision).catch(() => {});
      }
      res.status(r.status).json(r.data);
    });
  }

  // ---- Histórico por pessoa (contrato igual ao do Replit) ----
  for (const [prefix, tool] of Object.entries(TOOLS)) {
    app.get(`/api/${prefix}/history`, requireUser, async (req: AuthedRequest, res: Response) => {
      const rows = await q(
        `SELECT id, payload, created_at FROM calc_history WHERE user_id = $1 AND tool = $2 ORDER BY created_at DESC LIMIT 100`,
        [req.user!.id, tool],
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json(rows.map((r) => ({ ...r.payload, id: r.id, userId: req.user!.id, createdAt: r.created_at })));
    });

    app.post(`/api/${prefix}/save`, requireUser, async (req: AuthedRequest, res: Response) => {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Dados do cálculo ausentes' });
      const { id: _i, userId: _u, createdAt: _c, ...payload } = body;
      const count = await one<{ n: string }>(`SELECT count(*)::text AS n FROM calc_history WHERE user_id = $1`, [req.user!.id]);
      if (Number(count?.n ?? 0) >= 500) return res.status(400).json({ error: 'Você atingiu o limite de 500 cálculos salvos. Exclua alguns para salvar novos.' });
      const row = await one(
        `INSERT INTO calc_history (user_id, tool, payload) VALUES ($1, $2, $3) RETURNING id, created_at`,
        [req.user!.id, tool, JSON.stringify(payload)],
      );
      enqueueTagOnce(req.user!.id, config.acTagSaved).catch(() => {});
      res.status(201).json({ ...payload, id: row.id, userId: req.user!.id, createdAt: row.created_at });
    });

    app.delete(`/api/${prefix}/:id`, requireUser, async (req: AuthedRequest, res: Response) => {
      const id = String(req.params.id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Calculation not found' });
      const r = await q(`DELETE FROM calc_history WHERE id = $1 AND user_id = $2 AND tool = $3 RETURNING id`, [id, req.user!.id, tool]);
      if (!r.length) return res.status(404).json({ error: 'Calculation not found' });
      res.json({ message: 'Deleted' });
    });
  }

  // ---- Integrações da Academy sem equivalente no site (respostas neutras) ----
  app.get('/api/feature-flags', (_req, res) => res.json([]));
  app.get('/api/usage-limits/status', (_req, res) =>
    res.json({ isExpiredFreeTier: false, tools: {}, watchTime: { limitMinutes: null, usedMinutes: 0, remainingMinutes: null, allowed: true, resetsAt: null }, resourcesAccess: true }),
  );
  app.all(/^\/api\/usage-limits\/.*/, (_req, res) => res.json({ ok: true }));
  app.post('/api/tool-usage/track', (_req, res) => res.json({ ok: true }));
  app.all(/^\/api\/effect-size-ratings.*/, (_req, res) => res.json(null));
}
