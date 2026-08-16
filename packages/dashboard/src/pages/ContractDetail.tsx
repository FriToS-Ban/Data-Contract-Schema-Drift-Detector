import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Contract, DriftReport } from '../types';
import SchemaTree from '../components/SchemaTree';
import DriftDiff from '../components/DriftDiff';
import CheckNow from '../components/CheckNow';

const SOURCE_ICONS: Record<string, string> = {
  rest: '🌐', graphql: '⬡', kafka: '📨', webhook: '🪝',
  database: '🗄️', sqs: '📬', pubsub: '📡',
};

type ActiveTab = 'overview' | 'schema' | 'check' | 'history';

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [history, setHistory] = useState<DriftReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DriftReport | null>(null);
  const [tab, setTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.contracts.get(id),
      api.contracts.history(id),
    ]).then(([c, h]) => {
      setContract(c);
      setHistory(h);
      if (h.length > 0) setSelectedReport(h[0]);
      setLoading(false);
    }).catch((e) => {
      setError((e as Error).message);
      setLoading(false);
    });
  }, [id]);

  function onCheckComplete(report: DriftReport) {
    setHistory((prev) => [report, ...prev]);
    setSelectedReport(report);
    // Refresh contract status
    api.contracts.get(id!).then(setContract).catch(() => {});
  }

  if (loading) return <div className="loading-state"><div className="spinner" /> Loading contract…</div>;
  if (error) return <div className="alert-banner error" style={{ margin: '2rem 0' }}>❌ {error}</div>;
  if (!contract) return null;

  const ENV_COLOR: Record<string, string> = {
    production: '#ef4444', staging: '#f59e0b', development: '#10b981',
  };

  const fieldCount = Object.keys(contract.schema.properties).length;
  const driftCount = history.filter((h) => h.hasDrift).length;

  return (
    <div className="fade-in">
      {/* ── Breadcrumb ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Link to="/contracts" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Contracts</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>{contract.name}</span>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.4rem' }}>{contract.name}</h2>
            <span className={`badge badge-${contract.status}`}>
              <span className={`dot dot-${contract.status === 'healthy' ? 'green' : contract.status === 'drifted' ? 'red' : 'blue'} dot-pulse`} />
              {contract.status}
            </span>
          </div>
          {contract.description && <p>{contract.description}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span className="source-pill">
              {SOURCE_ICONS[contract.source.type] ?? '📦'} {contract.source.type}
            </span>
            <span style={{
              fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '99px',
              background: `${ENV_COLOR[contract.environment] ?? '#6366f1'}18`,
              color: ENV_COLOR[contract.environment] ?? 'var(--text-accent)',
              border: `1px solid ${ENV_COLOR[contract.environment] ?? '#6366f1'}35`,
              fontWeight: 600,
            }}>{contract.environment}</span>
            <span className="source-pill" style={{ fontFamily: 'inherit' }}>v{contract.schema.version}</span>
            {contract.tags?.map((t) => (
              <span key={t} style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '99px', background: 'rgba(99,102,241,0.08)', color: 'var(--text-accent)', border: '1px solid rgba(99,102,241,0.15)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setTab('check')} id="btn-check-now">
            ⚡ Check Now
          </button>
          <button className="btn btn-ghost" onClick={() => setTab('schema')} id="btn-view-schema">
            📄 Schema
          </button>
        </div>
      </div>

      {/* ── Mini stats ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Schema Fields', value: fieldCount, icon: '📄' },
          { label: 'Checks Run', value: history.length, icon: '🔍' },
          { label: 'Drift Events', value: driftCount, icon: '🚨' },
          { label: 'Created', value: new Date(contract.createdAt).toLocaleDateString(), icon: '📅' },
        ].map((s) => (
          <div key={s.label} className="card card-sm">
            <div className="stat-icon" style={{ position: 'static', fontSize: '1rem', marginBottom: '0.25rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────────── */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {([
          ['overview', 'Overview'],
          ['schema', '📄 Schema'],
          ['check', '⚡ Check Now'],
          ['history', `🕐 History (${history.length})`],
        ] as [ActiveTab, string][]).map(([key, label]) => (
          <button
            key={key}
            id={`tab-${key}`}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="fade-in">
          <div className="detail-grid">
            <div>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '0.95rem' }}>Contract Details</h3>
                <div className="detail-meta">
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Source Type</div>
                    <div className="detail-meta-value">{SOURCE_ICONS[contract.source.type]} {contract.source.type}</div>
                  </div>
                  {contract.source.url && (
                    <div className="detail-meta-item">
                      <div className="detail-meta-label">URL</div>
                      <div className="detail-meta-value font-mono text-sm truncate">{contract.source.url}</div>
                    </div>
                  )}
                  {contract.source.topic && (
                    <div className="detail-meta-item">
                      <div className="detail-meta-label">Topic</div>
                      <div className="detail-meta-value font-mono text-sm">{contract.source.topic}</div>
                    </div>
                  )}
                  {contract.source.table && (
                    <div className="detail-meta-item">
                      <div className="detail-meta-label">Table</div>
                      <div className="detail-meta-value font-mono text-sm">{contract.source.table}</div>
                    </div>
                  )}
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Environment</div>
                    <div className="detail-meta-value">{contract.environment}</div>
                  </div>
                  <div className="detail-meta-item">
                    <div className="detail-meta-label">Last Checked</div>
                    <div className="detail-meta-value text-sm">
                      {contract.lastCheckedAt ? new Date(contract.lastCheckedAt).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest drift report */}
              {selectedReport && selectedReport.hasDrift && (
                <div className="card">
                  <div className="section-header">
                    <h3>Latest Drift Report</h3>
                    <span className="text-sm text-muted">{new Date(selectedReport.detectedAt).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {selectedReport.criticalCount > 0 && <span className="badge badge-critical">{selectedReport.criticalCount} critical</span>}
                    {selectedReport.warningCount > 0 && <span className="badge badge-warning">{selectedReport.warningCount} warnings</span>}
                    {selectedReport.infoCount > 0 && <span className="badge badge-info">{selectedReport.infoCount} info</span>}
                  </div>
                  <DriftDiff changes={selectedReport.changes} maxVisible={5} />
                </div>
              )}

              {selectedReport && !selectedReport.hasDrift && (
                <div className="card">
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--green)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                    <div style={{ fontWeight: 600 }}>Last check passed</div>
                    <div className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>No drift detected</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right column: mini history timeline */}
            <div>
              <div className="card">
                <div className="section-header">
                  <h3>Check History</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab('history')}>All →</button>
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-muted">No checks yet. Run your first check!</p>
                ) : (
                  <div className="timeline">
                    {history.slice(0, 8).map((h) => (
                      <div
                        key={h.id}
                        className="timeline-item"
                        onClick={() => { setSelectedReport(h); setTab('history'); }}
                      >
                        <div className={`timeline-dot ${h.hasDrift ? 'drifted' : ''}`} />
                        <div className="timeline-header">
                          <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                            {h.hasDrift ? `🚨 ${h.changes.length} change${h.changes.length !== 1 ? 's' : ''}` : '✅ No drift'}
                          </span>
                          <span className="timeline-time">{new Date(h.detectedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-muted truncate">{h.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Schema ────────────────────────────────────────────────────────── */}
      {tab === 'schema' && (
        <div className="fade-in card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <div>
              <h3>Contract Schema</h3>
              <p className="text-sm text-muted" style={{ marginTop: '0.2rem' }}>
                Version {contract.schema.version} · {fieldCount} top-level fields
              </p>
            </div>
          </div>
          {contract.schema.description && (
            <p className="text-sm text-secondary" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--r-md)', border: '1px solid rgba(99,102,241,0.15)' }}>
              {contract.schema.description}
            </p>
          )}
          <SchemaTree properties={contract.schema.properties} />
        </div>
      )}

      {/* ── Tab: Check Now ─────────────────────────────────────────────────────── */}
      {tab === 'check' && (
        <div className="fade-in card">
          <div className="section-header" style={{ marginBottom: '1rem' }}>
            <h3>⚡ Check Payload Against Contract</h3>
          </div>
          <CheckNow
            contractId={contract.id}
            contractName={contract.name}
            onComplete={onCheckComplete}
          />
        </div>
      )}

      {/* ── Tab: History ───────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="fade-in">
          {history.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🕐</div>
                <h3>No checks yet</h3>
                <p>Run a check to start building drift history.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setTab('check')}>
                  ⚡ Check Now
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? '300px 1fr' : '1fr', gap: '1rem' }}>
              {/* History list */}
              <div>
                {history.map((h) => (
                  <div
                    key={h.id}
                    id={`report-${h.id}`}
                    className="card card-sm"
                    style={{
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      borderColor: selectedReport?.id === h.id ? 'var(--border-strong)' : undefined,
                      background: selectedReport?.id === h.id ? 'var(--bg-card-hover)' : undefined,
                    }}
                    onClick={() => setSelectedReport(h)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {h.hasDrift ? '🚨 Drift' : '✅ Clean'}
                      </span>
                      <span className="text-xs text-muted">{new Date(h.detectedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted truncate">{h.summary}</p>
                    {h.hasDrift && (
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem' }}>
                        {h.criticalCount > 0 && <span className="badge badge-critical">{h.criticalCount}</span>}
                        {h.warningCount > 0 && <span className="badge badge-warning">{h.warningCount}</span>}
                        {h.infoCount > 0 && <span className="badge badge-info">{h.infoCount}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Selected report detail */}
              {selectedReport && (
                <div className="card fade-in">
                  <div className="section-header" style={{ marginBottom: '1rem' }}>
                    <div>
                      <h3>{selectedReport.hasDrift ? '🚨 Drift Detected' : '✅ No Drift'}</h3>
                      <p className="text-sm text-muted">{new Date(selectedReport.detectedAt).toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {selectedReport.criticalCount > 0 && <span className="badge badge-critical">{selectedReport.criticalCount} critical</span>}
                      {selectedReport.warningCount > 0 && <span className="badge badge-warning">{selectedReport.warningCount} warnings</span>}
                      {selectedReport.infoCount > 0 && <span className="badge badge-info">{selectedReport.infoCount} info</span>}
                    </div>
                  </div>
                  <p className="text-sm text-secondary" style={{ marginBottom: '1rem' }}>{selectedReport.summary}</p>
                  <DriftDiff changes={selectedReport.changes} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
