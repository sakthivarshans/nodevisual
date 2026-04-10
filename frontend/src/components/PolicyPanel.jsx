import React, { useState } from 'react';
import { Settings } from 'lucide-react';

export default function PolicyPanel() {
    const [cfg, setCfg] = useState({
        restart_threshold: 1,
        latency_threshold: 800,
        cpu_threshold: 85,
        auto_recovery: true,
        cooldown_seconds: 30,
        chaos_mode: false
    });

    const updatePolicy = () => {
        fetch('http://localhost:9000/policy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg)
        }).catch(console.error);
    };

    return (
        <div className="panel" style={{ padding: '12px', fontSize: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                <Settings size={16} />
                <strong style={{ letterSpacing: '1px' }}>SYSTEM POLICIES</strong>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Auto Recovery</label>
                    <input type="checkbox" checked={cfg.auto_recovery} onChange={e => setCfg({...cfg, auto_recovery: e.target.checked})} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Latency Threshold (ms)</label>
                    <input type="number" style={{ width: '60px', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px' }} value={cfg.latency_threshold} onChange={e => setCfg({...cfg, latency_threshold: parseInt(e.target.value)})} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>CPU Threshold (%)</label>
                    <input type="number" style={{ width: '60px', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '2px 4px' }} value={cfg.cpu_threshold} onChange={e => setCfg({...cfg, cpu_threshold: parseInt(e.target.value)})} />
                </div>
                
                <button className="btn" onClick={updatePolicy} style={{ marginTop: '8px' }}>APPLY POLICIES</button>
            </div>
        </div>
    );
}
