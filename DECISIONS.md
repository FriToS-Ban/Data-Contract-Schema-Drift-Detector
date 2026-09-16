# Why SchemaDrift is Built the Way It Is

This document records every significant decision made in SchemaDrift (Data-Contract-Schema-Drift-Detector) — what was chosen, what was rejected, and why. It exists because architectural choices without recorded reasoning become dead weight: months later the code is hard to change safely because nobody remembers the constraint it was solving.

If you hit a limitation and want to understand why it exists, start here. If you are thinking of changing something fundamental, start here. If you are evaluating the project (or interviewing the author) and want to understand the intent, constraints, and trade-offs, this document has what you need.

---

## Why this project exists

In real enterprise systems, schemas change silently:

- An upstream API renames or removes a field
- A Kafka / SQS / Pub/Sub event gains a new required field
- A database column flips from `NOT NULL` to nullable (or the reverse)
- An enum gains or loses values
- Nested objects or array shapes change

Downstream consumers (ETL jobs, RAG pipelines, agent tool calls, microservices) break in subtle ways. The breakage is often discovered days later, after hours of debugging.

Existing tools fall into two imperfect categories:

1. **Heavy data-contract platforms** (Great Expectations, Monte Carlo, Soda, OpenLineage-style systems) — powerful but high operational overhead and usually focused on data quality rather than pure structural contract drift.
2. **Simple schema diff CLIs** — good for one-off OpenAPI comparisons, but not designed as an always-on contract store + history + alerting + dashboard system that can be called from application code or CI.

SchemaDrift was created to occupy the gap: a lightweight, TypeScript-native system that lets you **define a data contract once**, continuously compare live payloads against it, persist history, and alert on drift — with a pure library core that can also be embedded.

The one-line pitch that guided the project:

> Define data contracts once. Know the instant something changes.

The primary audience is forward-deployed / platform / data engineers who get paged at 3 a.m. because a field changed.

---

## Initial vision (first commit)

The very first push established the complete shape of the product:

- **Monorepo** with three packages:
  - `packages/core` — pure TypeScript library (diff engine, schema inference, alerting)
  - `packages/api` — Hono REST API + SQLite storage
  - `packages/dashboard` — React + Vite web UI
- Contract-centric model (not just “diff two schemas”)
- Ability to infer a schema from real payloads
- Drift reports with severity classification
- Persistent history of checks
- Alerting hooks (Slack, generic webhook, PagerDuty)
- Demo seed data so the dashboard is immediately useful

The initial commit already contained the core ideas that survived:

- Contracts live as first-class entities with environment, source type, tolerance (planned), and alert configuration.
- The library is usable independently of the server.
- The server is a thin layer on top of the library + SQLite.
- The dashboard is a consumer of the API, not a tightly-coupled frontend.

Everything after the initial commit was refinement of inference quality, seed realism, and edge-case handling — not a change of direction.

---

## What SchemaDrift actually is

The tempting description is “another schema diff tool.” That framing puts it in competition with dozens of OpenAPI / JSON Schema differs. SchemaDrift is deliberately positioned differently:

- It is a **data-contract store + continuous drift detector**.
- The unit of management is the *contract*, not a one-off file comparison.
- It keeps history, supports multiple environments, and can fire alerts.
- The core is a pure library so the same logic can run inside application code, CI, or the server.

## Architecture at a glance:

Data Sources (APIs, Kafka, DB, webhooks)
│
▼
@schema-drift/core  (infer + diff + alert)
│
▼
Contract Store + Diff Engine  (SQLite via API)
│
▼
Alerting + Dashboard UI


Monorepo packages:

- `packages/core` — pure library, zero Node-specific runtime requirements beyond what the caller provides
- `packages/api` — Hono server + better-sqlite3
- `packages/dashboard` — React 18 + Vite

---

## Technical decisions

### 1. Monorepo with npm workspaces (not Turborepo / Nx / pnpm initially)

**Chosen:** classic npm workspaces + concurrent dev scripts.

**Rejected:** full Turborepo/Nx from day one, pnpm exclusive.

**Why:** The project is small (three packages). npm workspaces give enough isolation and shared TypeScript configuration without introducing another build-system dependency that interviewers or future maintainers would have to learn. The root `package.json` scripts (`dev`, `build`, `seed`) are deliberately simple. If the monorepo grows significantly, migrating to Turborepo is straightforward because the package boundaries are already clean.

### 2. Pure TypeScript core library first

**Chosen:** `@schema-drift/core` contains *all* domain logic (inference, diffing, alerting). The API and dashboard are thin consumers.

**Why:** This mirrors the “library + optional server” pattern that makes a project reusable. A consumer can `import { diffSchemas, inferSchema, fireAlerts } from '@schema-drift/core'` and never stand up the HTTP server. The same logic is used by the API routes, the seed script, and any future CI action or SDK.

**Consequence:** Internal types (`SchemaField`, `DriftChange`, `DriftReport`, etc.) are carefully designed so they can be serialized to JSON and stored without leakage of implementation details.

### 3. Custom schema model instead of raw JSON Schema / OpenAPI

**Chosen:** A purpose-built `ContractSchema` + `SchemaField` type that captures exactly the attributes needed for drift detection:

- `type` (including union types)
- `nullable` / `required`
- `enum`
- `format`
- nested `properties` and array `items` / `tupleItems`
- `arrayItemKind: 'homogeneous' | 'tuple'`

**Rejected:** Treating arbitrary JSON Schema or OpenAPI documents as the source of truth from day one.

**Why:** Full JSON Schema is extremely expressive and contains many features (allOf, oneOf, $ref, patternProperties, etc.) that complicate a reliable structural diff. The goal was a focused, predictable contract language that is easy to infer from live payloads and easy to explain. Mapping from OpenAPI / JSON Schema can be added later as an import path without changing the core engine.

The model deliberately records both `nullable` and `required` as first-class booleans because they have opposite severity implications depending on the direction of change.

### 4. Schema inference from live payloads (not only static schemas)

**Chosen:** `inferSchema(payloads, options)` that merges multiple samples into a single `ContractSchema`.

**Key design points:**

- Presence across samples determines `required`.
- Null values set `nullable`.
- Distinct value cardinality ≤ threshold → enum.
- String format detection (uuid, email, date-time, date, ipv4, ipv6, url) with configurable sample threshold.
- Arrays are classified as homogeneous or tuple based on observed length stability.
- Nested objects are recursively merged.

**Why:** In the real world the “source of truth” is often the live traffic, not a perfectly maintained OpenAPI file. Being able to bootstrap a contract from a handful of real responses (or Kafka messages) dramatically lowers the adoption barrier.

**Options exposed:** `detectEnums`, `enumCardinality`, `detectFormats`, `formatSampleThreshold`, `detectTuples`, `tupleMaxLength`, `tupleMinSamples`. Defaults are conservative enough for demo use and tunable for production.

### 5. Severity model and change taxonomy

The diff engine classifies every change into a concrete type and a severity:

| Change Type            | Typical Severity     | Rationale |
|------------------------|----------------------|---------|
| FIELD_REMOVED          | critical (if required) / warning | Removing a required field breaks consumers |
| TYPE_CHANGED           | critical             | Almost always breaking |
| NULLABILITY_CHANGED    | critical (nullable→non-null) / warning (non-null→nullable) | Direction matters |
| REQUIRED_CHANGED       | critical (optional→required) / info (required→optional) | Direction matters for producers |
| ENUM_VALUE_REMOVED     | critical             | Existing values may be rejected |
| ENUM_VALUE_ADDED       | info                 | Usually safe |
| FIELD_ADDED            | warning (if required) / info | New required fields are more dangerous |
| FORMAT_CHANGED         | warning / info       | Data-quality signal more than hard break |
| STRUCTURE_CHANGED      | critical             | Array shape / tuple length changes |

**Design principle:** Severity is not a global constant; it is derived from the *direction* of the change and whether the field was previously required. This matches how real systems break.

### 6. Recursive structural diff (not string/JSON pointer only)

**Chosen:** Recursive walk of `properties` and array items / tuple positions, producing a flat list of `DriftChange` objects with dotted paths (`profile.tier`, `items[].productId`, `tags[0]`).

**Why:** Flat path-based reports are easy to render in a table, store in SQLite, and send to Slack. Nested objects and arrays are still fully inspected; the recursion is an implementation detail of the engine, not of the public report format.

### 7. SQLite + better-sqlite3 for the contract store

**Chosen:** Embedded SQLite with WAL mode, foreign keys, and a simple schema:

- `contracts` table (id, name, source, environment, schema_json, alerts_json, status, …)
- `drift_reports` table (linked by contract_id, stores full change list + summary + optional payload)

**Rejected (for v1):** Postgres, Redis, or an external document store.

**Why:** Zero-ops local development, single-file durability, excellent concurrent read performance with WAL, and trivial backup. The data volume of contracts + drift history is tiny compared with typical application databases. better-sqlite3 is synchronous and fast, which matches the request/response nature of the Hono handlers.

**Pragmas used:** `journal_mode = WAL`, `foreign_keys = ON`.

**Trade-off accepted:** Horizontal scaling of the API would eventually require a different store. For the current scope (single-node, demo + small team use) SQLite is the correct choice.

### 8. Hono as the HTTP framework

**Chosen:** Hono + `@hono/node-server`.

**Rejected:** Express, Fastify, NestJS for the initial server.

**Why:** Extremely small, TypeScript-first, modern middleware model, excellent performance, and easy to run both on Node and (later) on edge runtimes. The routing surface is tiny (`/api/contracts`, `/api/checks`, `/api/history`, `/api/stats`), so framework features beyond routing, CORS, and logging were not needed.

### 9. Alerting is fire-and-forget and non-blocking

**Chosen:** `fireAlerts(alerts, report)` runs in the background; errors are logged, never thrown to the caller of the check endpoint.

**Why:** A slow or failing Slack / PagerDuty webhook must never make the check API itself fail or hang. The check response returns immediately with the drift report; alerting is best-effort.

Supported channels from day one: Slack (Block Kit), generic webhook, PagerDuty Events API v2. Severity filtering is per-alert (`onSeverity`).

### 10. Dashboard is a pure consumer of the API

**Chosen:** React 18 + Vite, talking only to the REST API. No shared database connection, no server-side rendering in v1.

**Why:** Clear separation of concerns. The dashboard can be replaced or extended independently. Demo seed data makes the UI immediately useful after `npm run seed`.

### 11. Seed data is a first-class design artifact

The second commit (“Improve AST Parser” — actually a large improvement to seed realism and inference usage) heavily expanded the seed script:

- Multiple contracts covering REST, Kafka-style events, database rows, webhooks, SQS.
- Realistic payload sequences that demonstrate field additions, type changes, nullability flips, enum value introduction, etc.
- A helper that syncs observed schemas with baseline enums so the demo history looks coherent.

**Why:** A dashboard with empty tables teaches nothing. The seed data is deliberately written so that after seeding a user can open the UI and immediately see critical / warning / info drift examples.

### 12. Route ordering and API design discipline

`POST /api/checks/infer` is registered *before* `POST /api/checks/:contractId` to avoid parameter shadowing. This is a small but deliberate decision that prevents a class of routing bugs that appear in many Hono / Express codebases.

All public API responses are plain JSON; the core library never depends on HTTP types.

### 13. No authentication / multi-tenancy in v1

**Chosen:** Open local API.

**Why:** The immediate goal was a working end-to-end system that demonstrates the contract → infer → diff → history → alert loop. Adding auth, organisations, or RBAC would have expanded scope dramatically. The architecture leaves room for it later (contracts already have an `environment` field and tags).

### 14. Tolerance configuration is modelled but not fully enforced yet

The `ToleranceConfig` type exists (`ignoreAdditionalFields`, `allowNullToNonNull`, etc.) and is stored on contracts. The current diff engine does not yet fully honour every flag. This is intentional: the data model anticipates the feature so that enabling it later does not require a schema migration.

### 15. Testing strategy (emergent)

Unit tests live next to the core engine (`diff-engine.test.ts`, `schema-infer.test.ts`). The seed script itself acts as an integration smoke test of the full pipeline. Full end-to-end browser tests were deliberately deferred until the core behaviour stabilised.

---

## Difficulties encountered and how they were resolved

1. **Inference vs. baseline enum mismatch**  
   When a single payload is inferred, an enum field that only sees one value collapses to a singleton enum (or loses the enum). The seed helper had to re-attach the full baseline enum (and merge newly observed values) so that enum-addition / removal drift could be demonstrated correctly. This led to the `syncObservedWithBaseline` helper in the seed script.

2. **Array shape ambiguity**  
   Distinguishing homogeneous arrays from tuples requires looking at length stability across samples. Defaults (`tupleMinSamples = 5`, `tupleMaxLength = 20`) were chosen after experimenting with real-looking payloads; too aggressive tuple detection produced noisy `STRUCTURE_CHANGED` reports.

3. **Severity directionality**  
   Early versions treated any nullability or required change as critical. Real-world reasoning forced the more nuanced rules (optional→required is critical for producers; non-null→nullable is usually only a warning). Encoding the directionality made the report messages far more useful.

4. **Route shadowing**  
   A classic Hono gotcha: registering `/:contractId` before `/infer` caused the literal path to be captured as a contract ID. Fixed by explicit registration order and a comment explaining why.

5. **Demo data realism**  
   The first seed produced mostly healthy contracts. The second commit invested heavily in multi-day payload sequences that actually trigger the different change types, so the dashboard and history views become educational rather than empty.

6. **Keeping the core pure**  
   Temptation existed to put SQLite or Hono types inside `packages/core`. Resisted: the core must remain usable in any JavaScript runtime that can run TypeScript (or the compiled JS). All I/O and persistence live in the API package.

---

## What was deliberately left out (roadmap items)

These are recorded so that future work does not re-litigate decisions already made:

- Auto-import from OpenAPI / JSON Schema / Protobuf / Avro
- Full tolerance rule engine
- Adapter / migration stub code generation
- Multi-environment strictness levels
- Semantic (embedding-based) drift detection
- GitHub PR bot
- Agent-framework tool-schema sync (LangChain, CrewAI, etc.)
- Horizontal scaling of the store
- Authentication and multi-tenancy

Each of these can be added without breaking the existing contract model or the pure-library boundary.

---

## Summary of the guiding principles

1. **Library first, server second.** The core must be embeddable.
2. **Contracts are the unit of management**, not one-off file diffs.
3. **Severity must be direction-aware.**
4. **Inference from live data is a first-class feature**, not an afterthought.
5. **Zero-ops local experience** (SQLite + single `npm run dev`).
6. **Alerting must never block the check path.**
7. **Demo data is part of the product.**
8. **Every public type is designed for JSON serialisation and long-term storage.**

These principles explain virtually every concrete choice in the repository.

---

*This document is the authoritative record of architectural intent for SchemaDrift. When in doubt, prefer the reasoning here over any ad-hoc comment in the code.*