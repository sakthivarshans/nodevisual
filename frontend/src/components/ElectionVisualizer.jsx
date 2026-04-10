import React from 'react';

export default function ElectionVisualizer({ elections, leader }) {
    if (!elections.length) {
        return <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic', padding: '12px' }}>Waiting for election...</div>;
    }

    return (
        <div style={{ overflowY: 'auto', height: '100%', padding: '12px', background: 'var(--bg-dark)', borderRadius: '4px' }} className="mono">
            <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--accent-cyan)' }}>CURRENT LEADER: {leader.toUpperCase()}</div>
            </div>
            
            {elections.slice(-15).reverse().map((el, i) => {
                const isFinal = el.data.type === 'COORDINATOR';
                const isStart = el.data.type === 'ELECTION_START';
                
                let text = '';
                if (isStart) text = `Term ${el.data.term} Election Started by ${el.data.from_node}`;
                else if (isFinal) text = `${el.data.from_node} is now LEADER (Term ${el.data.term})`;
                else text = `${el.data.from_node} → ${el.data.type} → ${el.data.to_node || 'ALL'}`;
                
                return (
                    <div key={i} style={{
                        fontSize: '11px',
                        marginBottom: '6px',
                        color: isFinal ? 'var(--accent-cyan)' : (isStart ? 'var(--accent-warning)' : 'var(--text-secondary)')
                    }}>
                        {text}
                    </div>
                );
            })}
        </div>
    );
}
