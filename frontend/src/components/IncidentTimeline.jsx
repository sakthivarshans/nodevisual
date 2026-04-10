import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function IncidentTimeline({ incidents }) {
  if (!incidents.length) {
    return (
      <div style={{ color: 'var(--text-3)', fontSize: 12, padding: 16, textAlign: 'center' }}>
        No incidents recorded. System stable.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {incidents.slice(0, 10).map(inc => {
        const isActive = inc.status === 'ACTIVE';
        const isCrit = inc.severity === 'CRITICAL';
        
        let typeClass = 'resolved';
        if (isActive) typeClass = isCrit ? 'crit' : 'warn';
        
        const borderColor = isActive 
          ? (isCrit ? 'var(--red)' : 'var(--amber)')
          : 'var(--green)';
          
        return (
          <div key={inc.id} className={`incident-entry ${typeClass}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isActive ? <AlertCircle size={13} color={borderColor} /> : <CheckCircle2 size={13} color={borderColor} />}
                <strong style={{ color: 'var(--text)', fontSize: 11.5, letterSpacing: '0.2px' }}>
                  {inc.rule_triggered}
                </strong>
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>
                {new Date(inc.timestamp_detected).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: inc.action_taken ? 6 : 0 }}>
              Node: <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text)', fontWeight: 600 }}>
                {inc.node_id.replace('node', 'NODE ')}
              </span>
            </div>
            
            {inc.action_taken && (
              <div style={{ 
                color: 'var(--blue)', 
                background: 'var(--blue-light)', 
                padding: '4px 8px', 
                borderRadius: 'var(--radius-xs)', 
                fontSize: 10.5,
                fontWeight: 500,
                border: '1px solid #DBEAFE'
              }}>
                ↳ {inc.action_taken}
              </div>
            )}
            
            {!isActive && (
              <div style={{ color: 'var(--green)', marginTop: 4, fontSize: 10, fontWeight: 500 }}>
                Resolved at {new Date(inc.timestamp_resolved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
