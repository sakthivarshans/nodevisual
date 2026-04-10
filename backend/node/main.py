from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import asyncio
import os
import time

from .metrics import metrics_sim
from .election import ElectionManager
from .heartbeat import HeartbeatManager
from shared.redis_client import redis_c

app = FastAPI(title=f"Service Node {os.getenv('NODE_ID', 'N/A')}")
election_mgr = ElectionManager()
hb_mgr = HeartbeatManager(election_mgr)

NODE_ID = os.getenv("NODE_ID", "node_x")
uptime_start = time.time()

async def metrics_publisher():
    while True:
        if not metrics_sim.is_dead:
            m = metrics_sim.get_metrics()
            await redis_c.publish("metrics", m)
            # Update latest state in Redis for fast access
            await redis_c.set_value(f"node:{NODE_ID}:metrics", m, ttl=30)
            await redis_c.set_value(f"node:{NODE_ID}:status", election_mgr.role, ttl=30)
        await asyncio.sleep(3)

@app.on_event("startup")
async def startup_event():
    hb_mgr.running = True
    asyncio.create_task(hb_mgr.ping_peers())
    asyncio.create_task(hb_mgr.check_faults())
    asyncio.create_task(metrics_publisher())
    
    # Wait for things to settle, then maybe initiate election
    await asyncio.sleep(5)
    if election_mgr.current_leader is None:
        asyncio.create_task(election_mgr.start_election())

@app.get("/health")
def health():
    if metrics_sim.is_dead:
        raise HTTPException(status_code=503, detail="Node is dead")
    return {
        "node_id": NODE_ID,
        "status": "HEALTHY" if not metrics_sim.slow_mode else "DEGRADED",
        "uptime": int(time.time() - uptime_start),
        "timestamp": time.time()
    }

@app.get("/metrics")
def get_metrics():
    if metrics_sim.is_dead:
        raise HTTPException(status_code=503, detail="Node is dead")
    if metrics_sim.slow_mode:
        time.sleep(2.5) 
    return metrics_sim.get_metrics()

@app.post("/kill")
async def kill_node():
    metrics_sim.is_dead = True
    hb_mgr.is_dead = True
    election_mgr.is_dead = True
    await redis_c.publish("incident", {"node_id": NODE_ID, "type": "KILLED_BY_OPERATOR"})
    return {"status": "killed"}

@app.post("/slow")
def slow_node():
    metrics_sim.slow_mode = True
    return {"status": "slowed"}

@app.post("/recover")
async def recover_node():
    metrics_sim.is_dead = False
    metrics_sim.slow_mode = False
    hb_mgr.is_dead = False
    election_mgr.is_dead = False
    election_mgr.step_down()
    
    # Reset peers heartbeat tracking
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).timestamp()
    for peer in hb_mgr.peers_last_seen.keys():
        hb_mgr.peers_last_seen[peer] = now
        
    await redis_c.publish("recovery", {"node_id": NODE_ID, "timestamp": time.time()})
    return {"status": "recovered"}

@app.get("/id")
def get_id():
    return {
        "node_id": NODE_ID,
        "role": election_mgr.role,
        "leader": election_mgr.current_leader
    }

@app.post("/heartbeat")
async def receive_heartbeat(req: Request):
    if hb_mgr.is_dead:
        return JSONResponse(status_code=503, content={"error": "dead"})
    data = await req.json()
    hb_mgr.receive_heartbeat(data)
    return {"status": "ok"}

@app.post("/election")
async def receive_election(req: Request):
    if election_mgr.is_dead:
        return JSONResponse(status_code=503, content={"error": "dead"})
    data = await req.json()
    responded_ok = await election_mgr.handle_election_request(data)
    return {"status": "OK" if responded_ok else "IGNORED"}

@app.post("/coordinator")
async def receive_coordinator(req: Request):
    if election_mgr.is_dead:
        return JSONResponse(status_code=503, content={"error": "dead"})
    data = await req.json()
    election_mgr.handle_coordinator(data["leader"], data["term"])
    return {"status": "ok"}
