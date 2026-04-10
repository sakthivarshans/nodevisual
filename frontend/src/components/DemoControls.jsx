import React, { useState } from 'react';

export default function DemoControls() {
    const [selectedNode, setSelectedNode] = useState('node1');
    
    const postAction = (node, action) => {
        fetch(`http://localhost:800${node.replace('node', '')}/${action}`, { method: 'POST' }).catch(() => {});
    };
    
    return (
        <div className="demo-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-blue" onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: false, demo_active: true })
            })}>▶ Start Demo</button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-alt)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <select 
                 value={selectedNode} 
                 onChange={(e) => setSelectedNode(e.target.value)}
                 style={{ padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontWeight: 600, fontSize: 13 }}
              >
                  {[1,2,3,4,5].map(i => (
                      <option key={i} value={`node${i}`}>Node {i}</option>
                  ))}
              </select>
              <button className="btn btn-red" onClick={() => postAction(selectedNode, 'kill')} style={{ padding: '6px 12px' }}>💥 Kill</button>
              <button className="btn btn-amber" onClick={() => postAction(selectedNode, 'slow')} style={{ padding: '6px 12px' }}>🐢 Slow</button>
            </div>
            
            <button className="btn btn-purple" onClick={() => fetch('http://localhost:9000/policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restart_threshold: 1, latency_threshold: 800, cpu_threshold: 85, auto_recovery: true, cooldown_seconds: 30, chaos_mode: true, demo_active: true })
            })}>⚡ Chaos Mode</button>
            <button className="btn btn-green" onClick={() => {
                [1,2,3,4,5].forEach(i => postAction(`node${i}`, 'recover'));
            }}>🔄 Reset All</button>
        </div>
    );
}
