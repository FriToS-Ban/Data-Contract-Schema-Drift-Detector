import { ContractSchema, FieldType, InferOptions, SchemaField } from './types.js';

/**
 * Infer a ContractSchema from one or more JSON payload samples.
 * Merges all samples so the resulting schema is the union of all observed shapes.
 */
export function inferSchema(
  payloads: unknown[],
  opts: InferOptions = {},
): ContractSchema {
  const {
    detectEnums = true,
    enumCardinality = 10,
    schemaVersion = '1.0.0',
    description,
  } = opts;

  if (payloads.length === 0) {
    return { version: schemaVersion, properties: {}, description };
  }

  // Merge all payloads into a unified field map
  const merged = mergePayloads(payloads);
  const properties = buildProperties(merged, detectEnums, enumCardinality);

  return {
    version: schemaVersion,
    properties,
    description,
  };
}

// ─── Internal merge types ─────────────────────────────────────────────────────

interface FieldStats {
  types: Set<string>;
  nullable: boolean;
  presentCount: number;
  totalCount: number;
  values: unknown[]; // collected for enum detection
  nestedStats?: Map<string, FieldStats>;
  itemStats?: FieldStats; // for arrays
}

function mergePayloads(payloads: unknown[]): Map<string, FieldStats> {
  const total = payloads.length;
  const map = new Map<string, FieldStats>();

  for (const payload of payloads) {
    if (typeof payload !== 'object' || payload === null) continue;
    mergeObject(payload as Record<string, unknown>, map, total);
  }

  return map;
}

function mergeObject(
  obj: Record<string, unknown>,
  map: Map<string, FieldStats>,
  total: number,
): void {
  for (const [key, val] of Object.entries(obj)) {
    if (!map.has(key)) {
      map.set(key, {
        types: new Set(),
        nullable: false,
        presentCount: 0,
        totalCount: total,
        values: [],
      });
    }
    const stats = map.get(key)!;
    stats.presentCount++;

    if (val === null || val === undefined) {
      stats.nullable = true;
      stats.types.add('null');
    } else {
      const t = jsTypeToFieldType(val);
      stats.types.add(t);
      stats.values.push(val);

      if (t === 'object' && typeof val === 'object') {
        if (!stats.nestedStats) stats.nestedStats = new Map();
        mergeObject(
          val as Record<string, unknown>,
          stats.nestedStats,
          total,
        );
      }

      if (t === 'array' && Array.isArray(val)) {
        if (!stats.itemStats) {
          stats.itemStats = {
            types: new Set(),
            nullable: false,
            presentCount: 0,
            totalCount: val.length,
            values: [],
          };
        }
        for (const item of val) {
          const itemType = jsTypeToFieldType(item);
          stats.itemStats.types.add(itemType);
          stats.itemStats.presentCount++;
          if (item === null) stats.itemStats.nullable = true;
          else stats.itemStats.values.push(item);
        }
      }
    }
  }
}

// ─── Build SchemaField from stats ────────────────────────────────────────────

function buildProperties(
  map: Map<string, FieldStats>,
  detectEnums: boolean,
  enumCardinality: number,
): Record<string, SchemaField> {
  const props: Record<string, SchemaField> = {};

  for (const [key, stats] of map.entries()) {
    props[key] = buildField(stats, detectEnums, enumCardinality);
  }

  return props;
}

function buildField(
  stats: FieldStats,
  detectEnums: boolean,
  enumCardinality: number,
): SchemaField {
  const required = stats.presentCount === stats.totalCount;
  const nullable = stats.nullable;

  // Collect non-null types
  const types = [...stats.types].filter((t) => t !== 'null') as FieldType[];
  const type: FieldType | FieldType[] =
    types.length === 1 ? types[0] : types.length === 0 ? 'unknown' : types;

  const field: SchemaField = {
    type,
    nullable,
    required,
  };

  // Enum detection
  if (detectEnums && !['object', 'array', 'unknown'].includes(String(type))) {
    const unique = [...new Set(stats.values.map(String))];
    if (unique.length <= enumCardinality && unique.length > 0) {
      field.enum = [...new Set(stats.values)] as (string | number | boolean | null)[];
    }
  }

  // Nested object
  if (types.includes('object') && stats.nestedStats) {
    field.properties = buildProperties(stats.nestedStats, detectEnums, enumCardinality);
  }

  // Array items
  if (types.includes('array') && stats.itemStats) {
    field.items = buildField(stats.itemStats, detectEnums, enumCardinality);
  }

  return field;
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

function jsTypeToFieldType(val: unknown): FieldType {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'string') return 'string';
  if (t === 'boolean') return 'boolean';
  if (t === 'number') {
    return Number.isInteger(val as number) ? 'integer' : 'number';
  }
  if (t === 'object') return 'object';
  return 'unknown';
}
