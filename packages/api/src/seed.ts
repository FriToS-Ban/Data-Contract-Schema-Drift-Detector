/**
 * Seed script — populates the database with realistic demo data.
 * Run with: npm run seed --workspace=packages/api
 */
import { db, json } from './db.js';
import { nanoid } from 'nanoid';
import { diffSchemas, inferSchema } from '@schema-drift/core';
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

const analyticsSchema: ContractSchema = {
  version: '1.0.0',
  description: 'user.pageview SQS events',
  properties: {
    userId: { type: 'string', nullable: false, required: true },
    event: {
      type: 'string',
      nullable: false,
      required: true,
      enum: ['pageview', 'click', 'session_start', 'session_end'],
    },
    page: { type: 'string', nullable: false, required: true },
    timestamp: { type: 'string', nullable: false, required: true, format: 'date-time' },
    properties: { type: 'object', nullable: true, required: false, properties: {} },
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
    environment: 'development', schema_json: json(analyticsSchema), status: 'healthy',
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

// ─── Helper for inferring check schema ────────────────────────────────────────

function getObservedSchema(payload: unknown, baseline: ContractSchema): ContractSchema {
  const obs = inferSchema([payload], { detectEnums: false, detectTuples: false });

  function syncObservedWithBaseline(
    obsProps: Record<string, any>,
    baseProps: Record<string, any>,
    payloadObj: any
  ) {
    if (!obsProps || !baseProps || typeof payloadObj !== 'object' || !payloadObj) return;

    for (const [key, baseField] of Object.entries(baseProps)) {
      const obsField = obsProps[key];
      const val = payloadObj[key];

      if (obsField && val !== undefined) {
        if (baseField.enum && Array.isArray(baseField.enum)) {
          if (baseField.enum.includes(val)) {
            obsField.enum = [...baseField.enum];
          } else {
            obsField.enum = [...baseField.enum, val];
          }
        }

        if (baseField.properties && obsField.properties) {
          syncObservedWithBaseline(obsField.properties, baseField.properties, val);
        }

        if (baseField.items && obsField.items) {
          if (baseField.items.required !== undefined) {
            obsField.items.required = baseField.items.required;
          }
          if (baseField.items.properties && obsField.items.properties && Array.isArray(val) && val[0]) {
            syncObservedWithBaseline(obsField.items.properties, baseField.items.properties, val[0]);
          }
        }
      }
    }
  }

  syncObservedWithBaseline(obs.properties ?? {}, baseline.properties ?? {}, payload);
  return obs;
}

// ─── Payload datasets for contract check history ──────────────────────────────

interface ContractSeedData {
  name: string;
  schema: ContractSchema;
  payloads: { payload: unknown; detectedAt: string }[];
}

const seedHistoryData: ContractSeedData[] = [
  {
    name: 'User Profile API',
    schema: userSchema,
    payloads: [
      {
        detectedAt: daysAgo(5),
        payload: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'alice@example.com',
          name: 'Alice Smith',
          role: 'admin',
          createdAt: '2026-01-15T08:30:00Z',
          profile: { avatarUrl: 'https://avatar.example.com/alice', bio: 'Software Engineer', tier: 'pro' },
          tags: ['dev', 'admin'],
        },
      },
      {
        detectedAt: daysAgo(4),
        payload: {
          id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          email: 'bob@example.com',
          name: 'Bob Jones',
          role: 'editor',
          createdAt: '2026-02-01T12:00:00Z',
          profile: { avatarUrl: 'https://avatar.example.com/bob', tier: 'free' },
        },
      },
      {
        detectedAt: daysAgo(3),
        payload: {
          id: 'c305f984-7a0e-436b-a25e-e47895e69e4f',
          email: 'carol@example.com',
          name: 'Carol Danvers',
          role: 'viewer',
          createdAt: '2026-02-10T14:20:00Z',
        },
      },
      {
        detectedAt: daysAgo(2),
        payload: {
          id: 'e4028b12-9c1a-4d2b-8a5e-1f2e3d4c5b6a',
          email: 'dave@example.com',
          name: 'Dave Miller',
          role: 'superadmin',
          createdAt: '2026-02-12T09:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(1),
        payload: {
          id: 'f5139c23-0d2b-5e3c-9b6f-2a3b4c5d6e7f',
          email: 'eve@example.com',
          name: 'Eve Adams',
          role: 'editor',
          createdAt: '2026-02-14T11:15:00Z',
          metadata: { source: 'migration' },
        },
      },
      {
        detectedAt: daysAgo(0),
        payload: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'alice@example.com',
          username: 'alice',
          role: 'superadmin',
          metadata: { source: 'migration' },
          createdAt: null,
        },
      },
    ],
  },
  {
    name: 'Order Events',
    schema: orderSchema,
    payloads: [
      {
        detectedAt: daysAgo(5),
        payload: {
          orderId: 'a1b2c3d4-e5f6-4a8b-8c0d-1e2f3a4b5c6d',
          customerId: 'cust_101',
          status: 'paid',
          totalAmount: 149.99,
          currency: 'USD',
          items: [
            { productId: 'prod_1', quantity: 2, unitPrice: 49.99 },
            { productId: 'prod_2', quantity: 1, unitPrice: 50.00 },
          ],
          createdAt: '2026-02-10T10:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(4),
        payload: {
          orderId: 'b2c3d4e5-f6a7-4b9c-8d1e-2f3a4b5c6d7e',
          customerId: 'cust_102',
          status: 'shipped',
          totalAmount: 89.50,
          currency: 'EUR',
          items: [{ productId: 'prod_3', quantity: 1, unitPrice: 89.50 }],
          createdAt: '2026-02-11T11:30:00Z',
        },
      },
      {
        detectedAt: daysAgo(3),
        payload: {
          orderId: 'c3d4e5f6-a7b8-4c0d-8e2f-3a4b5c6d7e8f',
          customerId: 'cust_103',
          status: 'refunded',
          totalAmount: 200.50,
          currency: 'USD',
          items: [{ productId: 'prod_4', quantity: 1, unitPrice: 200.50 }],
          createdAt: '2026-02-12T14:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(2),
        payload: {
          orderId: 'd4e5f6a7-b89c-4d1e-8f3a-4b5c6d7e8f9a',
          customerId: 'cust_104',
          status: 'delivered',
          totalAmount: 29.99,
          currency: 'GBP',
          items: [{ productId: 'prod_5', quantity: 1, unitPrice: 29.99 }],
          createdAt: '2026-02-13T16:45:00Z',
        },
      },
      {
        detectedAt: daysAgo(1),
        payload: {
          orderId: 'e5f6a7b8-9c0d-4e2f-8a4b-5c6d7e8f9a0b',
          customerId: 'cust_105',
          status: 'pending',
          totalAmount: 499.99,
          currency: 'USD',
          items: [{ productId: 'prod_6', quantity: 1, unitPrice: 499.99 }],
          createdAt: '2026-02-15T09:10:00Z',
        },
      },
      {
        detectedAt: daysAgo(0),
        payload: {
          orderId: 'f6a7b89c-0d1e-4f3a-8b5c-6d7e8f9a0b1c',
          customerId: 'cust_106',
          status: 'paid',
          totalAmount: 75.50,
          currency: 'USD',
          items: [{ productId: 'prod_7', quantity: 3, unitPrice: 25.50 }],
          createdAt: '2026-02-16T18:20:00Z',
        },
      },
    ],
  },
  {
    name: 'Products Table',
    schema: productSchema,
    payloads: [
      {
        detectedAt: daysAgo(5),
        payload: {
          product_id: 1001,
          sku: 'ELEC-1001',
          name: 'Wireless Headphones',
          category: 'electronics',
          price_usd: 99.99,
          stock_quantity: 150,
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-02-01T12:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(4),
        payload: {
          product_id: 1002,
          sku: 'CLOT-2002',
          name: 'Cotton T-Shirt',
          category: 'clothing',
          price_usd: 19.99,
          stock_quantity: 500,
          is_active: true,
          created_at: '2026-01-05T00:00:00Z',
          updated_at: '2026-02-02T10:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(3),
        payload: {
          product_id: 1003,
          sku: 'HOME-3003',
          name: 'Ceramic Mug',
          category: 'home',
          price_usd: '29.99',
          stock_quantity: 75,
          is_active: true,
          created_at: '2026-01-10T00:00:00Z',
          updated_at: '2026-02-03T15:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(2),
        payload: {
          product_id: 1004,
          sku: 'SPOR-4004',
          name: 'Yoga Mat',
          category: 'sports',
          price_usd: 35.50,
          stock_quantity: 200,
          is_active: true,
          created_at: '2026-01-12T00:00:00Z',
          updated_at: '2026-02-04T08:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(1),
        payload: {
          product_id: 1005,
          sku: 'BOOK-5005',
          name: 'TypeScript Deep Dive',
          category: 'books',
          price_usd: 45.50,
          stock_quantity: 120,
          is_active: true,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-02-05T14:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(0),
        payload: {
          product_id: 1006,
          sku: 'ELEC-1006',
          name: 'Smart Watch',
          category: 'electronics',
          price_usd: 199.99,
          stock_quantity: 80,
          is_active: true,
          created_at: '2026-01-20T00:00:00Z',
          updated_at: '2026-02-16T10:00:00Z',
        },
      },
    ],
  },
  {
    name: 'Stripe Webhook',
    schema: webhookSchema,
    payloads: [
      {
        detectedAt: daysAgo(5),
        payload: {
          id: 'evt_123456',
          type: 'payment_intent.succeeded',
          created: 1771000000,
          data: { object: { amount: 2000, currency: 'usd', status: 'succeeded', customer: 'cus_999' } },
          livemode: true,
        },
      },
      {
        detectedAt: daysAgo(4),
        payload: {
          id: 'evt_123457',
          type: 'payment_intent.succeeded',
          created: 1771086400,
          data: { object: { amount: 5000, currency: 'eur', status: 'succeeded' } },
          livemode: true,
        },
      },
      {
        detectedAt: daysAgo(3),
        payload: {
          id: 'evt_123458',
          type: 'payment_intent.succeeded',
          created: 1771172800,
          data: { object: { amount: 1500, currency: 'usd', status: 'succeeded', customer: 'cus_888' } },
          livemode: false,
        },
      },
      {
        detectedAt: daysAgo(2),
        payload: {
          id: 'evt_123459',
          type: 'payment_intent.succeeded',
          created: '1771259200',
          data: { object: { amount: 3000, currency: 'usd', status: 'succeeded' } },
          livemode: true,
        },
      },
      {
        detectedAt: daysAgo(1),
        payload: {
          id: 'evt_123460',
          type: 'payment_intent.succeeded',
          created: 1771345600,
          data: { object: { amount: 1000, currency: 'usd', status: 'failed' } },
          livemode: true,
        },
      },
      {
        detectedAt: daysAgo(0),
        payload: {
          id: 'evt_123461',
          type: 'payment_intent.succeeded',
          created: 1771432000,
          data: { object: { amount: 7500, currency: 'usd', status: 'succeeded' } },
        },
      },
    ],
  },
  {
    name: 'Analytics Events',
    schema: analyticsSchema,
    payloads: [
      {
        detectedAt: daysAgo(5),
        payload: {
          userId: 'usr_99',
          event: 'pageview',
          page: '/home',
          timestamp: '2026-02-12T08:00:00Z',
          properties: { referrer: 'google.com' },
        },
      },
      {
        detectedAt: daysAgo(4),
        payload: {
          userId: 'usr_99',
          event: 'click',
          page: '/pricing',
          timestamp: '2026-02-13T09:30:00Z',
          properties: { buttonId: 'btn_signup' },
        },
      },
      {
        detectedAt: daysAgo(3),
        payload: {
          userId: 'usr_100',
          event: 'session_start',
          page: '/dashboard',
          timestamp: '2026-02-14T10:15:00Z',
        },
      },
      {
        detectedAt: daysAgo(2),
        payload: {
          userId: 'usr_101',
          event: 'purchase',
          page: '/checkout/success',
          timestamp: '2026-02-15T11:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(1),
        payload: {
          userId: 'usr_102',
          event: 'session_end',
          page: '/settings',
          timestamp: '2026-02-15T17:00:00Z',
        },
      },
      {
        detectedAt: daysAgo(0),
        payload: {
          userId: 'usr_103',
          event: 'pageview',
          page: '/docs',
          timestamp: '2026-02-16T12:00:00Z',
        },
      },
    ],
  },
];

// ─── Seed drift reports ───────────────────────────────────────────────────────

console.log('\n🌊 Seeding drift reports…');

interface ContractRow {
  id: string;
  name: string;
  environment: string;
}

for (const seedData of seedHistoryData) {
  const contractRow = db
    .prepare(`SELECT id, name, environment FROM contracts WHERE name = ?`)
    .get(seedData.name) as ContractRow | undefined;

  if (!contractRow) continue;

  const existingReport = db
    .prepare(`SELECT id FROM drift_reports WHERE contract_id = ? LIMIT 1`)
    .get(contractRow.id);

  if (existingReport) {
    console.log(`  ↳ Drift reports for "${seedData.name}" already exist, skipping.`);
    continue;
  }

  let lastReport: ReturnType<typeof diffSchemas> | null = null;
  let lastDetectedAt = daysAgo(0);

  for (const item of seedData.payloads) {
    const observed = getObservedSchema(item.payload, seedData.schema);
    const report = diffSchemas({
      contractId: contractRow.id,
      contractName: contractRow.name,
      environment: contractRow.environment,
      baseline: seedData.schema,
      observed,
      payload: item.payload,
    });

    db.prepare(
      `INSERT INTO drift_reports (id, contract_id, contract_name, environment, detected_at,
        has_drift, changes_json, summary, payload_json, observed_schema_json,
        critical_count, warning_count, info_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      report.id,
      report.contractId,
      report.contractName,
      report.environment,
      item.detectedAt,
      report.hasDrift ? 1 : 0,
      json(report.changes),
      report.summary,
      json(item.payload),
      json(observed),
      report.criticalCount,
      report.warningCount,
      report.infoCount,
    );

    lastReport = report;
    lastDetectedAt = item.detectedAt;
  }

  if (lastReport) {
    const finalStatus = lastReport.hasDrift ? 'drifted' : 'healthy';
    db.prepare(
      `UPDATE contracts SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ?`,
    ).run(finalStatus, lastDetectedAt, now(), contractRow.id);
  }

  console.log(`  ✓ Seeded ${seedData.payloads.length} drift reports for "${seedData.name}"`);
}

console.log('\n✅ Seed complete!\n');
