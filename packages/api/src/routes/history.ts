import { Hono } from 'hono';
import { db } from '../db.js';
import { rowToDriftReport } from './contracts.js';

export const historyRouter = new Hono();

// ─── Global drift history ─────────────────────────────────────────────────────
historyRouter.get('/', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const offset = Number(c.req.query('offset') ?? 0);
  const onlyDrift = c.req.query('drifted') === 'true';

  const where = onlyDrift ? 'WHERE has_drift = 1' : '';

  const rows = db
    .prepare(
      `SELECT * FROM drift_reports ${where} ORDER BY detected_at DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as DbDriftRow[];

  const total = (
    db.prepare(`SELECT COUNT(*) as cnt FROM drift_reports ${where}`).get() as { cnt: number }
  ).cnt;

  return c.json({ total, limit, offset, items: rows.map(rowToDriftReport) });
});

// ─── Single drift report ──────────────────────────────────────────────────────
historyRouter.get('/:id', (c) => {
  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(c.req.param('id')) as DbDriftRow | undefined;

  if (!row) return c.json({ error: 'Drift report not found' }, 404);
  return c.json(rowToDriftReport(row));
});

// ─── Delete a report ──────────────────────────────────────────────────────────
historyRouter.delete('/:id', (c) => {
  const result = db
    .prepare(`DELETE FROM drift_reports WHERE id = ?`)
    .run(c.req.param('id'));
  if (result.changes === 0) return c.json({ error: 'Report not found' }, 404);
  return c.json({ deleted: true });
});

interface DbDriftRow {
  id: string;
  contract_id: string;
  contract_name: string;
  environment: string;
  detected_at: string;
  has_drift: number;
  changes_json: string;
  summary: string;
  payload_json: string | null;
  observed_schema_json: string | null;
  critical_count: number;
  warning_count: number;
  info_count: number;
}
