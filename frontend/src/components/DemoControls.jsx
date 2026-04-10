import React from 'react';

export default function DemoControls() {
    const postAction = (node, action) => {
        fetch(`http://localhost:800${node.replace('node', '')}/${action}`, { method: 'POST' }).catch(() => {});
    };
    
    return (
        <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn" onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: false })
            })}>▶ START DEMO</button>
            <button className="btn btn-danger" onClick={() => postAction('node1', 'kill')}>💥 KILL NODE 1</button>
            <button className="btn btn-warning" onClick={() => postAction('node3', 'slow')}>🐢 SLOW NODE 3</button>
            <button className="btn" style={{ color: '#FF00FF', borderColor: '#FF00FF', border: '1px solid' }} onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: true })
            })}>⚡ CHAOS MODE</button>
            <button className="btn btn-success" onClick={() => {
                [1,2,3,4,5].forEach(i => postAction(`node${i}`, 'recover'));
            }}>🔄 RESET ALL</button>
        </div>
    );
}
