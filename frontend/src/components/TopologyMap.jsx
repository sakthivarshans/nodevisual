import React, { useState, useEffect } from 'react';

const SIZE = 800;
const CENTER = SIZE / 2;
const RADIUS = 250;
const NODE_R = 40;

export default function TopologyMap({ nodes, elections, traffic }) {
    const positions = [1, 2, 3, 4, 5].map(i => {
        const angle = (Math.PI * 2 * (i - 1)) / 5 - Math.PI / 2;
        return {
            id: `node${i}`,
            x: CENTER + RADIUS * Math.cos(angle),
            y: CENTER + RADIUS * Math.sin(angle)
        };
    });

    const getHexagonPoints = (cx, cy, r) => {
        let pts = [];
        for (let i = 0; i < 6; i++) {
            let angle = Math.PI / 3 * i - Math.PI / 6;
            pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        return pts.join(' ');
    };

    const getNodeColor = (status, role) => {
        if (status === 'DEAD') return 'var(--accent-danger)';
        if (status === 'DEGRADED' || role === 'CANDIDATE') return 'var(--accent-warning)';
        if (role === 'LEADER') return 'var(--accent-cyan)';
        return 'var(--text-secondary)';
    };
    
    const [animatedArrows, setAnimatedArrows] = useState([]);
    
    // Simulate animated routing or election arrows
    useEffect(() => {
        if (!elections || elections.length === 0) return;
        const last = elections[elections.length - 1];
        if (Date.now() - new Date(last.timestamp).getTime() < 2000) {
            const data = last.data;
            if (data.to_node && data.to_node !== 'ALL') {
                 setAnimatedArrows(prev => [...prev.slice(-4), {
                     from: data.from_node,
                     to: data.to_node,
                     color: 'var(--accent-warning)',
                     id: Math.random()
                 }]);
            }
        }
    }, [elections]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="map-svg" style={{ maxHeight: '100%', maxWidth: '100%' }}>
                {/* Connection lines */}
                {positions.map((p1, i) => 
                    positions.slice(i + 1).map((p2) => {
                        const n1 = nodes[p1.id];
                        const n2 = nodes[p2.id];
                        const bothAlive = n1.status !== 'DEAD' && n2.status !== 'DEAD';
                        const degraded = n1.status === 'DEGRADED' || n2.status === 'DEGRADED';
                        
                        if (!bothAlive) return null;
                        
                        return (
                            <line 
                                key={`${p1.id}-${p2.id}`}
                                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                stroke={degraded ? 'var(--accent-warning)' : 'rgba(0, 212, 255, 0.2)'}
                                strokeWidth={degraded ? 1 : 2}
                                strokeDasharray={degraded ? "5,5" : "none"}
                            />
                        );
                    })
                )}
                
                {/* Traffic Reroute Arrows */}
                {traffic.slice(-2).map((t, i) => {
                    if (t.data.action !== "REROUTE") return null;
                    const p1 = positions.find(p => p.id === t.data.node_id);
                    const p2 = positions.find(p => p.id === t.data.to);
                    if (!p1 || !p2) return null;
                    
                    return (
                        <g key={`traffic-${i}`}>
                            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--accent-success)" strokeWidth="4" strokeDasharray="10,10">
                                <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite" />
                            </line>
                        </g>
                    );
                })}

                {/* Nodes */}
                {positions.map((p) => {
                    const node = nodes[p.id];
                    const color = getNodeColor(node.status, node.role);
                    const isLeader = node.role === 'LEADER';
                    
                    return (
                        <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                            {/* Pulse background */}
                            {node.status !== 'DEAD' && (
                                <circle r={NODE_R} fill="none" stroke={color} strokeWidth="2" opacity="0.5">
                                    <animate attributeName="r" values={`${NODE_R};${NODE_R*2}`} dur="2s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
                                </circle>
                            )}
                            
                            <polygon 
                                points={getHexagonPoints(0, 0, NODE_R)} 
                                fill="var(--surface)" 
                                stroke={color} 
                                strokeWidth={isLeader ? 4 : 2}
                                style={{ filter: isLeader ? 'drop-shadow(0 0 10px rgba(0, 212, 255, 0.5))' : 'none' }}
                            />
                            
                            <text x="0" y="-8" fill="var(--text-primary)" fontSize="14" textAnchor="middle" className="mono" fontWeight="bold">
                                {p.id.toUpperCase()}
                            </text>
                            
                            {node.metrics && node.status !== 'DEAD' ? (
                                <>
                                    <text x="0" y="8" fill="var(--text-secondary)" fontSize="10" textAnchor="middle" className="mono">
                                        CPU: {node.metrics.cpu_percent}%
                                    </text>
                                    <text x="0" y="20" fill="var(--text-secondary)" fontSize="10" textAnchor="middle" className="mono">
                                        LAT: {node.metrics.latency_ms}ms
                                    </text>
                                </>
                            ) : (
                                <text x="0" y="10" fill={color} fontSize="12" textAnchor="middle" className="mono" fontWeight="bold">
                                    {node.status}
                                </text>
                            )}
                            
                            {isLeader && (
                                <text x="0" y={-NODE_R - 10} fill="#FFB800" fontSize="20" textAnchor="middle">👑</text>
                            )}
                            {node.role === 'CANDIDATE' && (
                                <text x="0" y={-NODE_R - 10} fill="#FFB800" fontSize="16" textAnchor="middle">⏳</text>
                            )}
                            {node.status === 'DEAD' && (
                                <text x="0" y={-NODE_R - 10} fill="#FF3B5C" fontSize="20" textAnchor="middle">💀</text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
