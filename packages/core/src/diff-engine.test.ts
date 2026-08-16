import { describe, it } from 'node:test';
import assert from 'node:assert';
import { diffSchemas } from './diff-engine.js';
import { ContractSchema } from './types.js';

describe('diff-engine Format Change Severity', () => {
  it('1. base.format undefined, obs.format "uuid" -> exactly one change, FORMAT_CHANGED, severity info', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        id: { type: 'string', nullable: false, required: true },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        id: { type: 'string', nullable: false, required: true, format: 'uuid' },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'FORMAT_CHANGED');
    assert.strictEqual(report.changes[0].severity, 'info');
    assert.match(report.changes[0].message, /was inferred as 'uuid'/);
  });

  it('2. base.format "email", obs.format undefined -> one change, FORMAT_CHANGED, severity warning', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        email: { type: 'string', nullable: false, required: true, format: 'email' },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        email: { type: 'string', nullable: false, required: true },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'FORMAT_CHANGED');
    assert.strictEqual(report.changes[0].severity, 'warning');
    assert.match(report.changes[0].message, /no longer detected as 'email'/);
  });

  it('3. base.format "email", obs.format "uuid" -> one change, severity warning', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        val: { type: 'string', nullable: false, required: true, format: 'email' },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        val: { type: 'string', nullable: false, required: true, format: 'uuid' },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'FORMAT_CHANGED');
    assert.strictEqual(report.changes[0].severity, 'warning');
    assert.match(report.changes[0].message, /changed: email → uuid/);
  });

  it('4. base.format and obs.format both undefined -> no FORMAT_CHANGED change', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        name: { type: 'string', nullable: false, required: true },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        name: { type: 'string', nullable: false, required: true },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 0);
  });
});

describe('diff-engine Tuple vs Homogeneous Array Diffing', () => {
  it('5. Both fields homogeneous arrays of same item type -> behaves exactly as before', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        tags: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'homogeneous',
          items: { type: 'string', nullable: false, required: false },
        },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        tags: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'homogeneous',
          items: { type: 'string', nullable: false, required: false },
        },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 0);
  });

  it('6. base tuple ["string","number"], obs tuple ["string","number"] with nullability change on index 1 -> NULLABILITY_CHANGED at path[1]', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        pair: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'tuple',
          tupleItems: [
            { type: 'string', nullable: false, required: true },
            { type: 'number', nullable: false, required: true },
          ],
        },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        pair: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'tuple',
          tupleItems: [
            { type: 'string', nullable: false, required: true },
            { type: 'number', nullable: true, required: true },
          ],
        },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'NULLABILITY_CHANGED');
    assert.strictEqual(report.changes[0].path, 'pair[1]');
  });

  it('7. base tuple length 2, obs tuple length 3 -> one STRUCTURE_CHANGED critical change (2 -> 3), no index 2 change', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        coords: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'tuple',
          tupleItems: [
            { type: 'number', nullable: false, required: true },
            { type: 'number', nullable: false, required: true },
          ],
        },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        coords: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'tuple',
          tupleItems: [
            { type: 'number', nullable: false, required: true },
            { type: 'number', nullable: false, required: true },
            { type: 'number', nullable: false, required: true },
          ],
        },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'STRUCTURE_CHANGED');
    assert.strictEqual(report.changes[0].severity, 'critical');
    assert.strictEqual(report.changes[0].before, 2);
    assert.strictEqual(report.changes[0].after, 3);
    assert.match(report.changes[0].message, /Tuple length of 'coords' changed: 2 → 3/);
  });

  it('8. base arrayItemKind "tuple", obs arrayItemKind "homogeneous" -> one STRUCTURE_CHANGED critical change', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        data: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'tuple',
          tupleItems: [{ type: 'string', nullable: false, required: true }],
        },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        data: {
          type: 'array',
          nullable: false,
          required: true,
          arrayItemKind: 'homogeneous',
          items: { type: 'string', nullable: false, required: false },
        },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'STRUCTURE_CHANGED');
    assert.strictEqual(report.changes[0].severity, 'critical');
    assert.strictEqual(report.changes[0].before, 'tuple');
    assert.strictEqual(report.changes[0].after, 'homogeneous');
    assert.match(report.changes[0].message, /Array shape of 'data' changed from tuple to homogeneous/);
  });

  it('9. SchemaField with arrayItemKind undefined on both sides -> behaves like homogeneous (backward compatibility)', () => {
    const baseline: ContractSchema = {
      version: '1.0.0',
      properties: {
        list: {
          type: 'array',
          nullable: false,
          required: true,
          items: { type: 'string', nullable: false, required: false },
        },
      },
    };
    const observed: ContractSchema = {
      version: '1.0.0',
      properties: {
        list: {
          type: 'array',
          nullable: false,
          required: true,
          items: { type: 'number', nullable: false, required: false },
        },
      },
    };

    const report = diffSchemas({
      contractId: 'c1',
      contractName: 'Test Contract',
      environment: 'dev',
      baseline,
      observed,
    });

    assert.strictEqual(report.changes.length, 1);
    assert.strictEqual(report.changes[0].changeType, 'TYPE_CHANGED');
    assert.strictEqual(report.changes[0].path, 'list[]');
  });
});
