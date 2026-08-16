import { useState } from 'react';
import type { SchemaField } from '../types';

interface SchemaTreeProps {
  properties: Record<string, SchemaField>;
  depth?: number;
}

const TYPE_CLASS: Record<string, string> = {
  string: 'type-string',
  number: 'type-number',
  integer: 'type-integer',
  boolean: 'type-boolean',
  object: 'type-object',
  array: 'type-array',
  null: 'type-null',
  unknown: 'type-unknown',
};

function FieldNode({ name, field, depth = 0 }: { name: string; field: SchemaField; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const types = Array.isArray(field.type) ? field.type : [field.type];
  const hasChildren = field.properties && Object.keys(field.properties).length > 0;
  const primaryType = types.filter((t) => t !== 'null')[0] ?? types[0];

  return (
    <div>
      <div className="schema-node" style={{ paddingLeft: `${depth * 0.25}rem` }}>
        <span
          className="schema-node-toggle"
          onClick={() => hasChildren && setExpanded((e) => !e)}
          style={{ cursor: hasChildren ? 'pointer' : 'default', color: hasChildren ? 'var(--text-accent)' : 'transparent' }}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : '·'}
        </span>
        <span className="schema-node-key">{name}</span>
        <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>:</span>
        <div className="schema-node-badges">
          {types.map((t, i) => (
            <span key={i} className={`schema-node-type ${TYPE_CLASS[t] ?? 'type-unknown'}`}>
              {t}
            </span>
          ))}
          {field.required && <span className="schema-req" title="required">*</span>}
          {field.nullable && <span className="schema-null" title="nullable">| null</span>}
          {field.format && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {field.format}
            </span>
          )}
          {field.enum && field.enum.length <= 6 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace' }}>
              [{field.enum.map(String).join(', ')}]
            </span>
          )}
          {field.enum && field.enum.length > 6 && (
            <span style={{ fontSize: '0.65rem', color: 'var(--amber)' }}>
              enum ({field.enum.length} values)
            </span>
          )}
        </div>
      </div>

      {/* Nested object properties */}
      {hasChildren && expanded && (
        <div className="schema-children">
          <SchemaTree properties={field.properties!} depth={depth + 1} />
        </div>
      )}

      {/* Array items */}
      {primaryType === 'array' && field.items && expanded && (
        <div className="schema-children">
          <FieldNode name="[]" field={field.items} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

export default function SchemaTree({ properties, depth = 0 }: SchemaTreeProps) {
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem' }}>(empty)</p>;
  }

  return (
    <div className="schema-tree">
      {entries.map(([name, field]) => (
        <FieldNode key={name} name={name} field={field} depth={depth} />
      ))}
    </div>
  );
}
