import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Sidebar() {
  const navigate = useNavigate();
  const [driftedCount, setDriftedCount] = useState(0);

  useEffect(() => {
    api.stats.get().then((s) => setDriftedCount(s.driftedContracts)).catch(() => {});
    const t = setInterval(() => {
      api.stats.get().then((s) => setDriftedCount(s.driftedContracts)).catch(() => {});
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>
          <span className="logo-icon">⚡</span>
          SchemaDrift
        </h1>
        <p>Data Contract Monitor</p>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-section-label">Monitor</span>

        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} id="nav-dashboard">
          <span className="nav-icon">📊</span>
          Dashboard
        </NavLink>

        <NavLink to="/contracts" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} id="nav-contracts">
          <span className="nav-icon">📋</span>
          Contracts
          {driftedCount > 0 && <span className="nav-badge">{driftedCount}</span>}
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} id="nav-history">
          <span className="nav-icon">🕐</span>
          Drift History
        </NavLink>

        <span className="nav-section-label" style={{ marginTop: '0.5rem' }}>Quick Actions</span>

        <button
          className="nav-item"
          id="nav-new-contract"
          onClick={() => navigate('/contracts/new')}
          style={{ cursor: 'pointer', background: 'none', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--text-accent)', width: '100%', textAlign: 'left' }}
        >
          <span className="nav-icon">➕</span>
          New Contract
        </button>
      </nav>

      <div className="sidebar-footer">
        <p>⚡ SchemaDrift v1.0</p>
        <p style={{ marginTop: '0.25rem' }}>© 2024</p>
      </div>
    </aside>
  );
}
