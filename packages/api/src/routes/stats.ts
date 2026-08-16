import { Hono } from 'hono';
import { db } from '../db.js';

export const statsRouter = new Hono();

statsRouter.get('/', (c) => {
  const totalContracts = (db.prepare(`SELECT COUNT(*) as n FROM contracts`).get() as { n: number }).n;
  const healthyContracts = (db.prepare(`SELECT COUNT(*) as n FROM contracts WHERE status = 'healthy'`).get() as { n: number }).n;
  const driftedContracts = (db.prepare(`SELECT COUNT(*) as n FROM contracts WHERE status = 'drifted'`).get() as { n: number }).n;
  const unknownContracts = (db.prepare(`SELECT COUNT(*) as n FROM contracts WHERE status = 'unknown'`).get() as { n: number }).n;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const driftsToday = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM drift_reports WHERE has_drift = 1 AND detected_at >= ?`,
      )
      .get(todayStart.toISOString()) as { n: number }
  ).n;

  const totalChecks = (db.prepare(`SELECT COUNT(*) as n FROM drift_reports`).get() as { n: number }).n;

  const criticalOpen = (
    db
      .prepare(
        `SELECT COUNT(*) as n FROM contracts WHERE status = 'drifted'`,
      )
      .get() as { n: number }
  ).n;

  // Recent activity — last 7 days drift count per day
  const last7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const count = (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM drift_reports WHERE has_drift = 1 AND detected_at >= ? AND detected_at < ?`,
        )
        .get(d.toISOString(), next.toISOString()) as { n: number }
    ).n;

    last7Days.push({
      date: d.toISOString().split('T')[0],
      count,
    });
  }

  // Top drifting contracts
  const topDrifters = db
    .prepare(
      `SELECT contract_id, contract_name, COUNT(*) as drift_count
       FROM drift_reports WHERE has_drift = 1
       GROUP BY contract_id ORDER BY drift_count DESC LIMIT 5`,
    )
    .all() as { contract_id: string; contract_name: string; drift_count: number }[];

  return c.json({
    totalContracts,
    healthyContracts,
    driftedContracts,
    unknownContracts,
    driftsToday,
    totalChecks,
    criticalOpen,
    last7Days,
    topDrifters,
  });
});
