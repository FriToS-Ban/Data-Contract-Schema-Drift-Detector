import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Contract, Stats, DriftReport } from '../types';

const SOURCE_ICONS: Record<string, string> = {
  rest: '🌐', graphql: '⬡', kafka: '📨', webhook: '🪝',
  database: '🗄️', sqs: '📬', pubsub: '📡',
};

const ENV_COLOR: Record<string, string> = {
  production: '#ef4444',
  staging: '#f59e0b',
  development: '#10b981',
};

function StatusBadge({ status }: { status: Contract['status'] }) {
  return (
    <span className={`badge badge-${status}`}>
      <span className={`dot dot-${status === 'healthy' ? 'green' : status === 'drifted' ? 'red' : 'blue'} dot-pulse`} />
      {status}
    </span>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <div className="bar-chart">
        {data.map((d, i) => (
          <div
            key={i}
            className={`bar-chart-bar ${d.count > 0 ? 'has-drift' : ''}`}
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
            title={`${d.date}: ${d.count} drifts`}
          />
        ))}
      </div>
      <div className="bar-chart-labels">
        {data.map((d, i) => (
          <div key={i} className="bar-chart-label">
            {new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [recentDrifts, setRecentDrifts] = useState<DriftReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.stats.get(),
      api.contracts.list(),
      api.history.list({ limit: 8, drifted: true }),
    ]).then(([s, c, h]) => {
      setStats(s);
      setContracts(c);
      setRecentDrifts(h.items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        Loading dashboard…
      </div>
    );
  }


  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Monitor your data contracts and catch schema drift before it breaks things.</p>
        </div>
        <Link to="/contracts/new" className="btn btn-primary" id="btn-new-contract-dashboard">
          ➕ New Contract
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Total Contracts</div>
          <div className="stat-value" style={{ background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } as React.CSSProperties}>
            {stats?.totalContracts ?? 0}
          </div>
          <div className="stat-sub">{stats?.unknownContracts} unchecked</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-label">Healthy</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {stats?.healthyContracts ?? 0}
          </div>
          <div className="stat-sub">schemas in sync</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🚨</div>
          <div className="stat-label">Drifted</div>
          <div className="stat-value" style={{ color: stats?.driftedContracts ? 'var(--red)' : 'var(--text-primary)' }}>
            {stats?.driftedContracts ?? 0}
          </div>
          <div className="stat-sub">need attention</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-label">Drifts Today</div>
          <div className="stat-value" style={{ color: stats?.driftsToday ? 'var(--amber)' : 'var(--text-primary)' }}>
            {stats?.driftsToday ?? 0}
          </div>
          <div className="stat-sub">since midnight</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔍</div>
          <div className="stat-label">Total Checks</div>
          <div className="stat-value">{stats?.totalChecks ?? 0}</div>
          <div className="stat-sub">all time</div>
        </div>
      </div>

      {/* ── Two-column row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Drift trend chart */}
        <div className="card">
          <div className="section-header">
            <h3>Drift Activity (Last 7 Days)</h3>
            <span className="text-muted text-sm">{stats?.totalChecks ?? 0} total checks</span>
          </div>
          {stats?.last7Days && <BarChart data={stats.last7Days} />}
          {stats?.last7Days.every((d) => d.count === 0) && (
            <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>
              No drift detected in the past 7 days 🎉
            </p>
          )}
        </div>

        {/* Top drifters */}
        <div className="card">
          <div className="section-header">
            <h3>Top Drifters</h3>
          </div>
          {stats?.topDrifters.length === 0 ? (
            <p className="text-muted text-sm">No drift history yet.</p>
          ) : (
            <div>
              {stats?.topDrifters.map((d, i) => (
                <div key={d.contract_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < (stats.topDrifters.length - 1) ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', width: '1.5rem', textAlign: 'center', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                    #{i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: '0.875rem', fontWeight: 500 }}>{d.contract_name}</div>
                    <div className="text-xs text-muted">{d.drift_count} drift events</div>
                  </div>
                  <Link to={`/contracts/${d.contract_id}`} className="btn btn-ghost btn-sm">View</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Contract health grid ────────────────────────────────────────────────── */}
      <div className="section-header">
        <h3>Contract Status</h3>
        <Link to="/contracts" className="btn btn-ghost btn-sm">View All →</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {contracts.map((contract) => (
          <Link key={contract.id} to={`/contracts/${contract.id}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer' }}>
              <div className={`contract-card-status-bar status-bar-${contract.status}`} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{contract.name}</div>
                  {contract.description && (
                    <div className="text-xs text-muted truncate" style={{ maxWidth: 220 }}>{contract.description}</div>
                  )}
                </div>
                <StatusBadge status={contract.status} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="source-pill">{SOURCE_ICONS[contract.source.type] ?? '📦'} {contract.source.type}</span>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '99px', background: `${ENV_COLOR[contract.environment] ?? '#6366f1'}20`, color: ENV_COLOR[contract.environment] ?? 'var(--text-accent)', border: `1px solid ${ENV_COLOR[contract.environment] ?? '#6366f1'}40` }}>
                  {contract.environment}
                </span>
              </div>
              {contract.lastCheckedAt && (
                <div className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  Last checked {new Date(contract.lastCheckedAt).toLocaleString()}
                </div>
              )}
            </div>
          </Link>
        ))}
        {contracts.length === 0 && (
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No contracts yet</h3>
              <p>Create your first data contract to start monitoring schema drift.</p>
              <Link to="/contracts/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                ➕ Create Contract
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Recent drift events ─────────────────────────────────────────────────── */}
      <div className="section-header">
        <h3>Recent Drift Events</h3>
        <Link to="/history" className="btn btn-ghost btn-sm">View All →</Link>
      </div>

      {recentDrifts.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-icon">🎉</div>
            <h3>All clear!</h3>
            <p>No drift events detected recently.</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Environment</th>
                <th>Summary</th>
                <th>Severity</th>
                <th>Detected At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentDrifts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.contractName}</td>
                  <td><span className="source-pill" style={{ fontSize: '0.7rem' }}>{d.environment}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: 280 }} className="truncate">{d.summary}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {d.criticalCount > 0 && <span className="badge badge-critical">{d.criticalCount}🔴</span>}
                      {d.warningCount > 0 && <span className="badge badge-warning">{d.warningCount}🟡</span>}
                      {d.infoCount > 0 && <span className="badge badge-info">{d.infoCount}🔵</span>}
                    </div>
                  </td>
                  <td className="text-sm text-muted">{new Date(d.detectedAt).toLocaleString()}</td>
                  <td>
                    <Link to={`/contracts/${d.contractId}`} className="btn btn-ghost btn-sm">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
