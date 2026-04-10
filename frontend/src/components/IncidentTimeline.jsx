import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function IncidentTimeline({ incidents }) {
    if (!incidents.length) {
        return <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic', padding: '12px' }}>No incidents recorded. System stable.</div>;
    }

    return (
        <div style={{ overflowY: 'auto', height: '100%', paddingRight: '8px' }}>
            {incidents.slice(0, 10).map((inc, i) => {
                const isActive = inc.status === 'ACTIVE';
                const isCrit = inc.severity === 'CRITICAL';
                
                const borderColor = isActive 
                    ? (isCrit ? 'var(--accent-danger)' : 'var(--accent-warning)')
                    : 'var(--accent-success)';

                return (
                    <div key={inc.id} style={{
                        borderLeft: `3px solid ${borderColor}`,
                        background: 'var(--bg-dark)',
                        padding: '10px',
                        marginBottom: '8px',
                        borderRadius: '0 4px 4px 0',
                        fontSize: '11px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {isActive ? <AlertCircle size={14} color={borderColor} /> : <CheckCircle2 size={14} color={borderColor} />}
                                <strong style={{ color: 'var(--text-primary)' }}>{inc.rule_triggered}</strong>
                            </div>
                            <span style={{ color: 'var(--text-secondary)' }}>{new Date(inc.timestamp_detected).toLocaleTimeString()}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Node: <span className="mono" style={{ color: 'var(--text-primary)' }}>{inc.node_id}</span>
                        </div>
                        {inc.action_taken && (
                            <div style={{ color: 'var(--accent-cyan)', background: 'var(--surface)', padding: '4px', borderRadius: '4px', marginTop: '6px' }}>
                                &gt; {inc.action_taken}
                            </div>
                        )}
                        {!isActive && (
                            <div style={{ color: 'var(--accent-success)', marginTop: '4px' }}>
                                Resolved at {new Date(inc.timestamp_resolved).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
