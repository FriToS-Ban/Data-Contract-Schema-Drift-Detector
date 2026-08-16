import { useState } from 'react';
import { api } from '../api/client';
import type { DriftReport } from '../types';
import DriftDiff from './DriftDiff';

interface CheckNowProps {
  contractId: string;
  contractName: string;
  onComplete?: (report: DriftReport) => void;
}

const EXAMPLE_PAYLOADS: Record<string, unknown> = {
  empty: {},
  sample: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
};

export default function CheckNow({ contractId, contractName, onComplete }: CheckNowProps) {
  const [payload, setPayload] = useState(
    JSON.stringify(EXAMPLE_PAYLOADS.sample, null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; driftReport: DriftReport; durationMs: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setError(null);
    setResult(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError('Invalid JSON — please fix the payload before checking.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.checks.run(contractId, parsed);
      setResult(res);
      onComplete?.(res.driftReport);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="form-group">
        <label className="form-label">
          Payload (JSON)
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.72rem' }}>
            — paste a real response or event
          </span>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {Object.entries(EXAMPLE_PAYLOADS).map(([k, v]) => (
            <button
              key={k}
              className="btn btn-ghost btn-sm"
              onClick={() => setPayload(JSON.stringify(v, null, 2))}
            >
              {k}
            </button>
          ))}
        </div>
        <textarea
          id="check-payload"
          className="form-textarea"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          spellCheck={false}
          style={{ minHeight: 180 }}
        />
      </div>

      {error && (
        <div className="alert-banner error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      <button id="btn-run-check" className="btn btn-primary" onClick={runCheck} disabled={loading}>
        {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Checking…</> : '⚡ Run Check'}
      </button>

      {result && (
        <div className="check-result fade-in" style={{ marginTop: '1.5rem' }}>
          {/* Result banner */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--r-md)',
              background: result.valid ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${result.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{result.valid ? '✅' : '🚨'}</span>
            <div>
              <div style={{ fontWeight: 600, color: result.valid ? 'var(--green)' : 'var(--red)' }}>
                {result.valid ? 'Contract Valid — No Drift' : 'Schema Drift Detected!'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                {result.driftReport.summary} · checked in {result.durationMs}ms
              </div>
            </div>
            {!result.valid && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                {result.driftReport.criticalCount > 0 && (
                  <span className="badge badge-critical">{result.driftReport.criticalCount} critical</span>
                )}
                {result.driftReport.warningCount > 0 && (
                  <span className="badge badge-warning">{result.driftReport.warningCount} warning</span>
                )}
                {result.driftReport.infoCount > 0 && (
                  <span className="badge badge-info">{result.driftReport.infoCount} info</span>
                )}
              </div>
            )}
          </div>

          {/* Drift changes */}
          {!result.valid && result.driftReport.changes.length > 0 && (
            <DriftDiff changes={result.driftReport.changes} />
          )}
        </div>
      )}
    </div>
  );
}
