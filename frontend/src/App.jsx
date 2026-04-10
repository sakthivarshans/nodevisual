import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import TopologyMap from './components/TopologyMap';
import NodeCard from './components/NodeCard';
import IncidentTimeline from './components/IncidentTimeline';
import EventStream from './components/EventStream';
import ElectionVisualizer from './components/ElectionVisualizer';
import DemoControls from './components/DemoControls';
import PolicyPanel from './components/PolicyPanel';

const INIT_NODES = Object.fromEntries(
  [1, 2, 3, 4, 5].map(i => [`node${i}`, {
    role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now()
  }])
);

export default function App() {
  const { isConnected, lastMessage } = useWebSocket('ws://localhost:9000/ws');

  const [nodes, setNodes] = useState(INIT_NODES);
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [elections, setElections] = useState([]);
  const [responses, setResponses] = useState([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [violatedNodes, setViolatedNodes] = useState([]);
  const [policyThresholds, setPolicyThresholds] = useState({ latency: 800, cpu: 85 });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, node_id, data } = lastMessage;
    setEvents(prev => [...prev.slice(-199), lastMessage]);

    if (type === 'METRICS') {
      setNodes(prev => ({
        ...prev,
        [node_id]: {
          ...prev[node_id],
          metrics: data,
          status: prev[node_id].status === 'DEAD' ? 'DEAD'
            : (data.error_rate > 10 || data.latency_ms > policyThresholds.latency || data.cpu_percent > policyThresholds.cpu
              ? 'DEGRADED' : 'HEALTHY')
        }
      }));
    } else if (type === 'HEARTBEAT') {
      setNodes(prev => ({
        ...prev,
        [node_id]: { ...prev[node_id], lastHeartbeat: Date.now() }
      }));
    } else if (type === 'INCIDENT' || type === 'INCIDENT_RESOLVED') {
      setIncidents(prev => {
        const idx = prev.findIndex(i => i.id === data.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = data; return n; }
        return [data, ...prev].slice(0, 50);
      });
      if (data.rule_triggered === 'NODE_DOWN') {
        setNodes(prev => ({
          ...prev,
          [node_id]: {
            ...prev[node_id],
            status: type === 'INCIDENT_RESOLVED' ? 'HEALTHY' : 'DEAD',
            role: type === 'INCIDENT_RESOLVED' ? 'FOLLOWER' : 'DEAD'
          }
        }));
      }
    } else if (type === 'ELECTION') {
      setElections(prev => [...prev.slice(-99), lastMessage]);
      if (data.type === 'COORDINATOR') {
        setNodes(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(k => {
            if (next[k].status !== 'DEAD')
              next[k] = { ...next[k], role: k === data.from_node ? 'LEADER' : 'FOLLOWER' };
          });
          return next;
        });
      } else if (data.type === 'ELECTION_START' || data.type === 'ELECTION') {
        setNodes(prev => {
          if (prev[node_id]?.status === 'DEAD') return prev;
          return { ...prev, [node_id]: { ...prev[node_id], role: 'CANDIDATE' } };
        });
      }
    } else if (type === 'RESPONSE') {
      setResponses(prev => [...prev.slice(-19), lastMessage]);
    } else if (type === 'RECOVERY') {
      setNodes(prev => ({ ...prev, [node_id]: { ...prev[node_id], status: 'HEALTHY', role: 'FOLLOWER' } }));
    } else if (type === 'PROPAGATION') {
      // Propagation handling happens mostly visually through passing the array to TopologyMap
      // and natively appearing in the EventStream through `events` state.
      // But we can store recent propagations to pass down for visualization context if needed.
      // Since `events` already holds everything, we can just filter it inside children.
    }
  }, [lastMessage]);

  const handlePolicyUpdate = useCallback((cfg) => {
    setPolicyThresholds({ latency: cfg.latency_threshold, cpu: cfg.cpu_threshold });
    setNodes(prev => {
      const violated = Object.entries(prev)
        .filter(([, d]) => d.metrics && (
          d.metrics.latency_ms > cfg.latency_threshold || d.metrics.cpu_percent > cfg.cpu_threshold
        ))
        .map(([id]) => id);
      setViolatedNodes(violated);
      setTimeout(() => setViolatedNodes([]), 2000);
      return prev;
    });
  }, []);

  const leader = Object.keys(nodes).find(k => nodes[k].role === 'LEADER') || 'None';
  const healthyCount = Object.values(nodes).filter(n => n.status === 'HEALTHY').length;
  const activeIncidents = incidents.filter(i => i.status === 'ACTIVE').length;

  return (
    <div className="layout">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, background: 'var(--blue)', borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#fff', fontWeight: 700, flexShrink: 0
            }}>D</div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              DIRS <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12 }}>· Incident Response</span>
            </span>
          </div>
          <DemoControls />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="stat-pill">
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: healthyCount === 5 ? 'var(--green)' : 'var(--amber)',
              display: 'inline-block'
            }} />
            <span style={{ color: 'var(--text-2)' }}>{healthyCount}/5 Healthy</span>
          </div>

          {activeIncidents > 0 && (
            <div className="stat-pill" style={{ background: 'var(--red-light)', borderColor: '#FECACA' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>{activeIncidents} Active</span>
            </div>
          )}

          <div className="stat-pill">
            <span style={{ color: 'var(--text-2)' }}>Leader:</span>
            <span style={{ fontWeight: 600, color: 'var(--green)', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
              {leader}
            </span>
          </div>

          <div className="stat-pill">
            <span className={`conn-dot ${isConnected ? 'conn-dot-live' : 'conn-dot-dead'}`} />
            <span style={{ color: isConnected ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'JetBrains Mono', paddingLeft: 4 }}>
            {time}
          </div>
        </div>
      </header>

      {/* ── Main Section ────────────────────────────────────── */}
      <div className="main-section">

        {/* Topology (65%) */}
        <div className="map-area">
          <div style={{ marginBottom: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Network Topology
            </span>
          </div>
          <div className="map-area-inner">
            <TopologyMap nodes={nodes} elections={elections} traffic={responses} events={events} />
          </div>
        </div>

        {/* Sidebar (35%) */}
        <div className="sidebar">
          <div style={{ padding: '12px 16px 0', flexShrink: 0, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Node Status
            </span>
          </div>
          <div className="sidebar-scroll">
            {Object.keys(nodes).map(nodeId => (
              <NodeCard
                key={nodeId}
                nodeId={nodeId}
                data={nodes[nodeId]}
                activeIncident={incidents.find(i => i.node_id === nodeId && i.status === 'ACTIVE')}
                violated={violatedNodes.includes(nodeId)}
              />
            ))}
            <PolicyPanel nodes={nodes} onPolicyUpdate={handlePolicyUpdate} />
          </div>
        </div>
      </div>

      {/* ── Bottom Section ───────────────────────────────────── */}
      <div className="bottom-section">

        <div className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-title-dot" style={{ background: 'var(--red)' }} />
                Live Incidents
              </div>
              {activeIncidents > 0 && (
                <span className="badge badge-red">{activeIncidents} active</span>
              )}
            </div>
            <div className="panel-scroll">
              <IncidentTimeline incidents={incidents} />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-inner">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-title-dot" style={{ background: 'var(--blue)' }} />
                Event Stream
              </div>
              <span className="badge badge-blue">{events.length} events</span>
            </div>
            <div className="panel-scroll">
              <EventStream events={events} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ borderRight: 'none' }}>
          <div className="panel-inner">
            <div className="panel-header">
              <div className="panel-title">
                <span className="panel-title-dot" style={{ background: 'var(--amber)' }} />
                Election Visualizer
              </div>
            </div>
            <ElectionVisualizer elections={elections} leader={leader} nodes={nodes} />
          </div>
        </div>

      </div>
    </div>
  );
}
