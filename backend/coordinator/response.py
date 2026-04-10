import asyncio
import httpx
from datetime import datetime, timezone
from shared.redis_client import redis_c
from .policy import config

class ResponseEngine:
    async def handle_incident(self, incident):
        if not config.auto_recovery:
            return
            
        leader = await redis_c.get_value("leader:current")
        node_id = incident["node_id"]
        action_taken = None
        
        if incident["rule_triggered"] == "NODE_DOWN":
            action_taken = f"Restarting {node_id} in 5s"
            asyncio.create_task(self.delayed_restart(node_id, leader, 5))
            
        elif incident["rule_triggered"] == "HIGH_LATENCY":
            healthy_node = await self.find_healthy_node()
            if healthy_node:
                action_taken = f"Traffic rerouted to {healthy_node}"
                await redis_c.publish("response", {"node_id": node_id, "action": "REROUTE", "to": healthy_node})
                
        elif incident["rule_triggered"] == "HIGH_CPU":
            action_taken = f"Throttled {node_id} request rate by 50%"
            await redis_c.publish("response", {"node_id": node_id, "action": "THROTTLE"})
            
        if action_taken:
            incident["action_taken"] = f"Leader [{leader}] triggered: {action_taken}"
            await redis_c.set_value(f"incidents:{incident['id']}", incident)
            await redis_c.publish("response", {
                "incident_id": incident["id"],
                "node_id": node_id,
                "action_taken": incident["action_taken"],
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
    async def find_healthy_node(self):
        for i in range(1, 6):
            n = f"node{i}"
            status = await redis_c.get_value(f"node:{n}:status")
            if status: 
                return n
        return None
        
    async def delayed_restart(self, node_id, leader, delay):
        await asyncio.sleep(delay)
        port = f"800{node_id[-1]}"
        url = f"http://{node_id}:{port}/recover"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(url)
        except Exception:
            pass

response_engine = ResponseEngine()
