import React, { useState } from 'react';
import { Settings } from 'lucide-react';

export default function PolicyPanel({ nodes, onPolicyUpdate }) {
  const [cfg, setCfg] = useState({
    restart_threshold: 1,
    latency_threshold: 800,
    cpu_threshold: 85,
    auto_recovery: true,
    cooldown_seconds: 30,
    chaos_mode: false,
  });
  const [toast, setToast] = useState(false);
  const [pending, setPending] = useState(false);

  const updatePolicy = async () => {
    setPending(true);
    try {
      await fetch('http://localhost:9000/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setToast(true);
      setTimeout(() => setToast(false), 2200);
      if (onPolicyUpdate) onPolicyUpdate(cfg);
    } catch (e) {
      console.error(e);
    }
    setPending(false);
  };

  const violatingNodes = nodes
    ? Object.entries(nodes)
        .filter(([, d]) => d.metrics && (
          d.metrics.latency_ms > cfg.latency_threshold ||
          d.metrics.cpu_percent > cfg.cpu_threshold
        ))
        .map(([id]) => id)
    : [];

  return (
    <div className="panel" style={{ padding: '16px', fontSize: '13px', position: 'relative', marginTop: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
      {toast && <div className="toast">✓ Policy Updated</div>}

      <div className="panel-header" style={{ marginBottom: 16 }}>
        <div className="panel-title">
          <span className="panel-title-dot" style={{ background: 'var(--purple)' }} />
          System Policies
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="form-row">
          <label className="form-label">Auto Recovery</label>
          <label className="toggle">
            <input type="checkbox" checked={cfg.auto_recovery}
              onChange={e => setCfg({ ...cfg, auto_recovery: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        <div className="form-row">
          <label className="form-label">Chaos Mode</label>
          <label className="toggle toggle-danger">
            <input type="checkbox" checked={cfg.chaos_mode}
              onChange={e => setCfg({ ...cfg, chaos_mode: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        <div className="form-row">
          <label className="form-label">Latency Threshold</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" className="form-input" value={cfg.latency_threshold}
              onChange={e => setCfg({ ...cfg, latency_threshold: parseInt(e.target.value) || 0 })}
            />
            <span style={{ color: 'var(--text-3)', fontSize: '11px', width: 14 }}>ms</span>
          </div>
        </div>
        
        <div className="form-row">
          <label className="form-label">CPU Threshold</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" className="form-input" value={cfg.cpu_threshold}
              onChange={e => setCfg({ ...cfg, cpu_threshold: parseInt(e.target.value) || 0 })}
            />
            <span style={{ color: 'var(--text-3)', fontSize: '11px', width: 14 }}>%</span>
          </div>
        </div>
        
        <div className="form-row" style={{ borderBottom: 'none' }}>
          <label className="form-label">Cooldown</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" className="form-input" value={cfg.cooldown_seconds}
              onChange={e => setCfg({ ...cfg, cooldown_seconds: parseInt(e.target.value) || 0 })}
            />
            <span style={{ color: 'var(--text-3)', fontSize: '11px', width: 14 }}>s</span>
          </div>
        </div>
      </div>

      {violatingNodes.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px 10px',
          background: 'var(--amber-light)',
          border: '1px solid #FDE68A',
          borderRadius: 'var(--radius-xs)',
          fontSize: '11px',
          color: 'var(--amber)',
          fontFamily: 'JetBrains Mono',
          fontWeight: 600
        }}>
          ⚠ Violating: {violatingNodes.join(', ').toUpperCase()}
        </div>
      )}

      <button
        className={`btn ${cfg.chaos_mode ? 'btn-red' : 'btn-blue'}`}
        onClick={updatePolicy}
        disabled={pending}
        style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', width: '100%' }}
      >
        {pending ? '...' : 'Apply Policies'}
      </button>
    </div>
  );
}
