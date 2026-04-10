import React, { useState, useEffect, useRef } from 'react';

function stepStyle(d) {
  if (d.type === 'COORDINATOR')    return { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D', icon: '👑' };
  if (d.type === 'ELECTION_START') return { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '⚡' };
  if (d.type === 'ELECTION')       return { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '⚡' };
  if (d.type === 'OK')             return { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D', icon: '✓' };
  return { bg: '#F9FAFB', border: '#E5E7EB', color: '#6B7280', icon: '→' };
}

export default function ElectionVisualizer({ elections, leader, nodes }) {
  const [steps, setSteps] = useState([]);
  const [term, setTerm] = useState(0);
  const [isElecting, setIsElecting] = useState(false);
  const queueRef = useRef([]);
  const busyRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!elections.length) return;
    const last = elections[elections.length - 1];
    queueRef.current.push(last);
    if (!busyRef.current) drain();
  }, [elections]);

  function drain() {
    if (!queueRef.current.length) { busyRef.current = false; return; }
    busyRef.current = true;
    const ev = queueRef.current.shift();
    const d = ev.data;

    if (d.term) setTerm(d.term);
    const isFinal = d.type === 'COORDINATOR';
    setIsElecting(!isFinal);

    let label = '';
    if (d.type === 'ELECTION_START') label = `Election started by ${d.from_node}`;
    else if (d.type === 'COORDINATOR') label = `${d.from_node} elected as Leader`;
    else if (d.type === 'OK') label = `${d.from_node} → OK → ${d.to_node}`;
    else label = `${d.from_node} ${d.type} → ${d.to_node || 'ALL'}`;

    setSteps(prev => [...prev.slice(-19), { id: Math.random(), d, label, ts: Date.now() }]);
    setTimeout(() => drain(), 500);
  }

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [steps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, minHeight: 0 }}>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <div className="el-term-badge">Term {term}</div>

        <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', gap: 4, alignItems: 'center' }}>
          Leader:
          <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--green)', fontSize: 11 }}>
            {leader !== 'NONE' ? leader : '—'}
          </span>
        </div>

        {isElecting && (
          <div className="el-progress-badge">Electing</div>
        )}
      </div>

      {/* Step log */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {!steps.length ? (
          <div style={{ color: 'var(--text-3)', fontSize: 11, padding: '10px 0', textAlign: 'center' }}>
            No elections yet
          </div>
        ) : (
          steps.map((s, i) => {
            const style = stepStyle(s.d);
            const isLatest = i === steps.length - 1;
            return (
              <div key={s.id} className="election-step" style={{
                background: isLatest ? style.bg : 'transparent',
                border: `1px solid ${isLatest ? style.border : 'transparent'}`,
                color: isLatest ? style.color : 'var(--text-2)',
              }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{style.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: isLatest ? 600 : 400, lineHeight: 1.4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'JetBrains Mono', marginTop: 1 }}>
                    {new Date(s.ts).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
