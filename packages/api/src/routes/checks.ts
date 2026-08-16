import { Hono } from 'hono';
import { diffSchemas, inferSchema, fireAlerts } from '@schema-drift/core';
import type { ContractSchema, AlertConfig } from '@schema-drift/core';
import { db, json, parse } from '../db.js';

export const checksRouter = new Hono();

/**
 * POST /api/checks/infer
 * Body: { payloads: unknown[], options?: InferOptions }
 *
 * Infer a schema from one or more sample payloads (no contract needed).
 * IMPORTANT: Must be registered BEFORE /:contractId to avoid route shadowing.
 */
checksRouter.post('/infer', async (c) => {
  const { payloads, options } = await c.req.json<{
    payloads: unknown[];
    options?: Record<string, unknown>;
  }>();

  if (!Array.isArray(payloads) || payloads.length === 0) {
    return c.json({ error: 'payloads must be a non-empty array' }, 400);
  }

  const schema = inferSchema(payloads, options ?? {});
  return c.json({ schema });
});

/**
 * POST /api/checks/:contractId
 * Body: { payload: unknown }
 */
checksRouter.post('/:contractId', async (c) => {
  const contractId = c.req.param('contractId');
  const { payload } = await c.req.json<{ payload: unknown }>();

  if (payload === undefined) {
    return c.json({ error: 'payload is required' }, 400);
  }

  // Load contract
  const row = db
    .prepare(`SELECT * FROM contracts WHERE id = ?`)
    .get(contractId) as DbContractRow | undefined;

  if (!row) return c.json({ error: 'Contract not found' }, 404);

  const contract = {
    id: row.id,
    name: row.name,
    environment: row.environment,
    schema: parse<ContractSchema>(row.schema_json) ?? { version: '1.0.0', properties: {} },
    alerts: parse<AlertConfig[]>(row.alerts_json) ?? [],
    tolerance: parse<Record<string, unknown>>(row.tolerance_json) ?? {},
  };

  const startMs = Date.now();

  // Infer schema from the incoming payload
  const observed = inferSchema([payload]);

  // Diff against the baseline contract schema
  const report = diffSchemas({
    contractId: contract.id,
    contractName: contract.name,
    environment: contract.environment,
    baseline: contract.schema,
    observed,
    payload,
  });

  const durationMs = Date.now() - startMs;
  const now = new Date().toISOString();

  // Persist the drift report
  db.prepare(
    `INSERT INTO drift_reports
      (id, contract_id, contract_name, environment, detected_at, has_drift,
       changes_json, summary, payload_json, observed_schema_json,
       critical_count, warning_count, info_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    report.id,
    report.contractId,
    report.contractName,
    report.environment,
    report.detectedAt,
    report.hasDrift ? 1 : 0,
    json(report.changes),
    report.summary,
    json(payload),
    json(observed),
    report.criticalCount,
    report.warningCount,
    report.infoCount,
  );

  // Update contract status + last_checked_at
  const newStatus = report.hasDrift
    ? report.criticalCount > 0
      ? 'drifted'
      : 'drifted'
    : 'healthy';

  db.prepare(
    `UPDATE contracts SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ?`,
  ).run(newStatus, now, now, contractId);

  // Fire alerts asynchronously (don't await — don't block the response)
  if (report.hasDrift && contract.alerts.length > 0) {
    fireAlerts(contract.alerts, report).catch(console.error);
  }

  return c.json({
    valid: !report.hasDrift,
    contractId: contract.id,
    contractName: contract.name,
    driftReport: report,
    checkedAt: now,
    durationMs,
  });
});

interface DbContractRow {
  id: string;
  name: string;
  environment: string;
  schema_json: string;
  alerts_json: string | null;
  tolerance_json: string | null;
}
