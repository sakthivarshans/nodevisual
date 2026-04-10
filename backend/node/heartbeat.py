import asyncio
import os
import httpx
from datetime import datetime, timezone
from shared.redis_client import redis_c

NODE_ID = os.getenv("NODE_ID", "node1")
# Parse PEERS format: node2=http://node2:8002,node3=http://node3:8003
PEERS_STR = os.getenv("PEERS", "")
PEERS_MAP = {}
if PEERS_STR:
    for p in PEERS_STR.split(","):
        if "=" in p:
            k, v = p.split("=")
            PEERS_MAP[k] = v

class HeartbeatManager:
    def __init__(self, election_manager):
        self.election_manager = election_manager
        self.peers_last_seen = {p: datetime.now(timezone.utc).timestamp() for p in PEERS_MAP.keys()}
        self.running = False
        self.is_dead = False
        self.suspected_nodes = set()
        
    async def ping_peers(self):
        async with httpx.AsyncClient(timeout=2.0) as client:
            while self.running:
                if self.is_dead:
                    await asyncio.sleep(2)
                    continue
                    
                payload = {
                    "from_node": NODE_ID,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "term": self.election_manager.current_term
                }
                
                await redis_c.publish("heartbeat", payload)
                
                for peer_id, peer_url in PEERS_MAP.items():
                    try:
                        await client.post(f"{peer_url}/heartbeat", json=payload)
                    except Exception:
                        pass
                
                await asyncio.sleep(2)
                
    async def check_faults(self):
        while self.running:
            if self.is_dead:
                await asyncio.sleep(2)
                continue
                
            now = datetime.now(timezone.utc).timestamp()
            leader_dead = False
            
            for peer_id, last_seen in self.peers_last_seen.items():
                diff = now - last_seen
                
                if diff > 10:
                    if peer_id not in self.suspected_nodes:
                        self.suspected_nodes.add(peer_id)
                        
                    if peer_id == self.election_manager.current_leader:
                        leader_dead = True
                elif diff > 6:
                    if peer_id not in self.suspected_nodes:
                        self.suspected_nodes.add(peer_id)
                else:
                    if peer_id in self.suspected_nodes:
                        self.suspected_nodes.remove(peer_id)
                    
            if not leader_dead and self.election_manager.current_leader and self.election_manager.current_leader != NODE_ID:
                m = await redis_c.get_value(f"node:{self.election_manager.current_leader}:metrics")
                if m:
                    err = m["error_rate"] / 100.0
                    sc = (100 - m["cpu_percent"])*0.4 + (1000 - m["latency_ms"])*0.4 + (100 - err*100)*0.2
                    if sc < 150:
                        leader_dead = True

            if leader_dead and self.election_manager.current_leader != NODE_ID:
                asyncio.create_task(self.election_manager.start_election())
                
            await asyncio.sleep(2)

    def receive_heartbeat(self, payload):
        if self.is_dead:
            return
        from_node = payload["from_node"]
        term = payload["term"]
        
        if from_node in self.peers_last_seen:
            self.peers_last_seen[from_node] = datetime.now(timezone.utc).timestamp()
            
        if term > self.election_manager.current_term:
            self.election_manager.current_term = term
            self.election_manager.step_down()
