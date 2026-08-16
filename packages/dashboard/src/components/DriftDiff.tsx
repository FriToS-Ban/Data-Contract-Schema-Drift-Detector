import type { DriftChange, DriftSeverity } from '../types';

const CHANGE_ICONS: Record<string, string> = {
  FIELD_REMOVED: '🗑️',
  FIELD_ADDED: '✅',
  TYPE_CHANGED: '🔄',
  NULLABILITY_CHANGED: '⚠️',
  ENUM_VALUE_REMOVED: '🚫',
  ENUM_VALUE_ADDED: '➕',
  REQUIRED_CHANGED: '🔒',
  STRUCTURE_CHANGED: '🏗️',
  ARRAY_ITEM_TYPE_CHANGED: '📦',
  FORMAT_CHANGED: '🎨',
};

interface DriftDiffProps {
  changes: DriftChange[];
  maxVisible?: number;
}

export default function DriftDiff({ changes, maxVisible }: DriftDiffProps) {
  const visible = maxVisible ? changes.slice(0, maxVisible) : changes;
  const hidden = maxVisible ? changes.length - maxVisible : 0;

  if (changes.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '2rem' }}>
        <div className="empty-icon">✅</div>
        <h3>No drift detected</h3>
        <p>Schema matches the contract exactly.</p>
      </div>
    );
  }

  const order: DriftSeverity[] = ['critical', 'warning', 'info'];
  const sorted = [...visible].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );

  return (
    <div>
      {sorted.map((change, i) => (
        <div key={i} className={`drift-change ${change.severity}`}>
          <span className="drift-change-icon">{CHANGE_ICONS[change.changeType] ?? '🔍'}</span>
          <div className="drift-change-body">
            <div className="drift-change-path">{change.path}</div>
            <div className="drift-change-msg">{change.message}</div>
            {(change.before !== undefined || change.after !== undefined) && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                {change.before !== undefined && (
                  <span style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', padding: '0.1rem 0.5rem', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                    − {JSON.stringify(change.before)}
                  </span>
                )}
                {change.after !== undefined && (
                  <span style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', padding: '0.1rem 0.5rem', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                    + {JSON.stringify(change.after)}
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="drift-change-type">{change.changeType}</span>
        </div>
      ))}
      {hidden > 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          +{hidden} more changes
        </p>
      )}
    </div>
  );
}
