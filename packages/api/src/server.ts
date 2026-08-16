import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { contractsRouter } from './routes/contracts.js';
import { checksRouter } from './routes/checks.js';
import { historyRouter } from './routes/history.js';
import { statsRouter } from './routes/stats.js';

const app = new Hono();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'schema-drift-api', version: '1.0.0' }));
app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route('/api/contracts', contractsRouter);
app.route('/api/checks', checksRouter);
app.route('/api/history', historyRouter);
app.route('/api/stats', statsRouter);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🚀 Schema Drift API running at http://localhost:${PORT}\n`);
});

export default app;
