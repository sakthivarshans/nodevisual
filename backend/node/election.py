import asyncio
import httpx
import os
from datetime import datetime, timezone
from shared.redis_client import redis_c
from .metrics import metrics_sim

NODE_ID = os.getenv("NODE_ID", "node1")
PRIORITY = int(os.getenv("PRIORITY", "1"))
PEERS_STR = os.getenv("PEERS", "")
PEERS_MAP = {}
if PEERS_STR:
    for p in PEERS_STR.split(","):
        if "=" in p:
            k, v = p.split("=")
            PEERS_MAP[k] = v

class ElectionManager:
    def __init__(self):
        self.role = "FOLLOWER" 
        self.current_leader = None
        self.current_term = 0
        self.election_in_progress = False
        self.is_dead = False
        self.candidates = {}
        
    def get_health_score(self):
        m = metrics_sim.get_metrics()
        err_ratio = m["error_rate"] / 100.0
        score = (100 - m["cpu_percent"]) * 0.4 + (1000 - m["latency_ms"]) * 0.4 + (100 - err_ratio * 100) * 0.2
        return round(max(0, score), 2)

    async def send_event(self, type_str, to_node=None, score=None):
        payload = {
            "type": type_str,
            "from_node": NODE_ID,
            "term": self.current_term,
            "to_node": to_node,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        if score is not None:
            payload["score"] = score
        await redis_c.publish("election", payload)
        
    async def start_election(self):
        if self.is_dead or self.election_in_progress:
            return
            
        self.election_in_progress = True
        self.role = "CANDIDATE"
        self.current_term += 1
        self.current_leader = None
        self.candidates.clear()
        
        my_score = self.get_health_score()
        self.candidates[NODE_ID] = my_score
        
        await self.send_event("ELECTION_DETECTED")
        await self.send_event("CANDIDATE_SCORE", score=my_score)
        
        async with httpx.AsyncClient(timeout=2.0) as client:
            for p, url in PEERS_MAP.items():
                try:
                    await client.post(f"{url}/election", json={"from_node": NODE_ID, "term": self.current_term, "score": my_score})
                except Exception:
                    pass
                    
        await asyncio.sleep(2)
        
        if self.is_dead or not self.election_in_progress:
            return
            
        best_node = NODE_ID
        best_score = my_score
        
        for n_id, sc in self.candidates.items():
            if sc > best_score:
                best_score = sc
                best_node = n_id
            elif sc == best_score:
                n1_prio = int(n_id.replace('node', ''))
                best_prio = int(best_node.replace('node', ''))
                if n1_prio > best_prio:
                    best_node = n_id
                    
        if best_node == NODE_ID:
            await self.declare_victory()
        else:
            self.role = "FOLLOWER"
            self.election_in_progress = False
            self.candidates.clear()

    async def handle_election_request(self, payload):
        if self.is_dead:
            return False
            
        from_node = payload["from_node"]
        term = payload["term"]
        score = payload.get("score")
        
        if term > self.current_term:
            self.current_term = term
            self.current_leader = None
            if not self.election_in_progress:
                asyncio.create_task(self.start_election())
                
        if score is not None:
            self.candidates[from_node] = score
            
        return True
        
    async def declare_victory(self):
        if self.is_dead:
            return
        self.role = "LEADER"
        self.current_leader = NODE_ID
        self.election_in_progress = False
        self.candidates.clear()
        
        await self.send_event("COORDINATOR", to_node="ALL")
        async with httpx.AsyncClient(timeout=2.0) as client:
            for n_id, url in PEERS_MAP.items():
                try:
                    await client.post(f"{url}/coordinator", json={"leader": NODE_ID, "term": self.current_term})
                except Exception:
                    pass
                    
    def step_down(self):
        self.role = "FOLLOWER"
        self.election_in_progress = False
        self.candidates.clear()
        
    def handle_coordinator(self, leader_id, term):
        if term >= self.current_term or leader_id != self.current_leader:
            self.current_term = max(term, self.current_term)
            self.current_leader = leader_id
            self.role = "FOLLOWER"
            self.election_in_progress = False
            self.candidates.clear()
