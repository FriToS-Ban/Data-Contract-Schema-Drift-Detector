import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Contract, ContractSchema } from '../types';
import SchemaTree from '../components/SchemaTree';

const SOURCE_TYPES = ['rest', 'graphql', 'kafka', 'webhook', 'database', 'sqs', 'pubsub'];
const ENVIRONMENTS = ['production', 'staging', 'development'];

const EXAMPLE_CONTRACT = JSON.stringify({
  version: '1.0.0',
  description: 'User profile returned by GET /users/:id',
  properties: {
    id:        { type: 'string',  nullable: false, required: true,  format: 'uuid' },
    email:     { type: 'string',  nullable: false, required: true,  format: 'email' },
    name:      { type: 'string',  nullable: false, required: true },
    role:      { type: 'string',  nullable: false, required: true,  enum: ['admin', 'editor', 'viewer'] },
    createdAt: { type: 'string',  nullable: false, required: true,  format: 'date-time' },
  },
}, null, 2);

const EXAMPLE_PAYLOAD = `{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "role": "admin",
  "createdAt": "2024-01-15T10:30:00Z"
}`;

type Mode = 'yaml' | 'infer';

export default function NewContract() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('yaml');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('rest');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTopic, setSourceTopic] = useState('');
  const [sourceTable, setSourceTable] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [schemaYaml, setSchemaYaml] = useState(EXAMPLE_CONTRACT);
  const [payloadJson, setPayloadJson] = useState(EXAMPLE_PAYLOAD);
  const [inferring, setInferring] = useState(false);
  const [inferredSchema, setInferredSchema] = useState<ContractSchema | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseSchema(): ContractSchema | null {
    try {
      const parsed = JSON.parse(schemaYaml) as ContractSchema;
      if (!parsed.version) parsed.version = '1.0.0';
      if (!parsed.properties) {
        setError('Schema must have a "properties" object. See the format guide on the right.');
        return null;
      }
      return parsed;
    } catch (e) {
      setError(`Invalid JSON: ${(e as SyntaxError).message}. See the format guide on the right.`);
      return null;
    }
  }

  async function handleInfer() {
    setError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      setError('Payload must be valid JSON.');
      return;
    }

    setInferring(true);
    try {
      const result = await api.checks.infer([payload]);
      setInferredSchema(result.schema as ContractSchema);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInferring(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Contract name is required.'); return; }

    let schema: ContractSchema;
    if (mode === 'infer') {
      if (!inferredSchema) { setError('Infer a schema first.'); return; }
      schema = inferredSchema;
    } else {
      const parsed = parseSchema();
      if (!parsed) return;
      schema = parsed;
    }

    setSaving(true);
    setError(null);
    try {
      const source: Contract['source'] = { type: sourceType as Contract['source']['type'] };
      if (sourceUrl) source.url = sourceUrl;
      if (sourceTopic) source.topic = sourceTopic;
      if (sourceTable) source.table = sourceTable;

      const contract = await api.contracts.create({
        name,
        description: description || undefined,
        source,
        environment,
        schema,
      });
      navigate(`/contracts/${contract.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>New Contract</h2>
          <p>Define a data contract to monitor for schema drift.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* ── Main form ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Basic info */}
          <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>Basic Info</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="contract-name">Name <span>*</span></label>
              <input id="contract-name" className="form-input" type="text" placeholder="e.g. User Profile API" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="contract-description">Description</label>
              <input id="contract-description" className="form-input" type="text" placeholder="What does this contract cover?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Source */}
          <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>Source</h3>
            <div className="grid-2" style={{ marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="source-type">Source Type <span>*</span></label>
                <select id="source-type" className="form-select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                  {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="environment">Environment <span>*</span></label>
                <select id="environment" className="form-select" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                  {ENVIRONMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            {(sourceType === 'rest' || sourceType === 'graphql' || sourceType === 'webhook') && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="source-url">URL</label>
                <input id="source-url" className="form-input" type="text" placeholder="https://api.example.com/v2/users/:id" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
            )}
            {(sourceType === 'kafka' || sourceType === 'sqs' || sourceType === 'pubsub') && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="source-topic">Topic / Queue Name</label>
                <input id="source-topic" className="form-input" type="text" placeholder="orders.created" value={sourceTopic} onChange={(e) => setSourceTopic(e.target.value)} />
              </div>
            )}
            {sourceType === 'database' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="source-table">Table Name</label>
                <input id="source-table" className="form-input" type="text" placeholder="public.users" value={sourceTable} onChange={(e) => setSourceTable(e.target.value)} />
              </div>
            )}
          </div>

          {/* Schema */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Schema Definition</h3>
              <div className="tabs">
                <button className={`tab ${mode === 'yaml' ? 'active' : ''}`} onClick={() => setMode('yaml')}>Manual JSON</button>
                <button className={`tab ${mode === 'infer' ? 'active' : ''}`} onClick={() => setMode('infer')}>🪄 Infer from Payload</button>
              </div>
            </div>

            {mode === 'yaml' && (
              <div>
                <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>
                  Define the schema as JSON. Fields need <code>type</code>, <code>nullable</code>, and <code>required</code>.
                </p>
                <textarea
                  id="schema-input"
                  className="form-textarea"
                  value={schemaYaml}
                  onChange={(e) => setSchemaYaml(e.target.value)}
                  spellCheck={false}
                  style={{ minHeight: 280 }}
                />
              </div>
            )}

            {mode === 'infer' && (
              <div>
                <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>
                  Paste a sample JSON payload and we'll auto-infer the schema.
                </p>
                <textarea
                  id="infer-payload"
                  className="form-textarea"
                  value={payloadJson}
                  onChange={(e) => setPayloadJson(e.target.value)}
                  spellCheck={false}
                  style={{ minHeight: 200, marginBottom: '0.75rem' }}
                />
                <button id="btn-infer" className="btn btn-secondary" onClick={handleInfer} disabled={inferring}>
                  {inferring ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Inferring…</> : '🪄 Infer Schema'}
                </button>

                {inferredSchema && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--green-dim)', borderRadius: 'var(--r-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p style={{ color: 'var(--green)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>✅ Schema inferred successfully!</p>
                    <SchemaTree properties={inferredSchema.properties} />
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="alert-banner error">⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button id="btn-save-contract" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : '💾 Create Contract'}
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('/contracts')}>
              Cancel
            </button>
          </div>
        </div>

        {/* ── Sidebar tips ──────────────────────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>📚 Schema Format</h3>
            <p className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>Each field requires:</p>
            <div className="code-block">
{`{
  "version": "1.0.0",
  "properties": {
    "fieldName": {
      "type": "string",
      "nullable": false,
      "required": true,
      "format": "email",
      "enum": ["a","b"]
    }
  }
}`}
            </div>
            <p className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
              Supported types: <code>string</code>, <code>number</code>, <code>integer</code>, <code>boolean</code>, <code>object</code>, <code>array</code>, <code>null</code>
            </p>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>⚡ Drift Detection</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                ['🔴', 'Field removed', 'critical'],
                ['🔴', 'Type changed', 'critical'],
                ['🟡', 'Nullability changed', 'warning'],
                ['🟡', 'Field added (required)', 'warning'],
                ['🔵', 'Enum value added', 'info'],
                ['🔵', 'Field added (optional)', 'info'],
              ].map(([icon, label, sev]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <span>{icon}</span>
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{label}</span>
                  <span className={`badge badge-${sev}`}>{sev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
