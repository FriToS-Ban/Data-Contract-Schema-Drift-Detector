import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DriftReport } from '../types';
import DriftDiff from '../components/DriftDiff';

export default function History() {
  const [items, setItems] = useState<DriftReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DriftReport | null>(null);
  const [filterDrift, setFilterDrift] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    load();
  }, [filterDrift, page]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.history.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        drifted: filterDrift || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
      if (res.items.length > 0 && !selected) setSelected(res.items[0]);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Drift History</h2>
          <p>{total} check{total !== 1 ? 's' : ''} recorded across all contracts.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              id="filter-drift-only"
              type="checkbox"
              checked={filterDrift}
              onChange={(e) => { setFilterDrift(e.target.checked); setPage(0); setSelected(null); }}
              style={{ accentColor: 'var(--accent-1)', width: 14, height: 14 }}
            />
            Drift events only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /> Loading history…</div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🕐</div>
            <h3>No checks yet</h3>
            <p>Check a contract to start building history.</p>
            <Link to="/contracts" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              View Contracts →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── List ─────────────────────────────────────────────────────────────── */}
          <div>
            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              <table>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr>
                    <th>Contract</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      id={`history-row-${item.id}`}
                      onClick={() => setSelected(item)}
                      style={{
                        cursor: 'pointer',
                        background: selected?.id === item.id ? 'rgba(99,102,241,0.08)' : undefined,
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{item.contractName}</div>
                        <div className="text-xs text-muted">{item.environment}</div>
                      </td>
                      <td>
                        {item.hasDrift ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>
                            🚨 {item.changes.length} change{item.changes.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>✅ Clean</span>
                        )}
                      </td>
                      <td className="text-xs text-muted">{new Date(item.detectedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span className="text-sm text-muted">Page {page + 1} / {totalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </div>

          {/* ── Detail panel ─────────────────────────────────────────────────────── */}
          {selected && (
            <div className="card fade-in">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>
                    {selected.hasDrift ? '🚨 Schema Drift Detected' : '✅ Schema Check Passed'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="source-pill" style={{ fontFamily: 'inherit' }}>{selected.contractName}</span>
                    <span className="source-pill" style={{ fontFamily: 'inherit' }}>{selected.environment}</span>
                    <span className="text-xs text-muted">{new Date(selected.detectedAt).toLocaleString()}</span>
                  </div>
                </div>
                <Link to={`/contracts/${selected.contractId}`} className="btn btn-ghost btn-sm">View Contract →</Link>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--r-md)', border: '1px solid rgba(99,102,241,0.12)' }}>
                {selected.summary}
              </p>

              {selected.hasDrift && (
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {selected.criticalCount > 0 && <span className="badge badge-critical">{selected.criticalCount} critical</span>}
                    {selected.warningCount > 0 && <span className="badge badge-warning">{selected.warningCount} warnings</span>}
                    {selected.infoCount > 0 && <span className="badge badge-info">{selected.infoCount} info</span>}
                  </div>
                  <DriftDiff changes={selected.changes} />
                </div>
              )}

              {!selected.hasDrift && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--green)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                  <p style={{ fontWeight: 600 }}>All fields match the contract exactly.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
