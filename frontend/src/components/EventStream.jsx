import React, { useEffect, useRef } from 'react';

const TYPE = {
  HEARTBEAT:         { color: '#9CA3AF', label: 'HEARTBEAT',    dot: '#D1D5DB' },
  METRICS:           { color: '#3B82F6', label: 'METRICS',      dot: '#93C5FD' },
  INCIDENT:          { color: '#EF4444', label: 'INCIDENT',     dot: '#FCA5A5' },
  INCIDENT_RESOLVED: { color: '#22C55E', label: 'RESOLVED',     dot: '#86EFAC' },
  ELECTION:          { color: '#F59E0B', label: 'ELECTION',     dot: '#FCD34D' },
  RESPONSE:          { color: '#22C55E', label: 'RESPONSE',     dot: '#86EFAC' },
  RECOVERY:          { color: '#22C55E', label: 'RECOVERY',     dot: '#86EFAC' },
  PROPAGATION:       { color: '#8B5CF6', label: 'TRANSFER',     dot: '#C4B5FD' },
};

export default function EventStream({ events }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const filtered = events.filter(e => e.type !== 'HEARTBEAT' || Math.random() < 0.1);

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {!events.length ? (
        <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
          Waiting for events…
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {events.filter(e => {
             if (e.type === 'HEARTBEAT') return false;
             if (e.type === 'PROPAGATION' && e.data?.status !== 'FAILED') return false;
             return true;
          }).slice(-80).map((ev, i) => {
            const cfg = TYPE[ev.type] || { color: '#9CA3AF', label: ev.type, dot: '#D1D5DB' };
            const ts = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div key={i} className="log-line" style={{ color: cfg.color }}>
                {/* Timestamp */}
                <span style={{ color: 'var(--text-3)', flexShrink: 0, fontSize: 9, minWidth: 64 }}>{ts}</span>

                {/* Status dot + type */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  flexShrink: 0, width: 86,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.3px' }}>{cfg.label}</span>
                </span>

                {/* Node ID */}
                <span style={{ flexShrink: 0, width: 48, color: 'var(--text-2)', fontSize: 9 }}>
                  {ev.node_id || '—'}
                </span>

                {/* Data payload */}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-3)', fontSize: 9 }}>
                  {ev.data && typeof ev.data === 'object'
                    ? Object.entries(ev.data)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}:${typeof v === 'number' ? v.toFixed(1) : v}`)
                        .join('  ')
                    : String(ev.data ?? '')}
                </span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
