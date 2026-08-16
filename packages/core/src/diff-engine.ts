import {
  ContractSchema,
  DriftChange,
  DriftReport,
  DriftSeverity,
  SchemaField,
} from './types.js';
import { nanoid } from 'nanoid';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compare a baseline contract schema against an observed schema and produce a
 * full drift report with human-readable messages and severity levels.
 */
export function diffSchemas(opts: {
  contractId: string;
  contractName: string;
  environment: string;
  baseline: ContractSchema;
  observed: ContractSchema;
  payload?: unknown;
}): DriftReport {
  const { contractId, contractName, environment, baseline, observed, payload } = opts;
  const changes: DriftChange[] = [];

  diffProperties(
    baseline.properties ?? {},
    observed.properties ?? {},
    '',
    changes,
  );

  const criticalCount = changes.filter((c) => c.severity === 'critical').length;
  const warningCount = changes.filter((c) => c.severity === 'warning').length;
  const infoCount = changes.filter((c) => c.severity === 'info').length;

  return {
    id: nanoid(),
    contractId,
    contractName,
    detectedAt: new Date().toISOString(),
    environment,
    hasDrift: changes.length > 0,
    changes,
    summary: buildSummary(changes),
    payload,
    observedSchemaSnapshot: observed,
    criticalCount,
    warningCount,
    infoCount,
  };
}

// ─── Property-level Diff ──────────────────────────────────────────────────────

function diffProperties(
  baseline: Record<string, SchemaField>,
  observed: Record<string, SchemaField>,
  pathPrefix: string,
  changes: DriftChange[],
): void {
  const baseKeys = new Set(Object.keys(baseline));
  const obsKeys = new Set(Object.keys(observed));
  const fmt = (key: string) => (pathPrefix ? `${pathPrefix}.${key}` : key);

  // Fields removed (present in baseline, missing in observed)
  for (const key of baseKeys) {
    if (!obsKeys.has(key)) {
      const f = baseline[key];
      changes.push({
        path: fmt(key),
        changeType: 'FIELD_REMOVED',
        severity: f.required ? 'critical' : 'warning',
        before: serializeField(f),
        after: undefined,
        message: `Field '${fmt(key)}' was removed${f.required ? ' ⚠ was required' : ''}`,
      });
    }
  }

  // Fields added (present in observed, missing in baseline)
  for (const key of obsKeys) {
    if (!baseKeys.has(key)) {
      const f = observed[key];
      changes.push({
        path: fmt(key),
        changeType: 'FIELD_ADDED',
        severity: f.required ? 'warning' : 'info',
        before: undefined,
        after: serializeField(f),
        message: `Field '${fmt(key)}' was added${f.required ? ' (required)' : ' (optional)'}`,
      });
    }
  }

  // Fields present in both — recurse into them
  for (const key of baseKeys) {
    if (obsKeys.has(key)) {
      diffField(baseline[key], observed[key], fmt(key), changes);
    }
  }
}

// ─── Field-level Diff ─────────────────────────────────────────────────────────

function diffField(
  base: SchemaField,
  obs: SchemaField,
  path: string,
  changes: DriftChange[],
): void {
  const baseType = normalizeType(base.type);
  const obsType = normalizeType(obs.type);

  // Type change
  if (baseType !== obsType) {
    changes.push({
      path,
      changeType: 'TYPE_CHANGED',
      severity: 'critical',
      before: base.type,
      after: obs.type,
      message: `Type of '${path}' changed: ${baseType} → ${obsType}`,
    });
  }

  // Nullability change
  if (base.nullable !== obs.nullable) {
    // non-nullable → nullable is usually safe; nullable → non-nullable is breaking
    const sev: DriftSeverity = obs.nullable ? 'warning' : 'critical';
    changes.push({
      path,
      changeType: 'NULLABILITY_CHANGED',
      severity: sev,
      before: base.nullable,
      after: obs.nullable,
      message: `'${path}' ${obs.nullable ? 'became nullable' : 'is no longer nullable (breaking)'}`,
    });
  }

  // Required change
  if (base.required !== obs.required) {
    // optional → required is breaking for existing producers; required → optional is safe
    const sev: DriftSeverity = obs.required ? 'critical' : 'info';
    changes.push({
      path,
      changeType: 'REQUIRED_CHANGED',
      severity: sev,
      before: base.required,
      after: obs.required,
      message: `'${path}' is now ${obs.required ? 'required (breaking for producers)' : 'optional'}`,
    });
  }

  // Format change
  if (base.format !== obs.format) {
    if (base.format === undefined && obs.format !== undefined) {
      changes.push({
        path,
        changeType: 'FORMAT_CHANGED',
        severity: 'info',
        before: base.format,
        after: obs.format,
        message: `Format of '${path}' was inferred as '${obs.format}' (no format previously recorded)`,
      });
    } else if (base.format !== undefined && obs.format === undefined) {
      changes.push({
        path,
        changeType: 'FORMAT_CHANGED',
        severity: 'warning',
        before: base.format,
        after: obs.format,
        message: `Format of '${path}' is no longer detected as '${base.format}' — possible data quality drift`,
      });
    } else {
      changes.push({
        path,
        changeType: 'FORMAT_CHANGED',
        severity: 'warning',
        before: base.format,
        after: obs.format,
        message: `Format of '${path}' changed: ${base.format} → ${obs.format}`,
      });
    }
  }

  // Enum drift
  if (base.enum !== undefined || obs.enum !== undefined) {
    const baseEnums = new Set((base.enum ?? []).map(String));
    const obsEnums = new Set((obs.enum ?? []).map(String));

    for (const v of baseEnums) {
      if (!obsEnums.has(v)) {
        changes.push({
          path,
          changeType: 'ENUM_VALUE_REMOVED',
          severity: 'critical',
          before: v,
          after: undefined,
          message: `Enum value '${v}' was removed from '${path}' (breaking)`,
        });
      }
    }
    for (const v of obsEnums) {
      if (!baseEnums.has(v)) {
        changes.push({
          path,
          changeType: 'ENUM_VALUE_ADDED',
          severity: 'info',
          before: undefined,
          after: v,
          message: `Enum value '${v}' was added to '${path}'`,
        });
      }
    }
  }

  // Nested object properties
  if (isObjectType(base) && isObjectType(obs)) {
    diffProperties(base.properties ?? {}, obs.properties ?? {}, path, changes);
  }

  // Array item type / shape
  if (isArrayType(base) && isArrayType(obs)) {
    const baseKind = arrayKind(base);
    const obsKind = arrayKind(obs);

    if (baseKind === 'homogeneous' && obsKind === 'homogeneous') {
      if (base.items && obs.items) {
        diffField(base.items, obs.items, `${path}[]`, changes);
      }
    } else if (baseKind !== obsKind) {
      changes.push({
        path,
        changeType: 'STRUCTURE_CHANGED',
        severity: 'critical',
        before: baseKind,
        after: obsKind,
        message: `Array shape of '${path}' changed from ${baseKind} to ${obsKind} (breaking)`,
      });
    } else if (baseKind === 'tuple' && obsKind === 'tuple') {
      const baseLen = base.tupleItems?.length ?? 0;
      const obsLen = obs.tupleItems?.length ?? 0;

      if (baseLen !== obsLen) {
        changes.push({
          path,
          changeType: 'STRUCTURE_CHANGED',
          severity: 'critical',
          before: baseLen,
          after: obsLen,
          message: `Tuple length of '${path}' changed: ${baseLen} → ${obsLen} (breaking)`,
        });
      }

      const minLen = Math.min(baseLen, obsLen);
      for (let i = 0; i < minLen; i++) {
        if (base.tupleItems && obs.tupleItems) {
          diffField(base.tupleItems[i], obs.tupleItems[i], `${path}[${i}]`, changes);
        }
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function arrayKind(f: SchemaField): 'homogeneous' | 'tuple' {
  return f.arrayItemKind ?? 'homogeneous';
}

function normalizeType(type: SchemaField['type']): string {
  if (Array.isArray(type)) return [...type].sort().join(' | ');
  return String(type);
}

function isObjectType(f: SchemaField): boolean {
  return Array.isArray(f.type) ? f.type.includes('object') : f.type === 'object';
}

function isArrayType(f: SchemaField): boolean {
  return Array.isArray(f.type) ? f.type.includes('array') : f.type === 'array';
}

function serializeField(f: SchemaField): unknown {
  return { type: f.type, nullable: f.nullable, required: f.required, enum: f.enum };
}

function buildSummary(changes: DriftChange[]): string {
  if (changes.length === 0) return 'No drift detected — schema matches contract.';

  const critical = changes.filter((c) => c.severity === 'critical').length;
  const warning = changes.filter((c) => c.severity === 'warning').length;
  const info = changes.filter((c) => c.severity === 'info').length;

  const parts: string[] = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (warning > 0) parts.push(`${warning} warning${warning > 1 ? 's' : ''}`);
  if (info > 0) parts.push(`${info} info`);

  return `${changes.length} change${changes.length !== 1 ? 's' : ''} detected: ${parts.join(', ')}.`;
}
