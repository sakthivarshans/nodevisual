import React, { useState, useEffect } from 'react';
import { Activity, ServerCrash } from 'lucide-react';

function metricColor(val, warn, danger) {
  if (val >= danger) return 'var(--red)';
  if (val >= warn)   return 'var(--amber)';
  return 'var(--blue)';
}

export default function NodeCard({ nodeId, data, activeIncident, violated }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (violated) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1600);
      return () => clearTimeout(t);
    }
  }, [violated]);

  const isDead = data.status === 'DEAD';
  const isLeader = data.role === 'LEADER';
  const isCandidate = data.role === 'CANDIDATE';
  const isDegraded = data.status === 'DEGRADED';

  const stateClass = isDead ? 'status-dead'
    : isLeader ? 'role-leader'
    : isDegraded ? 'status-degraded'
    : 'status-healthy';

  const timeSince = Math.floor((Date.now() - data.lastHeartbeat) / 1000);

  const roleBadge = isLeader
    ? <span className="badge badge-green"><span className="badge-dot" style={{ background: 'var(--green)' }} />Leader</span>
    : isCandidate
    ? <span className="badge badge-amber"><span className="badge-dot" style={{ background: 'var(--amber)' }} />Candidate</span>
    : <span className="badge badge-gray">Follower</span>;

  const statusBadge = isDead
    ? <span className="badge badge-red">Down</span>
    : isDegraded
    ? <span className="badge badge-amber">Degraded</span>
    : <span className="badge badge-blue">Healthy</span>;

  return (
    <div className={`node-card ${stateClass} ${flash ? 'flash-violation' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDead
            ? <ServerCrash size={16} color="var(--red)" />
            : <Activity size={16} color={isLeader ? 'var(--green)' : 'var(--blue)'} />}
          <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>
            {nodeId.replace('node', 'NODE ')}
          </span>
          {roleBadge}
        </div>
        {statusBadge}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: data.metrics && !isDead ? 12 : 0, fontFamily: 'JetBrains Mono' }}>
        Last heartbeat: <span style={{ color: timeSince > 5 ? 'var(--red)' : 'var(--text-2)', fontWeight: 500 }}>{timeSince}s ago</span>
      </div>

      {data.metrics && !isDead && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'CPU', value: data.metrics.cpu_percent, unit: '%', warn: 70, danger: 85, max: 100 },
            { label: 'Latency', value: data.metrics.latency_ms, unit: 'ms', warn: 500, danger: 800, max: 1200 },
            { label: 'Errors', value: data.metrics.error_rate, unit: '%', warn: 5, danger: 10, max: 30 },
          ].map(m => {
            const color = metricColor(m.value, m.warn, m.danger);
            const pct = Math.min(100, (m.value / m.max) * 100);
            return (
              <div key={m.label} className="stat-chip">
                <div className="stat-chip-label">{m.label}</div>
                <div className="stat-chip-value" style={{ color }}>{m.value}{m.unit}</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeIncident && (
        <div style={{
          marginTop: 10,
          padding: '6px 10px',
          background: 'var(--red-light)',
          border: '1px solid #FECACA',
          borderRadius: 'var(--radius-xs)',
          fontSize: 11.5,
          color: 'var(--red)',
          fontWeight: 600,
        }}>
          ⚠ {activeIncident.rule_triggered} · {activeIncident.severity}
        </div>
      )}

      {violated && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
          ⚙ Triggered by policy change
        </div>
      )}
    </div>
  );
}
