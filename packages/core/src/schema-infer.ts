import { ContractSchema, FieldType, InferOptions, SchemaField } from './types.js';

/**
 * Infer a ContractSchema from one or more JSON payload samples.
 * Merges all samples so the resulting schema is the union of all observed shapes.
 */
export function inferSchema(
  payloads: unknown[],
  opts: InferOptions = {},
): ContractSchema {
  const { schemaVersion = '1.0.0', description } = opts;

  if (payloads.length === 0) {
    return { version: schemaVersion, properties: {}, description };
  }

  // Merge all payloads into a unified field map
  const merged = mergePayloads(payloads);
  const properties = buildProperties(merged, opts);

  return {
    version: schemaVersion,
    properties,
    description,
  };
}

// ─── Format Detection ─────────────────────────────────────────────────────────

const FORMAT_TESTS: { name: string; test: (v: string) => boolean }[] = [
  {
    name: 'uuid',
    test: (v) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        v,
      ),
  },
  {
    name: 'date-time',
    test: (v) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(
        v,
      ),
  },
  {
    name: 'date',
    test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  },
  {
    name: 'ipv4',
    test: (v) => {
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return false;
      const octets = v.split('.').map(Number);
      return octets.every((o) => o >= 0 && o <= 255);
    },
  },
  {
    name: 'ipv6',
    test: (v) => /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(v),
  },
  {
    name: 'email',
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    name: 'url',
    test: (v) => /^https?:\/\/\S+$/.test(v),
  },
];

export function detectFormat(
  values: string[],
  threshold: number,
): string | undefined {
  if (values.length === 0) return undefined;
  for (const { name, test } of FORMAT_TESTS) {
    let matchCount = 0;
    for (const val of values) {
      if (test(val)) matchCount++;
    }
    if (matchCount / values.length >= threshold) {
      return name;
    }
  }
  return undefined;
}

// ─── Internal merge types ─────────────────────────────────────────────────────

interface FieldStats {
  types: Set<string>;
  nullable: boolean;
  presentCount: number;
  totalCount: number;
  values: unknown[]; // collected for enum & format detection
  nestedStats?: Map<string, FieldStats>;
  itemStats?: FieldStats; // for homogeneous arrays
  tupleIndexStats?: FieldStats[]; // for tuple arrays
  arrayObservedLengths?: number[];
}

function createFieldStats(totalCount: number): FieldStats {
  return {
    types: new Set(),
    nullable: false,
    presentCount: 0,
    totalCount,
    values: [],
  };
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
      map.set(key, createFieldStats(total));
    }
    const stats = map.get(key)!;
    mergeValueIntoStats(val, stats, false, total);
  }
}

function mergeValueIntoStats(
  val: unknown,
  stats: FieldStats,
  isArrayItem: boolean,
  total: number,
): void {
  stats.presentCount++;
  if (isArrayItem) {
    stats.totalCount++;
  }

  if (val === null || val === undefined) {
    stats.nullable = true;
    stats.types.add('null');
    return;
  }

  const t = jsTypeToFieldType(val);
  stats.types.add(t);
  stats.values.push(val);

  if (t === 'object' && typeof val === 'object') {
    if (!stats.nestedStats) stats.nestedStats = new Map();
    mergeObject(val as Record<string, unknown>, stats.nestedStats, total);
  }

  if (t === 'array' && Array.isArray(val)) {
    if (!stats.arrayObservedLengths) stats.arrayObservedLengths = [];
    stats.arrayObservedLengths.push(val.length);

    if (!stats.itemStats) {
      stats.itemStats = createFieldStats(0);
    }
    if (!stats.tupleIndexStats) {
      stats.tupleIndexStats = [];
    }

    for (let i = 0; i < val.length; i++) {
      const item = val[i];
      mergeValueIntoStats(item, stats.itemStats, true, total);

      if (!stats.tupleIndexStats[i]) {
        stats.tupleIndexStats[i] = createFieldStats(0);
      }
      mergeValueIntoStats(item, stats.tupleIndexStats[i], true, total);
    }
  }
}

// ─── Build SchemaField from stats ────────────────────────────────────────────

function buildProperties(
  map: Map<string, FieldStats>,
  opts: InferOptions,
): Record<string, SchemaField> {
  const props: Record<string, SchemaField> = {};

  for (const [key, stats] of map.entries()) {
    props[key] = buildField(stats, opts, false);
  }

  return props;
}

function buildField(
  stats: FieldStats,
  opts: InferOptions,
  isHomogeneousItem = false,
): SchemaField {
  const {
    detectEnums = true,
    enumCardinality = 10,
    detectFormats = true,
    formatSampleThreshold = 1.0,
    detectTuples = true,
    tupleMaxLength = 20,
  } = opts;

  const required = isHomogeneousItem
    ? false
    : stats.presentCount === stats.totalCount;
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

  // Format detection
  if (
    detectFormats &&
    types.length === 1 &&
    types[0] === 'string' &&
    stats.values.length > 0
  ) {
    const stringValues = stats.values.filter(
      (v): v is string => typeof v === 'string',
    );
    if (stringValues.length > 0) {
      const fmt = detectFormat(stringValues, formatSampleThreshold);
      if (fmt) {
        field.format = fmt;
      }
    }
  }

  // Enum detection
  if (detectEnums && !['object', 'array', 'unknown'].includes(String(type))) {
    const unique = [...new Set(stats.values.map(String))];
    if (unique.length <= enumCardinality && unique.length > 0) {
      field.enum = [...new Set(stats.values)] as (
        | string
        | number
        | boolean
        | null
      )[];
    }
  }

  // Nested object
  if (types.includes('object') && stats.nestedStats) {
    field.properties = buildProperties(stats.nestedStats, opts);
  }

  // Array items
  if (types.includes('array')) {
    const tupleMinSamples = opts.tupleMinSamples ?? 5;
    const lengths = stats.arrayObservedLengths ?? [];
    const isTupleCandidate =
      detectTuples &&
      lengths.length >= tupleMinSamples &&
      lengths[0] > 0 &&
      lengths[0] <= tupleMaxLength &&
      lengths.every((l) => l === lengths[0]);

    if (isTupleCandidate) {
      const L = lengths[0];
      field.arrayItemKind = 'tuple';
      field.tupleItems = (stats.tupleIndexStats || [])
        .slice(0, L)
        .map((s) => buildField(s, opts, false));
    } else {
      field.arrayItemKind = 'homogeneous';
      if (stats.itemStats) {
        field.items = buildField(stats.itemStats, opts, true);
      }
    }
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
