import asyncio
import httpx
import os
from datetime import datetime, timezone
from shared.redis_client import redis_c

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
        
    async def send_event(self, type_str, to_node=None):
        payload = {
            "type": type_str,
            "from_node": NODE_ID,
            "term": self.current_term,
            "to_node": to_node,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await redis_c.publish("election", payload)
        
    async def start_election(self):
        if self.is_dead or self.election_in_progress:
            return
            
        self.election_in_progress = True
        self.role = "CANDIDATE"
        self.current_term += 1
        self.current_leader = None
        
        await self.send_event("ELECTION_START")
        
        # In Bully, election goes to nodes with higher IDs
        higher_nodes = {k: v for k, v in PEERS_MAP.items() if int(k.replace('node', '')) > PRIORITY}
        
        if not higher_nodes:
            await self.declare_victory()
            return
            
        responses = 0
        async with httpx.AsyncClient(timeout=2.0) as client:
            for n_id, url in higher_nodes.items():
                await self.send_event("ELECTION", to_node=n_id)
                try:
                    res = await client.post(f"{url}/election", json={"from_node": NODE_ID, "term": self.current_term})
                    if res.status_code == 200 and res.json().get("status") == "OK":
                        responses += 1
                except Exception:
                    pass
                    
        # Give higher nodes a chance to take over if they said OK
        if responses == 0:
            await asyncio.sleep(2)
            if self.role == "CANDIDATE":
                await self.declare_victory()
        else:
            self.role = "FOLLOWER"
            self.election_in_progress = False

    async def handle_election_request(self, payload):
        if self.is_dead:
            return False
            
        from_node = payload["from_node"]
        term = payload["term"]
        
        if term > self.current_term:
            self.current_term = term
            self.role = "FOLLOWER"
            self.current_leader = None
            
        from_prio = int(from_node.replace('node', ''))
        
        if PRIORITY > from_prio:
            await self.send_event("OK", to_node=from_node)
            if not self.election_in_progress:
                asyncio.create_task(self.start_election())
            return True
        return False
        
    async def declare_victory(self):
        if self.is_dead:
            return
        self.role = "LEADER"
        self.current_leader = NODE_ID
        self.election_in_progress = False
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
        
    def handle_coordinator(self, leader_id, term):
        if term >= self.current_term or leader_id != self.current_leader:
            self.current_term = max(term, self.current_term)
            self.current_leader = leader_id
            self.role = "FOLLOWER"
            self.election_in_progress = False
