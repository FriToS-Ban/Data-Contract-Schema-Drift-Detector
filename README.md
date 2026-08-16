# ⚡ SchemaDrift — Data Contract + Schema Drift Detector

> Define data contracts once. Know the instant something changes.

SchemaDrift monitors your REST APIs, Kafka topics, databases, and webhooks against defined data contracts — and alerts you the moment the schema drifts. No more silent breakage in ETL pipelines, RAG systems, or agent tool calls.

---

## Why It Exists

In every enterprise integration, schemas silently change:
- A field gets renamed in the upstream API
- A new required field appears in a Kafka event  
- A database column changes from `NOT NULL` to `nullable`
- An enum gains values your code doesn't handle

Nobody notices for days. Then something downstream fails in a subtle way, and you spend hours debugging.

**SchemaDrift makes schema drift a first-class concern.**

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Data Sources   │────▶│  @schema-drift/  │────▶│  Contract Store │
│  (APIs, DBs,    │     │  core (library)  │     │  + Diff Engine  │
│   Events)       │     └──────────────────┘     └────────┬────────┘
└─────────────────┘                                       │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Alerting +     │
                                                 │  Dashboard UI   │
                                                 └─────────────────┘
```

**Monorepo packages:**
- `packages/core` — Pure TypeScript library: diff engine, schema inference, alerting
- `packages/api` — Hono REST API server + SQLite storage
- `packages/dashboard` — React + Vite web dashboard

---

## Quick Start

```bash
# Install dependencies
npm install

# Seed demo data
npm run seed

# Start API + Dashboard
npm run dev
```

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3001

---

## Drift Detection

The diff engine detects these change types:

| Change | Severity | Description |
|--------|----------|-------------|
| `FIELD_REMOVED` | 🔴 Critical | A field was removed from the schema |
| `TYPE_CHANGED` | 🔴 Critical | Field type changed (e.g. `string` → `integer`) |
| `NULLABILITY_CHANGED` | 🟡 Warning / 🔴 Critical | Field became nullable or non-nullable |
| `REQUIRED_CHANGED` | 🔴 Critical | Optional field became required |
| `ENUM_VALUE_REMOVED` | 🔴 Critical | An enum value was removed |
| `ENUM_VALUE_ADDED` | 🔵 Info | A new enum value appeared |
| `FIELD_ADDED` | 🟡 Warning / 🔵 Info | New field added to the schema |
| `FORMAT_CHANGED` | 🟡 Warning | Field format changed (e.g. `email` → `uuid`) |

---

## Contract Definition

Contracts are JSON documents:

```json
{
  "version": "2.1.0",
  "description": "User profile from GET /v2/users/:id",
  "properties": {
    "id":    { "type": "string",  "nullable": false, "required": true, "format": "uuid" },
    "email": { "type": "string",  "nullable": false, "required": true, "format": "email" },
    "role":  { "type": "string",  "nullable": false, "required": true, "enum": ["admin", "editor", "viewer"] },
    "profile": {
      "type": "object", "nullable": true, "required": false,
      "properties": {
        "tier": { "type": "string", "nullable": false, "required": true, "enum": ["free", "pro", "enterprise"] }
      }
    }
  }
}
```

---

## Library Usage (`@schema-drift/core`)

```typescript
import { diffSchemas, inferSchema, fireAlerts } from '@schema-drift/core';

// Infer schema from sample payloads
const schema = inferSchema([payload1, payload2, payload3]);

// Diff against a known baseline
const report = diffSchemas({
  contractId: 'user-api',
  contractName: 'User Profile API',
  environment: 'production',
  baseline: myContract.schema,
  observed: schema,
  payload: incomingPayload,
});

if (report.hasDrift) {
  console.log(report.summary);
  // → "4 changes detected: 2 critical, 1 warning, 1 info."
  
  await fireAlerts(myContract.alerts, report);
}
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/contracts` | List all contracts |
| `POST` | `/api/contracts` | Create a contract |
| `GET` | `/api/contracts/:id` | Get contract |
| `PUT` | `/api/contracts/:id` | Update contract |
| `DELETE` | `/api/contracts/:id` | Delete contract |
| `GET` | `/api/contracts/:id/history` | Drift history for contract |
| `POST` | `/api/checks/:contractId` | Check payload against contract |
| `POST` | `/api/checks/infer` | Infer schema from payloads |
| `GET` | `/api/history` | Global drift history |
| `GET` | `/api/stats` | Dashboard statistics |

---

## Alerting

Configure alerts per contract:

```json
{
  "alerts": [
    {
      "type": "slack",
      "url": "https://hooks.slack.com/services/...",
      "onSeverity": ["critical", "warning"]
    },
    {
      "type": "webhook",
      "url": "https://your-service.com/schema-drift",
      "onSeverity": ["critical"]
    },
    {
      "type": "pagerduty",
      "routingKey": "your-routing-key"
    }
  ]
}
```

---

## Supported Source Types

- `rest` — REST API endpoints
- `graphql` — GraphQL responses
- `kafka` — Kafka topics
- `sqs` — SQS queues
- `pubsub` — Google Pub/Sub
- `webhook` — Incoming webhooks
- `database` — Database tables (Postgres, Snowflake, BigQuery)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Core library | TypeScript + Zod |
| API server | Hono + Node.js |
| Storage | SQLite (better-sqlite3) |
| Dashboard | React 18 + Vite |
| Alerting | Slack / Webhook / PagerDuty |

---

## Roadmap

- [ ] Auto-inference from OpenAPI specs
- [ ] Tolerance rules (ignore extra fields, allow null→non-null)
- [ ] Adapter code generation (TS/Python migration stubs)
- [ ] Multi-environment strictness levels
- [ ] Semantic drift detection (field meaning via embeddings)
- [ ] GitHub PR bot on drift detection
- [ ] Agent framework tool schema sync (LangChain, CrewAI)

---

Built for forward-deployed engineers who get paged at 3am because a field changed.
