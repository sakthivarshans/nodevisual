import React, { useState, useEffect, useRef } from 'react';

const SIZE = 520;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 180;
const NR = 36;

const POSITIONS = [1, 2, 3, 4, 5].map(i => {
  const a = (Math.PI * 2 * (i - 1)) / 5 - Math.PI / 2;
  return { id: `node${i}`, x: CX + RADIUS * Math.cos(a), y: CY + RADIUS * Math.sin(a) };
});

function getP(id) { return POSITIONS.find(p => p.id === id); }

function nodeColors(status, role) {
  if (status === 'DEAD')      return { fill: '#FEE2E2', stroke: '#EF4444', text: '#B91C1C' };
  if (role === 'LEADER')      return { fill: '#DCFCE7', stroke: '#22C55E', text: '#15803D' };
  if (role === 'CANDIDATE')   return { fill: '#FFFBEB', stroke: '#F59E0B', text: '#92400E' };
  if (status === 'DEGRADED')  return { fill: '#FFFBEB', stroke: '#F59E0B', text: '#92400E' };
  return { fill: '#EFF6FF', stroke: '#3B82F6', text: '#1D4ED8' };
}

export default function TopologyMap({ nodes, elections, traffic, events }) {
  const [arrows, setArrows] = useState([]);
  const [particles, setParticles] = useState([]);
  const [glows, setGlows] = useState({});

  // Election arrows
  useEffect(() => {
    if (!elections?.length) return;
    const last = elections[elections.length - 1];
    if (Date.now() - new Date(last.timestamp).getTime() > 3000) return;
    const d = last.data;
    if (!d.from_node) return;

    const isCoord = d.type === 'COORDINATOR';
    const color = isCoord ? '#22C55E' : '#F59E0B';

    if (isCoord) {
      const newArrows = POSITIONS
        .filter(p => p.id !== d.from_node)
        .map(p => ({ id: Math.random(), from: d.from_node, to: p.id, color, born: Date.now() }));
      setArrows(newArrows);
    } else if (d.to_node && d.to_node !== 'ALL') {
      setArrows([{ id: Math.random(), from: d.from_node, to: d.to_node, color, born: Date.now() }]);
    }
  }, [elections]);

  // Remove arrows after 900ms
  useEffect(() => {
    if (!arrows.length) return;
    const t = setTimeout(() => setArrows([]), 900);
    return () => clearTimeout(t);
  }, [arrows]);

  const lastPropTsRef = useRef(0);

  // Propagation logic
  useEffect(() => {
    if (!events?.length) return;
    
    const newProps = events.filter(e => 
      e.type === 'PROPAGATION' && 
      new Date(e.timestamp).getTime() > lastPropTsRef.current
    );
    
    if (!newProps.length) return;
    lastPropTsRef.current = new Date(events[events.length - 1].timestamp).getTime();

    newProps.forEach(last => {
      const d = last.data;
      if (d.status === 'IN_PROGRESS') {
        const p1 = getP(d.from_node);
        const p2 = getP(d.to_node);
        if (p1 && p2) {
          const color = d.delay > 1.0 ? '#F59E0B' : '#3B82F6';
          const dur = d.delay > 1.0 ? 3.0 : 0.5;
          const newP = { id: Math.random(), p1, p2, color, dur };
          setParticles(prev => [...prev, newP]);
          setTimeout(() => {
            setParticles(prev => prev.filter(p => p.id !== newP.id));
          }, dur * 1000);
        }
      } else if (d.status === 'DELIVERED') {
        setGlows(prev => ({ ...prev, [d.to_node]: 'var(--blue)' }));
        setTimeout(() => setGlows(prev => ({ ...prev, [d.to_node]: null })), 800);
      } else if (d.status === 'FAILED') {
        setGlows(prev => ({ ...prev, [d.to_node]: 'var(--red)' }));
        setTimeout(() => setGlows(prev => ({ ...prev, [d.to_node]: null })), 800);
      }
    });
  }, [events]);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="map-svg" style={{ maxHeight: '100%', maxWidth: '100%' }}>
      <defs>
        <marker id="arr-green" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="#22C55E" />
        </marker>
        <marker id="arr-amber" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="#F59E0B" />
        </marker>
        {/* Soft drop shadow for cards */}
        <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.10" />
        </filter>
      </defs>

      {/* Connection lines */}
      {POSITIONS.map((p1, i) =>
        POSITIONS.slice(i + 1).map(p2 => {
          const n1 = nodes[p1.id], n2 = nodes[p2.id];
          if (!n1 || !n2 || n1.status === 'DEAD' || n2.status === 'DEAD') return null;
          return (
            <line key={`${p1.id}-${p2.id}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#E5E7EB" strokeWidth="1.5"
            />
          );
        })
      )}

      {/* Traffic reroute lines */}
      {traffic?.slice(-2).map((t, i) => {
        if (t.data.action !== 'REROUTE') return null;
        const p1 = getP(t.data.node_id), p2 = getP(t.data.to);
        if (!p1 || !p2) return null;
        return (
          <line key={`tr-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#22C55E" strokeWidth="2" strokeDasharray="6,5"
          >
            <animate attributeName="stroke-dashoffset" from="44" to="0" dur="1s" repeatCount="indefinite" />
          </line>
        );
      })}

      {/* Propagation Particles */}
      {particles.map(p => (
        <circle key={p.id} r="5" fill={p.color} filter="url(#card-shadow)">
          <animate attributeName="cx" values={`${p.p1.x};${p.p2.x}`} dur={`${p.dur}s`} fill="freeze" />
          <animate attributeName="cy" values={`${p.p1.y};${p.p2.y}`} dur={`${p.dur}s`} fill="freeze" />
        </circle>
      ))}

      {/* Election arrows */}
      {arrows.map(arr => {
        const p1 = getP(arr.from), p2 = getP(arr.to);
        if (!p1 || !p2) return null;
        const markerId = arr.color === '#22C55E' ? 'arr-green' : 'arr-amber';
        return (
          <line key={arr.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={arr.color} strokeWidth="2" markerEnd={`url(#${markerId})`} opacity="0.85"
          >
            <animate attributeName="opacity" values="0;0.85" dur="0.2s" fill="freeze" />
          </line>
        );
      })}

      {/* Nodes */}
      {POSITIONS.map(p => {
        const node = nodes[p.id];
        if (!node) return null;
        const { fill, stroke, text } = nodeColors(node.status, node.role);
        const isLeader = node.role === 'LEADER';
        const isDead = node.status === 'DEAD';
        const glow = glows[p.id];

        return (
          <g key={p.id} transform={`translate(${p.x},${p.y})`} style={{ transition: 'all 0.3s ease' }}>
            {/* Dynamic Glow for Propagation */}
            {glow && (
               <circle r={NR + 15} fill={glow} opacity="0" className={glow === 'var(--red)' ? 'drop-pulse' : 'glow-burst'} />
            )}

            {/* Card shadow bg */}
            <circle r={NR + 3} fill="#fff" filter="url(#card-shadow)" />

            {/* Main circle */}
            <circle r={NR} fill={fill} stroke={stroke} strokeWidth="2.5" style={{ transition: 'all 0.3s ease' }} />

            {/* Leader outer ring */}
            {isLeader && (
              <circle r={NR + 7} fill="none" stroke="#22C55E" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
            )}

            {/* Node label */}
            <text y={node.metrics && !isDead ? -8 : 2}
              fill={text} fontSize="11" fontWeight="700" textAnchor="middle"
              fontFamily="JetBrains Mono" style={{ transition: 'all 0.3s' }}
            >
              {p.id.replace('node', 'N')}
            </text>

            {/* Metrics */}
            {node.metrics && !isDead && (
              <text y={8} fill={text} fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono" opacity="0.75">
                {node.metrics.cpu_percent}% · {node.metrics.latency_ms}ms
              </text>
            )}

            {/* Status text if no metrics */}
            {(!node.metrics || isDead) && (
              <text y={isDead ? 6 : 15} fill={text} fontSize="9" textAnchor="middle" fontFamily="Inter" fontWeight="600" opacity="0.8">
                {isDead ? 'DOWN' : node.status}
              </text>
            )}

            {isLeader && (
              <text y={NR + 16} fill="#15803D" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="Inter">
                LEADER
              </text>
            )}
            {node.role === 'CANDIDATE' && (
              <text y={NR + 16} fill="#92400E" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="Inter">
                CANDIDATE
              </text>
            )}
            
            {node.lastPacket && !isDead && (
              <g transform={`translate(0, ${-NR - 14})`}>
                <rect x="-30" y="-9" width="60" height="14" rx="4" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1" />
                <text y="2" fill="#1D4ED8" fontSize="8" textAnchor="middle" fontWeight="700" fontFamily="JetBrains Mono">
                   {node.lastPacket}
                </text>
              </g>
            )}
            
            {glow === 'var(--blue)' && (
               <text y={NR + 28} fill="var(--blue)" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="Inter">
                RECEIVED
              </text>
            )}
            {glow === 'var(--red)' && (
               <text y={NR + 28} fill="var(--red)" fontSize="9" textAnchor="middle" fontWeight="700" fontFamily="Inter">
                DROPPED
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
