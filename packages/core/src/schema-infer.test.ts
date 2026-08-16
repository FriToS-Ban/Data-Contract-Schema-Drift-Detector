import { describe, it } from 'node:test';
import assert from 'node:assert';
import { inferSchema } from './schema-infer.js';

describe('schema-infer Bug Fixes', () => {
  it('1. inferSchema on array of objects captures object properties in field.items.properties', () => {
    const payloads = [
      { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
      { users: [{ id: 3, name: 'Charlie' }] },
    ];
    const schema = inferSchema(payloads);
    const usersField = schema.properties.users;

    assert.strictEqual(usersField.type, 'array');
    assert.strictEqual(usersField.arrayItemKind, 'homogeneous');
    assert.ok(usersField.items);
    assert.strictEqual(usersField.items.type, 'object');
    assert.ok(usersField.items.properties);
    assert.ok(usersField.items.properties.id);
    assert.ok(usersField.items.properties.name);
    assert.strictEqual(usersField.items.properties.id.type, 'integer');
    assert.strictEqual(usersField.items.properties.name.type, 'string');
    assert.strictEqual(usersField.items.required, false);
  });

  it('2. inferSchema on array-of-array-of-objects captures nested properties at correct depth', () => {
    const payloads = [
      { matrix: [[{ id: 101, title: 'Item 1' }]] },
      { matrix: [[{ id: 102 }], [{ id: 103, title: 'Item 3' }]] },
    ];
    const schema = inferSchema(payloads, { detectTuples: false });
    const matrixField = schema.properties.matrix;

    assert.strictEqual(matrixField.type, 'array');
    assert.ok(matrixField.items);
    assert.strictEqual(matrixField.items.type, 'array');
    assert.ok(matrixField.items.items);
    assert.strictEqual(matrixField.items.items.type, 'object');
    assert.ok(matrixField.items.items.properties);
    assert.ok(matrixField.items.items.properties.id);
    assert.ok(matrixField.items.items.properties.title);
    assert.strictEqual(matrixField.items.items.properties.id.type, 'integer');
    assert.strictEqual(matrixField.items.items.properties.title.type, 'string');
  });

  it('3. inferSchema on multiple payloads with same array field at different lengths', () => {
    const payloads = [
      { tags: ['a', 'b'] },
      { tags: ['c', 'd', 'e'] },
    ];
    const schema = inferSchema(payloads);
    const tagsField = schema.properties.tags;

    assert.strictEqual(tagsField.type, 'array');
    assert.strictEqual(tagsField.arrayItemKind, 'homogeneous');
    assert.ok(tagsField.items);
    assert.strictEqual(tagsField.items.type, 'string');
    assert.strictEqual(tagsField.items.required, false);
  });
});

describe('schema-infer Format Detection', () => {
  it('4. All string values valid UUIDs -> field.format === "uuid"', () => {
    const payloads = [
      { id: '123e4567-e89b-12d3-a456-426614174000' },
      { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' },
    ];
    const schema = inferSchema(payloads);
    assert.strictEqual(schema.properties.id.format, 'uuid');
  });

  it('5. All string values valid emails -> field.format === "email"', () => {
    const payloads = [
      { contact: 'alice@example.com' },
      { contact: 'bob@test.co.uk' },
    ];
    const schema = inferSchema(payloads);
    assert.strictEqual(schema.properties.contact.format, 'email');
  });

  it('6. Mixed valid/invalid dates below threshold -> field.format is undefined', () => {
    const payloads = [
      { createdAt: '2026-08-17' },
      { createdAt: 'not-a-date' },
    ];
    const schema = inferSchema(payloads, { formatSampleThreshold: 1.0 });
    assert.strictEqual(schema.properties.createdAt.format, undefined);
  });

  it('7. A field that is sometimes string sometimes number -> field.format is undefined', () => {
    const payloads = [
      { code: '123e4567-e89b-12d3-a456-426614174000' },
      { code: 404 },
    ];
    const schema = inferSchema(payloads);
    assert.strictEqual(schema.properties.code.format, undefined);
  });

  it('8. detectFormats: false -> field.format always undefined', () => {
    const payloads = [
      { id: '123e4567-e89b-12d3-a456-426614174000' },
    ];
    const schema = inferSchema(payloads, { detectFormats: false });
    assert.strictEqual(schema.properties.id.format, undefined);
  });
});

describe('schema-infer Tuple Detection', () => {
  it('9. Always 2-element array [string, number] -> arrayItemKind === "tuple", tupleItems length 2 (with tupleMinSamples: 2)', () => {
    const payloads = [
      { pair: ['label1', 10] },
      { pair: ['label2', 20] },
    ];
    const schema = inferSchema(payloads, { tupleMinSamples: 2 });
    const pairField = schema.properties.pair;

    assert.strictEqual(pairField.type, 'array');
    assert.strictEqual(pairField.arrayItemKind, 'tuple');
    assert.strictEqual(pairField.items, undefined);
    assert.ok(pairField.tupleItems);
    assert.strictEqual(pairField.tupleItems.length, 2);
    assert.strictEqual(pairField.tupleItems[0].type, 'string');
    assert.strictEqual(pairField.tupleItems[1].type, 'integer');
  });

  it('10. Array of varying length across payloads -> arrayItemKind === "homogeneous"', () => {
    const payloads = [
      { data: [1, 2] },
      { data: [1, 2, 3] },
    ];
    const schema = inferSchema(payloads);
    const dataField = schema.properties.data;

    assert.strictEqual(dataField.type, 'array');
    assert.strictEqual(dataField.arrayItemKind, 'homogeneous');
    assert.ok(dataField.items);
    assert.strictEqual(dataField.tupleItems, undefined);
  });

  it('11. detectTuples: false -> always homogeneous even if lengths are constant', () => {
    const payloads = [
      { point: [1.5, 2.5] },
      { point: [3.5, 4.5] },
    ];
    const schema = inferSchema(payloads, { detectTuples: false });
    const pointField = schema.properties.point;

    assert.strictEqual(pointField.type, 'array');
    assert.strictEqual(pointField.arrayItemKind, 'homogeneous');
    assert.ok(pointField.items);
    assert.strictEqual(pointField.tupleItems, undefined);
  });

  it('12. Single payload with array longer than tupleMaxLength -> falls back to homogeneous', () => {
    const longArray = Array.from({ length: 25 }, (_, i) => i);
    const payloads = [{ list: longArray }];
    const schema = inferSchema(payloads, { tupleMaxLength: 20 });
    const listField = schema.properties.list;

    assert.strictEqual(listField.type, 'array');
    assert.strictEqual(listField.arrayItemKind, 'homogeneous');
    assert.ok(listField.items);
    assert.strictEqual(listField.tupleItems, undefined);
  });

  it('13. Consistent length 2 across 3 sample payloads (< tupleMinSamples 5) -> produces homogeneous', () => {
    const payloads = [
      { pair: ['a', 1] },
      { pair: ['b', 2] },
      { pair: ['c', 3] },
    ];
    const schema = inferSchema(payloads); // uses default tupleMinSamples = 5
    const pairField = schema.properties.pair;

    assert.strictEqual(pairField.type, 'array');
    assert.strictEqual(pairField.arrayItemKind, 'homogeneous');
    assert.ok(pairField.items);
    assert.strictEqual(pairField.tupleItems, undefined);
  });

  it('14. Consistent length 2 across 6 sample payloads (>= tupleMinSamples 5) -> produces tuple', () => {
    const payloads = [
      { pair: ['a', 1] },
      { pair: ['b', 2] },
      { pair: ['c', 3] },
      { pair: ['d', 4] },
      { pair: ['e', 5] },
      { pair: ['f', 6] },
    ];
    const schema = inferSchema(payloads); // uses default tupleMinSamples = 5
    const pairField = schema.properties.pair;

    assert.strictEqual(pairField.type, 'array');
    assert.strictEqual(pairField.arrayItemKind, 'tuple');
    assert.strictEqual(pairField.items, undefined);
    assert.ok(pairField.tupleItems);
    assert.strictEqual(pairField.tupleItems.length, 2);
    assert.strictEqual(pairField.tupleItems[0].type, 'string');
    assert.strictEqual(pairField.tupleItems[1].type, 'integer');
  });
});
