// ─── Shared frontend types (mirrors core types for use without bundling) ───────

export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'array' | 'object' | 'unknown';

export interface SchemaField {
  type: FieldType | FieldType[];
  nullable: boolean;
  required: boolean;
  description?: string;
  items?: SchemaField;
  properties?: Record<string, SchemaField>;
  enum?: (string | number | boolean | null)[];
  format?: string;
}

export interface ContractSchema {
  version: string;
  properties: Record<string, SchemaField>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

export type SourceType = 'rest' | 'graphql' | 'kafka' | 'webhook' | 'database' | 'sqs' | 'pubsub';

export interface ContractSource {
  type: SourceType;
  url?: string;
  method?: string;
  topic?: string;
  table?: string;
  database?: string;
}

export interface Contract {
  id: string;
  name: string;
  description?: string;
  source: ContractSource;
  environment: string;
  schema: ContractSchema;
  tolerance?: Record<string, unknown>;
  alerts?: AlertConfig[];
  tags?: string[];
  status: 'healthy' | 'drifted' | 'unknown';
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertConfig {
  type: 'slack' | 'webhook' | 'pagerduty';
  url?: string;
  routingKey?: string;
  name?: string;
  onSeverity?: string[];
}

export type DriftSeverity = 'critical' | 'warning' | 'info';

export interface DriftChange {
  path: string;
  changeType: string;
  severity: DriftSeverity;
  before?: unknown;
  after?: unknown;
  message: string;
}

export interface DriftReport {
  id: string;
  contractId: string;
  contractName: string;
  environment: string;
  detectedAt: string;
  hasDrift: boolean;
  changes: DriftChange[];
  summary: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface Stats {
  totalContracts: number;
  healthyContracts: number;
  driftedContracts: number;
  unknownContracts: number;
  driftsToday: number;
  totalChecks: number;
  criticalOpen: number;
  last7Days: { date: string; count: number }[];
  topDrifters: { contract_id: string; contract_name: string; drift_count: number }[];
}
