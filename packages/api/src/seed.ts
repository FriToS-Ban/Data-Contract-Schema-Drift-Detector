/**
 * Seed script — populates the database with realistic demo data.
 * Run with: npm run seed --workspace=packages/api
 */
import { db, json } from './db.js';
import { nanoid } from 'nanoid';
import { diffSchemas } from '@schema-drift/core';
import type { ContractSchema } from '@schema-drift/core';

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// ─── Sample contract schemas ──────────────────────────────────────────────────

const userSchema: ContractSchema = {
  version: '2.1.0',
  description: 'User profile returned by /api/v2/users/:id',
  properties: {
    id: { type: 'string', nullable: false, required: true, format: 'uuid' },
    email: { type: 'string', nullable: false, required: true, format: 'email' },
    name: { type: 'string', nullable: false, required: true },
    role: {
      type: 'string',
      nullable: false,
      required: true,
      enum: ['admin', 'editor', 'viewer'],
    },
    createdAt: { type: 'string', nullable: false, required: true, format: 'date-time' },
    profile: {
      type: 'object',
      nullable: true,
      required: false,
      properties: {
        avatarUrl: { type: 'string', nullable: true, required: false },
        bio: { type: 'string', nullable: true, required: false },
        tier: {
          type: 'string',
          nullable: false,
          required: true,
          enum: ['free', 'pro', 'enterprise'],
        },
      },
    },
    tags: {
      type: 'array',
      nullable: false,
      required: false,
      items: { type: 'string', nullable: false, required: false },
    },
  },
};

const orderSchema: ContractSchema = {
  version: '1.0.0',
  description: 'Order event published to orders.created Kafka topic',
  properties: {
    orderId: { type: 'string', nullable: false, required: true, format: 'uuid' },
    customerId: { type: 'string', nullable: false, required: true },
    status: {
      type: 'string',
      nullable: false,
      required: true,
      enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
    },
    totalAmount: { type: 'number', nullable: false, required: true },
    currency: { type: 'string', nullable: false, required: true, enum: ['USD', 'EUR', 'GBP'] },
    items: {
      type: 'array',
      nullable: false,
      required: true,
      items: {
        type: 'object',
        nullable: false,
        required: true,
        properties: {
          productId: { type: 'string', nullable: false, required: true },
          quantity: { type: 'integer', nullable: false, required: true },
          unitPrice: { type: 'number', nullable: false, required: true },
        },
      },
    },
    createdAt: { type: 'string', nullable: false, required: true, format: 'date-time' },
  },
};

const productSchema: ContractSchema = {
  version: '3.2.1',
  description: 'Product catalog entry from Snowflake products table',
  properties: {
    product_id: { type: 'integer', nullable: false, required: true },
    sku: { type: 'string', nullable: false, required: true },
    name: { type: 'string', nullable: false, required: true },
    category: {
      type: 'string',
      nullable: false,
      required: true,
      enum: ['electronics', 'clothing', 'home', 'sports', 'books'],
    },
    price_usd: { type: 'number', nullable: false, required: true },
    stock_quantity: { type: 'integer', nullable: false, required: true },
    is_active: { type: 'boolean', nullable: false, required: true },
    created_at: { type: 'string', nullable: false, required: true, format: 'date-time' },
    updated_at: { type: 'string', nullable: false, required: true, format: 'date-time' },
  },
};

const webhookSchema: ContractSchema = {
  version: '1.0.0',
  description: 'Stripe payment.succeeded webhook payload',
  properties: {
    id: { type: 'string', nullable: false, required: true },
    type: { type: 'string', nullable: false, required: true, enum: ['payment_intent.succeeded'] },
    created: { type: 'integer', nullable: false, required: true },
    data: {
      type: 'object',
      nullable: false,
      required: true,
      properties: {
        object: {
          type: 'object',
          nullable: false,
          required: true,
          properties: {
            amount: { type: 'integer', nullable: false, required: true },
            currency: { type: 'string', nullable: false, required: true },
            status: { type: 'string', nullable: false, required: true, enum: ['succeeded'] },
            customer: { type: 'string', nullable: true, required: false },
          },
        },
      },
    },
    livemode: { type: 'boolean', nullable: false, required: true },
  },
};

// ─── Seed contracts ───────────────────────────────────────────────────────────

const contracts = [
  {
    id: nanoid(), name: 'User Profile API', description: 'GET /api/v2/users/:id endpoint',
    source_type: 'rest', source_json: json({ type: 'rest', url: 'https://api.example.com/v2/users/:id', method: 'GET' }),
    environment: 'production', schema_json: json(userSchema), status: 'drifted',
    last_checked_at: daysAgo(0),
  },
  {
    id: nanoid(), name: 'Order Events', description: 'orders.created Kafka topic',
    source_type: 'kafka', source_json: json({ type: 'kafka', topic: 'orders.created' }),
    environment: 'production', schema_json: json(orderSchema), status: 'healthy',
    last_checked_at: daysAgo(0),
  },
  {
    id: nanoid(), name: 'Products Table', description: 'Snowflake DW products table',
    source_type: 'database', source_json: json({ type: 'database', table: 'products', database: 'snowflake' }),
    environment: 'staging', schema_json: json(productSchema), status: 'healthy',
    last_checked_at: daysAgo(1),
  },
  {
    id: nanoid(), name: 'Stripe Webhook', description: 'payment.succeeded event',
    source_type: 'webhook', source_json: json({ type: 'webhook', url: 'https://payments.example.com/stripe' }),
    environment: 'production', schema_json: json(webhookSchema), status: 'unknown',
    last_checked_at: null,
  },
  {
    id: nanoid(), name: 'Analytics Events', description: 'user.pageview SQS events',
    source_type: 'sqs', source_json: json({ type: 'sqs', topic: 'analytics-events' }),
    environment: 'development', schema_json: json({
      version: '1.0.0',
      properties: {
        userId: { type: 'string', nullable: false, required: true },
        event: { type: 'string', nullable: false, required: true, enum: ['pageview', 'click', 'session_start', 'session_end'] },
        page: { type: 'string', nullable: false, required: true },
        timestamp: { type: 'string', nullable: false, required: true, format: 'date-time' },
        properties: { type: 'object', nullable: true, required: false, properties: {} },
      },
    } satisfies ContractSchema), status: 'healthy',
    last_checked_at: daysAgo(0),
  },
];

console.log('🌱 Seeding contracts…');
for (const c of contracts) {
  const existing = db.prepare(`SELECT id FROM contracts WHERE name = ?`).get(c.name);
  if (existing) { console.log(`  ↳ Contract "${c.name}" already exists, skipping.`); continue; }

  db.prepare(
    `INSERT INTO contracts (id, name, description, source_type, source_json, environment,
      schema_json, tolerance_json, alerts_json, tags, status, last_checked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
  ).run(c.id, c.name, c.description, c.source_type, c.source_json, c.environment,
    c.schema_json, c.status, c.last_checked_at, daysAgo(14), daysAgo(0));
  console.log(`  ✓ ${c.name}`);
}

// ─── Seed drift reports ───────────────────────────────────────────────────────

const userContractRow = db.prepare(`SELECT id, name FROM contracts WHERE name = 'User Profile API'`).get() as { id: string; name: string };

if (userContractRow) {
  const driftedPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alice@example.com',
    username: 'alice', // renamed from name
    role: 'superadmin', // new enum value!
    // missing: createdAt
    // missing: profile
    metadata: { source: 'migration' }, // new field
    createdAt: null, // now nullable!
  };

  const observedSchema = {
    version: '1.0.0',
    properties: {
      id: { type: 'string', nullable: false, required: true, format: 'uuid' },
      email: { type: 'string', nullable: false, required: true },
      username: { type: 'string', nullable: false, required: true }, // renamed!
      role: { type: 'string', nullable: false, required: true, enum: ['admin', 'editor', 'viewer', 'superadmin'] },
      createdAt: { type: 'string', nullable: true, required: true }, // nullable changed!
      metadata: { type: 'object', nullable: false, required: false, properties: { source: { type: 'string', nullable: false, required: false } } },
    },
  } as ContractSchema;

  const report = diffSchemas({
    contractId: userContractRow.id,
    contractName: userContractRow.name,
    environment: 'production',
    baseline: userSchema,
    observed: observedSchema,
    payload: driftedPayload,
  });

  const existingReport = db.prepare(`SELECT id FROM drift_reports WHERE contract_id = ?`).get(userContractRow.id);
  if (!existingReport) {
    console.log('\n🌊 Seeding drift reports…');
    db.prepare(
      `INSERT INTO drift_reports (id, contract_id, contract_name, environment, detected_at,
        has_drift, changes_json, summary, payload_json, observed_schema_json,
        critical_count, warning_count, info_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(report.id, report.contractId, report.contractName, report.environment,
      daysAgo(0), 1, JSON.stringify(report.changes), report.summary,
      JSON.stringify(driftedPayload), JSON.stringify(observedSchema),
      report.criticalCount, report.warningCount, report.infoCount);

    // Older reports
    for (let i = 1; i <= 5; i++) {
      const oldReport = diffSchemas({
        contractId: userContractRow.id,
        contractName: userContractRow.name,
        environment: 'production',
        baseline: userSchema,
        observed: i % 2 === 0 ? userSchema : observedSchema,
      });
      db.prepare(
        `INSERT INTO drift_reports (id, contract_id, contract_name, environment, detected_at,
          has_drift, changes_json, summary, payload_json, observed_schema_json,
          critical_count, warning_count, info_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(oldReport.id, oldReport.contractId, oldReport.contractName, oldReport.environment,
        daysAgo(i * 2), oldReport.hasDrift ? 1 : 0, JSON.stringify(oldReport.changes),
        oldReport.summary, null, null,
        oldReport.criticalCount, oldReport.warningCount, oldReport.infoCount);
    }
    console.log(`  ✓ Seeded ${6} drift reports for "User Profile API"`);
  }
}

console.log('\n✅ Seed complete!\n');
