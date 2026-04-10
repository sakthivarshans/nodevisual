import React, { useEffect, useRef } from 'react';

export default function EventStream({ events }) {
    const endRef = useRef(null);
    
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [events]);

    const getColor = (type) => {
        if (type === 'HEARTBEAT') return 'rgba(0, 212, 255, 0.4)';
        if (type === 'METRICS') return 'rgba(107, 143, 174, 0.6)';
        if (type === 'INCIDENT') return 'var(--accent-danger)';
        if (type === 'ELECTION') return 'var(--accent-warning)';
        if (type === 'RESPONSE' || type === 'RECOVERY') return 'var(--accent-success)';
        return 'var(--text-secondary)';
    };

    return (
        <div style={{ overflowY: 'auto', height: '100%', padding: '8px', background: 'var(--bg-dark)', borderRadius: '4px' }} className="mono">
            {events.slice(-50).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '10px', marginBottom: '4px', color: getColor(ev.type) }}>
                    <span style={{ opacity: 0.5 }}>[{new Date(ev.timestamp).toISOString().split('T')[1].slice(0, 12)}]</span>
                    <span style={{ width: '80px' }}>[{ev.type}]</span>
                    <span style={{ width: '60px' }}>{ev.node_id}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {JSON.stringify(ev.data)}
                    </span>
                </div>
            ))}
            <div ref={endRef} />
        </div>
    );
}
