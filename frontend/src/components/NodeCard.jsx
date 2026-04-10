import React from 'react';
import { Activity, ServerCrash, Zap, AlertTriangle } from 'lucide-react';

export default function NodeCard({ nodeId, data, activeIncident }) {
    const isDead = data.status === 'DEAD';
    
    let bc = 'var(--border)';
    if (isDead) bc = 'var(--accent-danger)';
    else if (data.status === 'DEGRADED') bc = 'var(--accent-warning)';
    else if (data.role === 'LEADER') bc = 'var(--accent-cyan)';
    
    const timeSinceHeartbeat = Math.floor((Date.now() - data.lastHeartbeat) / 1000);

    return (
        <div className="panel" style={{ padding: '12px', borderLeft: `4px solid ${bc}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="mono" style={{ fontWeight: 'bold' }}>{nodeId.toUpperCase()}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-dark)', borderRadius: '12px', color: bc }}>
                        {data.role}
                    </span>
                </div>
                {isDead ? <ServerCrash size={16} color="var(--accent-danger)" /> : <Zap size={16} color={bc} />}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                 <span>Status: {data.status}</span>
                 <span>Heartbeat: {timeSinceHeartbeat}s ago</span>
            </div>
            
            {data.metrics && !isDead && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
                    <div style={{ background: 'var(--bg-dark)', padding: '4px', borderRadius: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>CPU</div>
                        <div style={{ color: data.metrics.cpu_percent > 85 ? 'var(--accent-warning)' : 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {data.metrics.cpu_percent}%
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', padding: '4px', borderRadius: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>LATENCY</div>
                        <div style={{ color: data.metrics.latency_ms > 800 ? 'var(--accent-warning)' : 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {data.metrics.latency_ms}ms
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', padding: '4px', borderRadius: '4px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>ERRORS</div>
                        <div style={{ color: data.metrics.error_rate > 10 ? 'var(--accent-danger)' : 'var(--accent-cyan)', fontWeight: 'bold' }}>
                            {data.metrics.error_rate}%
                        </div>
                    </div>
                </div>
            )}
            
            {activeIncident && (
                <div style={{ marginTop: '12px', background: 'rgba(255, 59, 92, 0.1)', padding: '8px', borderRadius: '4px', fontSize: '11px', color: 'var(--accent-danger)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AlertTriangle size={14} />
                    <span>{activeIncident.rule_triggered} ({activeIncident.severity})</span>
                </div>
            )}
        </div>
    );
}
