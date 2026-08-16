import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { db, json, parse } from '../db.js';
import type { Contract, ContractSchema, ContractSource, ToleranceConfig, AlertConfig } from '@schema-drift/core';

export const contractsRouter = new Hono();

// ─── List contracts ───────────────────────────────────────────────────────────
contractsRouter.get('/', (c) => {
  const rows = db
    .prepare(
      `SELECT * FROM contracts ORDER BY updated_at DESC`,
    )
    .all() as DbContract[];

  return c.json(rows.map(rowToContract));
});

// ─── Get single contract ──────────────────────────────────────────────────────
contractsRouter.get('/:id', (c) => {
  const row = db
    .prepare(`SELECT * FROM contracts WHERE id = ?`)
    .get(c.req.param('id')) as DbContract | undefined;

  if (!row) return c.json({ error: 'Contract not found' }, 404);
  return c.json(rowToContract(row));
});

// ─── Create contract ──────────────────────────────────────────────────────────
contractsRouter.post('/', async (c) => {
  const body = await c.req.json<Partial<Contract>>();

  if (!body.name) return c.json({ error: 'name is required' }, 400);
  if (!body.schema) return c.json({ error: 'schema is required' }, 400);

  const now = new Date().toISOString();
  const id = nanoid();

  const source: ContractSource = body.source ?? { type: 'rest' };

  db.prepare(
    `INSERT INTO contracts
      (id, name, description, source_type, source_json, environment, schema_json,
       tolerance_json, alerts_json, tags, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown', ?, ?)`,
  ).run(
    id,
    body.name,
    body.description ?? null,
    source.type,
    json(source),
    body.environment ?? 'production',
    json(body.schema),
    body.tolerance ? json(body.tolerance) : null,
    body.alerts ? json(body.alerts) : null,
    body.tags ? json(body.tags) : null,
    now,
    now,
  );

  const row = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(id) as DbContract;
  return c.json(rowToContract(row), 201);
});

// ─── Update contract ──────────────────────────────────────────────────────────
contractsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = db.prepare(`SELECT id FROM contracts WHERE id = ?`).get(id);
  if (!existing) return c.json({ error: 'Contract not found' }, 404);

  const body = await c.req.json<Partial<Contract>>();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE contracts SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      source_type = COALESCE(?, source_type),
      source_json = COALESCE(?, source_json),
      environment = COALESCE(?, environment),
      schema_json = COALESCE(?, schema_json),
      tolerance_json = COALESCE(?, tolerance_json),
      alerts_json = COALESCE(?, alerts_json),
      tags = COALESCE(?, tags),
      updated_at = ?
    WHERE id = ?`,
  ).run(
    body.name ?? null,
    body.description ?? null,
    body.source?.type ?? null,
    body.source ? json(body.source) : null,
    body.environment ?? null,
    body.schema ? json(body.schema) : null,
    body.tolerance ? json(body.tolerance) : null,
    body.alerts ? json(body.alerts) : null,
    body.tags ? json(body.tags) : null,
    now,
    id,
  );

  const row = db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(id) as DbContract;
  return c.json(rowToContract(row));
});

// ─── Delete contract ──────────────────────────────────────────────────────────
contractsRouter.delete('/:id', (c) => {
  const id = c.req.param('id');
  const result = db.prepare(`DELETE FROM contracts WHERE id = ?`).run(id);
  if (result.changes === 0) return c.json({ error: 'Contract not found' }, 404);
  return c.json({ deleted: true, id });
});

// ─── Get drift history for a contract ────────────────────────────────────────
contractsRouter.get('/:id/history', (c) => {
  const rows = db
    .prepare(
      `SELECT * FROM drift_reports WHERE contract_id = ? ORDER BY detected_at DESC LIMIT 50`,
    )
    .all(c.req.param('id')) as DbDriftReport[];

  return c.json(rows.map(rowToDriftReport));
});

// ─── DB types & mappers ───────────────────────────────────────────────────────

interface DbContract {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_json: string;
  environment: string;
  schema_json: string;
  tolerance_json: string | null;
  alerts_json: string | null;
  tags: string | null;
  status: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbDriftReport {
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

function rowToContract(row: DbContract): Contract {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    source: parse<ContractSource>(row.source_json) ?? { type: 'rest' as const },
    environment: row.environment,
    schema: parse<ContractSchema>(row.schema_json) ?? { version: '1.0.0', properties: {} },
    tolerance: parse<ToleranceConfig>(row.tolerance_json),
    alerts: parse<AlertConfig[]>(row.alerts_json),
    tags: parse<string[]>(row.tags),
    status: row.status as Contract['status'],
    lastCheckedAt: row.last_checked_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToDriftReport(row: DbDriftReport) {
  return {
    id: row.id,
    contractId: row.contract_id,
    contractName: row.contract_name,
    environment: row.environment,
    detectedAt: row.detected_at,
    hasDrift: Boolean(row.has_drift),
    changes: parse(row.changes_json) ?? [],
    summary: row.summary,
    payload: parse(row.payload_json),
    observedSchemaSnapshot: parse(row.observed_schema_json),
    criticalCount: row.critical_count,
    warningCount: row.warning_count,
    infoCount: row.info_count,
  };
}
