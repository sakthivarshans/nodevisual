import React from 'react';

export default function DemoControls() {
    const postAction = (node, action) => {
        fetch(`http://localhost:800${node.replace('node', '')}/${action}`, { method: 'POST' }).catch(() => {});
    };
    
    return (
        <div className="demo-controls">
            <button className="btn btn-blue" onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: false })
            })}>▶ Start Demo</button>
            <button className="btn btn-red" onClick={() => postAction('node1', 'kill')}>💥 Kill Node 1</button>
            <button className="btn btn-amber" onClick={() => postAction('node3', 'slow')}>🐢 Slow Node 3</button>
            <button className="btn btn-purple" onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: true })
            })}>⚡ Chaos Mode</button>
            <button className="btn btn-green" onClick={() => {
                [1,2,3,4,5].forEach(i => postAction(`node${i}`, 'recover'));
            }}>🔄 Reset All</button>
        </div>
    );
}
