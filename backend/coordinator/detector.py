import asyncio
from datetime import datetime, timezone
import uuid
from shared.redis_client import redis_c
from .policy import config

class IncidentDetector:
    def __init__(self):
        self.running = False
        
    async def detect_loop(self):
        while self.running:
            await self.check_rules()
            await asyncio.sleep(5)
            
    async def check_rules(self):
        for node_id in [f"node{i}" for i in range(1, 6)]:
            metrics = await redis_c.get_value(f"node:{node_id}:metrics")
            if not metrics:
                continue
                
            now = datetime.now(timezone.utc).timestamp()
            m_time = datetime.fromisoformat(metrics["timestamp"]).timestamp()
            
            # RULE 3: NODE_DOWN
            if (now - m_time) > 10:
                await self.declare_incident(node_id, "NODE_DOWN", "CRITICAL")
                continue
                
            # RULE 1: HIGH_LATENCY
            if metrics["latency_ms"] > config.latency_threshold:
                key = f"fault_counts:{node_id}:latency"
                count = await redis_c.get_value(key) or 0
                count += 1
                await redis_c.set_value(key, count, ttl=20)
                if count >= 3:
                    await self.declare_incident(node_id, "HIGH_LATENCY", "WARNING")
            else:
                await redis_c.set_value(f"fault_counts:{node_id}:latency", 0, ttl=20)
                
            # RULE 2: HIGH_ERROR_RATE
            if metrics["error_rate"] > 10.0:
                await self.declare_incident(node_id, "HIGH_ERROR_RATE", "CRITICAL")
                
            # RULE 4: HIGH_CPU
            if metrics["cpu_percent"] > config.cpu_threshold:
                key = f"fault_counts:{node_id}:cpu"
                count = await redis_c.get_value(key) or 0
                count += 1
                await redis_c.set_value(key, count, ttl=20)
                if count >= 2:
                    await self.declare_incident(node_id, "HIGH_CPU", "WARNING")
            else:
                await redis_c.set_value(f"fault_counts:{node_id}:cpu", 0, ttl=20)
                
    async def declare_incident(self, node_id, rule, severity):
        active_ids = await redis_c.get_value("incidents:active") or []
        
        for inc_id in active_ids:
            inc = await redis_c.get_value(f"incidents:{inc_id}")
            if inc and inc["node_id"] == node_id and inc["rule_triggered"] == rule and inc["status"] == "ACTIVE":
                return # Prevent duplicate active incidents
                
        inc_id = str(uuid.uuid4())
        inc = {
            "id": inc_id,
            "node_id": node_id,
            "rule_triggered": rule,
            "severity": severity,
            "status": "ACTIVE",
            "timestamp_detected": datetime.now(timezone.utc).isoformat(),
            "timestamp_resolved": None,
            "action_taken": None
        }
        
        await redis_c.set_value(f"incidents:{inc_id}", inc)
        active_ids.append(inc_id)
        await redis_c.set_value("incidents:active", active_ids)
        
        await redis_c.publish("incident", inc)
        
        # Trigger response engine
        from .response import response_engine
        asyncio.create_task(response_engine.handle_incident(inc))

detector = IncidentDetector()
