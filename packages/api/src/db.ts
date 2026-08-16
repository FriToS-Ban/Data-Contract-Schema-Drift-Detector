import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'schema-drift.db');

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Migrations ───────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS contracts (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    source_type   TEXT NOT NULL DEFAULT 'rest',
    source_json   TEXT NOT NULL DEFAULT '{}',
    environment   TEXT NOT NULL DEFAULT 'production',
    schema_json   TEXT NOT NULL,
    tolerance_json TEXT,
    alerts_json   TEXT,
    tags          TEXT,
    status        TEXT NOT NULL DEFAULT 'unknown',
    last_checked_at TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drift_reports (
    id                    TEXT PRIMARY KEY,
    contract_id           TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    contract_name         TEXT NOT NULL,
    environment           TEXT NOT NULL,
    detected_at           TEXT NOT NULL,
    has_drift             INTEGER NOT NULL DEFAULT 0,
    changes_json          TEXT NOT NULL DEFAULT '[]',
    summary               TEXT NOT NULL,
    payload_json          TEXT,
    observed_schema_json  TEXT,
    critical_count        INTEGER NOT NULL DEFAULT 0,
    warning_count         INTEGER NOT NULL DEFAULT 0,
    info_count            INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_drift_contract ON drift_reports(contract_id);
  CREATE INDEX IF NOT EXISTS idx_drift_detected ON drift_reports(detected_at DESC);
`);

// ─── Typed helpers ────────────────────────────────────────────────────────────

export function json<T>(val: T): string {
  return JSON.stringify(val);
}

export function parse<T>(val: string | null | undefined): T | undefined {
  if (!val) return undefined;
  try {
    return JSON.parse(val) as T;
  } catch {
    return undefined;
  }
}
