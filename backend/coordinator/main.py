from fastapi import FastAPI, WebSocket, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import List

from shared.redis_client import redis_c
from .detector import detector
from .websocket import manager, redis_listener
from .policy import config, PolicyConfig

app = FastAPI(title="Coordinator Cluster")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    detector.running = True
    asyncio.create_task(detector.detect_loop())
    asyncio.create_task(redis_listener())
    
    # Check for resolution of incidents
    asyncio.create_task(resolve_incidents_loop())

async def resolve_incidents_loop():
    from datetime import datetime, timezone
    while True:
        active_ids = await redis_c.get_value("incidents:active") or []
        for inc_id in list(active_ids):
            inc = await redis_c.get_value(f"incidents:{inc_id}")
            if not inc: continue
            
            node_id = inc["node_id"]
            metrics = await redis_c.get_value(f"node:{node_id}:metrics")
            
            if metrics:
                m_time = datetime.fromisoformat(metrics["timestamp"]).timestamp()
                now = datetime.now(timezone.utc).timestamp()
                is_fresh = (now - m_time) < 10
                
                resolved = False
                if inc["rule_triggered"] == "NODE_DOWN" and is_fresh:
                    resolved = True
                elif inc["rule_triggered"] == "HIGH_LATENCY" and metrics["latency_ms"] < config.latency_threshold:
                    resolved = True
                elif inc["rule_triggered"] == "HIGH_ERROR_RATE" and metrics["error_rate"] < 10:
                    resolved = True
                elif inc["rule_triggered"] == "HIGH_CPU" and metrics["cpu_percent"] < config.cpu_threshold:
                    resolved = True
                    
                if resolved:
                    inc["status"] = "RESOLVED"
                    inc["timestamp_resolved"] = datetime.now(timezone.utc).isoformat()
                    await redis_c.set_value(f"incidents:{inc_id}", inc)
                    # Note: Need atomic operations strictly, but list manipulation is okay here
                    current_active = await redis_c.get_value("incidents:active") or []
                    if inc_id in current_active:
                        current_active.remove(inc_id)
                        await redis_c.set_value("incidents:active", current_active)
                    
                    await manager.broadcast({
                        "type": "INCIDENT_RESOLVED",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "node_id": node_id,
                        "data": inc
                    })
        await asyncio.sleep(5)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)

@app.get("/incidents")
async def get_incidents():
    active_ids = await redis_c.get_value("incidents:active") or []
    incidents = []
    for i in active_ids:
        inc = await redis_c.get_value(f"incidents:{i}")
        if inc: incidents.append(inc)
    return incidents

@app.get("/nodes/status")
async def get_nodes_status():
    result = {}
    for i in range(1, 6):
        node_id = f"node{i}"
        status = await redis_c.get_value(f"node:{node_id}:status")
        metrics = await redis_c.get_value(f"node:{node_id}:metrics")
        result[node_id] = {
            "role": status,
            "metrics": metrics
        }
    return result

@app.get("/leader")
async def get_leader():
    # Evaluate leader from Redis context
    leader = await redis_c.get_value("leader:current")
    if leader:
        return {"leader": leader}
        
    for i in range(1, 6):
        status = await redis_c.get_value(f"node:node{i}:status")
        if status == "LEADER":
            await redis_c.set_value("leader:current", f"node{i}")
            return {"leader": f"node{i}"}
    return {"leader": None}

@app.post("/policy")
async def update_policy(new_config: PolicyConfig):
    config.restart_threshold = new_config.restart_threshold
    config.latency_threshold = new_config.latency_threshold
    config.cpu_threshold = new_config.cpu_threshold
    config.auto_recovery = new_config.auto_recovery
    config.cooldown_seconds = new_config.cooldown_seconds
    
    # Chaos mode toggle
    if new_config.chaos_mode and not config.chaos_mode:
        config.chaos_mode = True
        asyncio.create_task(chaos_worker())
    else:
        config.chaos_mode = new_config.chaos_mode
        
    await redis_c.set_value("policy:config", config.model_dump())
    return {"status": "updated", "config": config}
    
async def chaos_worker():
    import random
    import httpx
    while config.chaos_mode:
        await asyncio.sleep(random.randint(20, 40))
        if not config.chaos_mode: break
        
        target = random.randint(1, 5)
        action = random.choice(["kill", "slow"])
        url = f"http://node{target}:800{target}/{action}"
        try:
            async with httpx.AsyncClient() as client:
                await client.post(url)
        except Exception:
            pass
