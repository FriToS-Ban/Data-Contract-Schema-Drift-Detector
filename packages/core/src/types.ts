// ─── Primitive & Field Types ──────────────────────────────────────────────────

export type PrimitiveType = 'string' | 'number' | 'integer' | 'boolean' | 'null';
export type ComplexType = 'array' | 'object';
export type FieldType = PrimitiveType | ComplexType | 'unknown';

export interface SchemaField {
  type: FieldType | FieldType[];
  nullable: boolean;
  required: boolean;
  description?: string;
  items?: SchemaField; // for arrays
  properties?: Record<string, SchemaField>; // for objects
  enum?: (string | number | boolean | null)[];
  format?: string; // "date-time", "email", "uuid", etc.
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  example?: unknown;
}

// ─── Contract Definition ──────────────────────────────────────────────────────

export interface ContractSchema {
  version: string;
  properties: Record<string, SchemaField>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

export type SourceType =
  | 'rest'
  | 'graphql'
  | 'kafka'
  | 'webhook'
  | 'database'
  | 'sqs'
  | 'pubsub';

export interface ContractSource {
  type: SourceType;
  url?: string;
  method?: string;
  topic?: string;
  table?: string;
  database?: string;
  headers?: Record<string, string>;
}

export interface ToleranceConfig {
  ignoreAdditionalFields?: boolean;
  allowNullToNonNull?: boolean;
  allowNonNullToNull?: boolean;
  ignoreDescriptionChanges?: boolean;
}

export type AlertType = 'slack' | 'webhook' | 'pagerduty';

export interface AlertConfig {
  type: AlertType;
  url?: string;
  routingKey?: string;
  onSeverity?: DriftSeverity[];
  name?: string;
}

export interface Contract {
  id: string;
  name: string;
  description?: string;
  source: ContractSource;
  schema: ContractSchema;
  environment: 'development' | 'staging' | 'production' | string;
  tolerance?: ToleranceConfig;
  alerts?: AlertConfig[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  status: 'healthy' | 'drifted' | 'unknown';
}

// ─── Drift Detection ──────────────────────────────────────────────────────────

export type DriftSeverity = 'critical' | 'warning' | 'info';

export type DriftChangeType =
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'TYPE_CHANGED'
  | 'NULLABILITY_CHANGED'
  | 'ENUM_VALUE_ADDED'
  | 'ENUM_VALUE_REMOVED'
  | 'REQUIRED_CHANGED'
  | 'STRUCTURE_CHANGED'
  | 'ARRAY_ITEM_TYPE_CHANGED'
  | 'FORMAT_CHANGED';

export interface DriftChange {
  path: string;
  changeType: DriftChangeType;
  severity: DriftSeverity;
  before?: unknown;
  after?: unknown;
  message: string;
}

export interface DriftReport {
  id: string;
  contractId: string;
  contractName: string;
  detectedAt: string;
  environment: string;
  hasDrift: boolean;
  changes: DriftChange[];
  summary: string;
  payload?: unknown;
  observedSchemaSnapshot?: ContractSchema;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface CheckResult {
  valid: boolean;
  contractId: string;
  contractName: string;
  driftReport: DriftReport;
  checkedAt: string;
  durationMs: number;
}

// ─── Schema Inference ─────────────────────────────────────────────────────────

export interface InferOptions {
  detectEnums?: boolean;
  enumCardinality?: number; // treat as enum if distinct values <= this (default: 10)
  strictNullability?: boolean;
  schemaVersion?: string;
  description?: string;
}
