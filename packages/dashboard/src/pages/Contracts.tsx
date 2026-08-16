import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Contract } from '../types';

const SOURCE_ICONS: Record<string, string> = {
  rest: '🌐', graphql: '⬡', kafka: '📨', webhook: '🪝',
  database: '🗄️', sqs: '📬', pubsub: '📡',
};

const ENV_COLOR: Record<string, string> = {
  production: '#ef4444', staging: '#f59e0b', development: '#10b981',
};

type FilterStatus = 'all' | 'healthy' | 'drifted' | 'unknown';
type FilterEnv = 'all' | string;

export default function Contracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterEnv, setFilterEnv] = useState<FilterEnv>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    try {
      const data = await api.contracts.list();
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete contract "${name}"? This will also remove all drift history.`)) return;
    setDeleting(id);
    try {
      await api.contracts.delete(id);
      setContracts((prev) => prev.filter((c) => c.id !== id));
      showToast('Contract deleted.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setDeleting(null);
    }
  }

  function showToast(msg: string, type: 'error' | 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const environments = ['all', ...new Set(contracts.map((c) => c.environment))];

  const filtered = contracts.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchEnv = filterEnv === 'all' || c.environment === filterEnv;
    return matchSearch && matchStatus && matchEnv;
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>Contracts</h2>
          <p>{contracts.length} contract{contracts.length !== 1 ? 's' : ''} defined across all environments.</p>
        </div>
        <Link to="/contracts/new" className="btn btn-primary" id="btn-new-contract">
          ➕ New Contract
        </Link>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar">
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            id="search-contracts"
            type="text"
            placeholder="Search contracts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tabs">
          {(['all', 'healthy', 'drifted', 'unknown'] as FilterStatus[]).map((s) => (
            <button key={s} className={`tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && (
                <span style={{ marginLeft: '0.3rem', opacity: 0.7 }}>
                  ({contracts.filter((c) => c.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          id="filter-env"
          className="form-select"
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value)}
          style={{ width: 'auto' }}
        >
          {environments.map((e) => (
            <option key={e} value={e}>{e === 'all' ? 'All environments' : e}</option>
          ))}
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /> Loading contracts…</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>{search || filterStatus !== 'all' ? 'No matches' : 'No contracts yet'}</h3>
            <p>
              {search || filterStatus !== 'all'
                ? 'Try adjusting your filters.'
                : 'Create a contract to start monitoring schema drift.'}
            </p>
            {!search && filterStatus === 'all' && (
              <Link to="/contracts/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                ➕ Create First Contract
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th>Environment</th>
                <th>Schema Version</th>
                <th>Status</th>
                <th>Last Checked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} id={`contract-row-${c.id}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/contracts/${c.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-muted truncate" style={{ maxWidth: 240 }}>{c.description}</div>
                    )}
                  </td>
                  <td>
                    <span className="source-pill">
                      {SOURCE_ICONS[c.source.type] ?? '📦'} {c.source.type}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '99px',
                      background: `${ENV_COLOR[c.environment] ?? '#6366f1'}18`,
                      color: ENV_COLOR[c.environment] ?? 'var(--text-accent)',
                      border: `1px solid ${ENV_COLOR[c.environment] ?? '#6366f1'}35`,
                      fontWeight: 600,
                    }}>
                      {c.environment}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-sm text-muted">v{c.schema.version}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status}`}>
                      <span className={`dot dot-${c.status === 'healthy' ? 'green' : c.status === 'drifted' ? 'red' : 'blue'}`} />
                      {c.status}
                    </span>
                  </td>
                  <td className="text-sm text-muted">
                    {c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/contracts/${c.id}`} className="btn btn-ghost btn-sm" id={`btn-view-${c.id}`}>
                        View
                      </Link>
                      <button
                        className="btn btn-danger btn-sm"
                        id={`btn-delete-${c.id}`}
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deleting === c.id}
                      >
                        {deleting === c.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className={`notification`}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
