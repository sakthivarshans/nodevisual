import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import TopologyMap from './components/TopologyMap';
import NodeCard from './components/NodeCard';
import IncidentTimeline from './components/IncidentTimeline';
import EventStream from './components/EventStream';
import ElectionVisualizer from './components/ElectionVisualizer';
import DemoControls from './components/DemoControls';
import PolicyPanel from './components/PolicyPanel';
import { Clock } from 'lucide-react';

export default function App() {
  const { isConnected, lastMessage } = useWebSocket('ws://localhost:9000/ws');
  
  const [nodes, setNodes] = useState({
    node1: { role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now() },
    node2: { role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now() },
    node3: { role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now() },
    node4: { role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now() },
    node5: { role: 'FOLLOWER', metrics: null, status: 'HEALTHY', lastHeartbeat: Date.now() },
  });
  
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [elections, setElections] = useState([]);
  const [responses, setResponses] = useState([]);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    
    const { type, timestamp, node_id, data } = lastMessage;
    setEvents(prev => [...prev.slice(-199), lastMessage]);
    
    if (type === 'METRICS') {
      setNodes(prev => ({
        ...prev,
        [node_id]: { 
          ...prev[node_id], 
          metrics: data,
          status: prev[node_id].status === 'DEAD' ? 'DEAD' : (data.error_rate > 10 || data.latency_ms > 800 ? 'DEGRADED' : 'HEALTHY')
        }
      }));
    } else if (type === 'HEARTBEAT') {
      setNodes(prev => ({
        ...prev,
        [node_id]: { ...prev[node_id], lastHeartbeat: Date.now() }
      }));
    } else if (type === 'INCIDENT' || type === 'INCIDENT_RESOLVED') {
      setIncidents(prev => {
        const existing = prev.findIndex(i => i.id === data.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = data;
          return next;
        }
        return [data, ...prev].slice(0, 50);
      });
      if (data.rule_triggered === 'NODE_DOWN') {
        setNodes(prev => ({
          ...prev, [node_id]: { ...prev[node_id], status: type === 'INCIDENT_RESOLVED' ? 'HEALTHY' : 'DEAD', role: type === 'INCIDENT_RESOLVED' ? 'FOLLOWER' : 'DEAD' }
        }));
      }
    } else if (type === 'ELECTION') {
      setElections(prev => [...prev.slice(-99), lastMessage]);
      if (data.type === 'COORDINATOR') {
          setNodes(prev => {
              const next = {...prev};
              Object.keys(next).forEach(k => {
                  if (next[k].status !== 'DEAD') {
                      next[k].role = k === data.from_node ? 'LEADER' : 'FOLLOWER';
                  }
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
        setNodes(prev => ({ ...prev, [node_id]: { ...prev[node_id], status: 'HEALTHY', role: 'FOLLOWER' }}));
    }
  }, [lastMessage]);

  const leader = Object.keys(nodes).find(k => nodes[k].role === 'LEADER') || 'NONE';
  const healthyCount = Object.values(nodes).filter(n => n.status === 'HEALTHY').length;
  const activeIncidents = incidents.filter(i => i.status === 'ACTIVE').length;

  return (
    <div className="dashboard-grid">
      <div className="panel header-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '2px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            DISTRIBUTED INCIDENT RESPONSE SYSTEM
          </h1>
          <DemoControls />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px' }} className="mono">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: healthyCount === 5 ? 'var(--accent-success)' : 'var(--accent-warning)'}}>{healthyCount}/5 NODES HEALTHY</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ color: activeIncidents > 0 ? 'var(--accent-danger)' : 'var(--text-secondary)'}}>{activeIncidents} ACTIVE INCIDENTS</span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ color: 'var(--accent-warning)' }}>LEADER: {leader.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Clock size={16} /> {time}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isConnected ? 'var(--accent-success)' : 'var(--accent-danger)', boxShadow: isConnected ? '0 0 10px var(--accent-success)' : '0 0 10px var(--accent-danger)' }}></div>
             {isConnected ? 'LIVE' : 'DISCONNECTED'}
          </div>
        </div>
      </div>

      <div className="panel map-panel">
         <h2 style={{margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)'}}>NETWORK TOPOLOGY</h2>
         <TopologyMap nodes={nodes} elections={elections} traffic={responses} />
      </div>

      <div className="sidebar-panel">
         {Object.keys(nodes).map(nodeId => (
             <NodeCard key={nodeId} nodeId={nodeId} data={nodes[nodeId]} activeIncident={incidents.find(i => i.node_id === nodeId && i.status === 'ACTIVE')} />
         ))}
         <PolicyPanel />
      </div>

      <div className="events-panel">
         <div className="panel" style={{ overflow: 'hidden', padding: '12px' }}>
            <h2 style={{margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)'}}>LIVE INCIDENTS</h2>
            <IncidentTimeline incidents={incidents} />
         </div>
         <div className="panel" style={{ overflow: 'hidden', padding: '12px' }}>
            <h2 style={{margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)'}}>EVENT STREAM (REDIS PUB/SUB)</h2>
            <EventStream events={events} />
         </div>
         <div className="panel" style={{ overflow: 'hidden', padding: '12px' }}>
            <h2 style={{margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)'}}>ELECTION VISUALIZER</h2>
            <ElectionVisualizer elections={elections} leader={leader} />
         </div>
      </div>
    </div>
  );
}
