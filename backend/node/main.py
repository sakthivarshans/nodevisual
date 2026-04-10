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

async def stream_worker():
    import uuid
    while True:
        await asyncio.sleep(1.5)
        policy_raw = await redis_c.get_value("policy:config")
        demo_active = policy_raw.get("demo_active", False) if policy_raw else False
        
        if demo_active and election_mgr.role == "LEADER" and not metrics_sim.is_dead and not election_mgr.election_in_progress:
            packet_id = f"pkt_{str(uuid.uuid4())[:8]}"
            asyncio.create_task(process_propagation({
                "packet_id": packet_id,
                "from_node": "COORDINATOR",
                "ttl": 5,
                "path": []
            }))

@app.on_event("startup")
async def startup_event():
    hb_mgr.running = True
    asyncio.create_task(hb_mgr.ping_peers())
    asyncio.create_task(hb_mgr.check_faults())
    asyncio.create_task(metrics_publisher())
    asyncio.create_task(stream_worker())
    
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

seen_files = set()

@app.post("/receive_file")
async def receive_file(req: Request):
    data = await req.json()
    asyncio.create_task(process_propagation(data))
    return {"status": "accepted"}

async def process_propagation(data: dict):
    import httpx
    packet_id = data.get("packet_id")
    from_node = data.get("from_node")
    path = data.get("path", [])
    ttl = data.get("ttl", 5)
    
    if packet_id in seen_files:
        return
    seen_files.add(packet_id)
    
    if ttl <= 0:
        return
    
    if metrics_sim.is_dead:
        await redis_c.publish("propagation", {
            "from_node": from_node,
            "to_node": NODE_ID,
            "packet_id": packet_id,
            "status": "FAILED",
            "delay": 0,
            "ttl": ttl,
            "path": path
        })
        return
        
    score = election_mgr.get_health_score()
    
    if score > 150:
        delay = 0.5
    elif score > 50:
        delay = 1.5
    else:
        delay = 3.0
        
    new_path = path + [NODE_ID]
    
    await redis_c.publish("propagation", {
        "from_node": from_node,
        "to_node": NODE_ID,
        "packet_id": packet_id,
        "status": "DELIVERED",
        "delay": delay,
        "ttl": ttl,
        "path": new_path
    })
    
    await asyncio.sleep(delay)
    
    while election_mgr.current_leader is None and not metrics_sim.is_dead:
        await asyncio.sleep(1)
        
    if metrics_sim.is_dead or ttl - 1 <= 0:
        return
    
    peer_scores = []
    for peer in hb_mgr.peers_last_seen.keys():
        if peer in new_path: continue
        
        status = await redis_c.get_value(f"node:{peer}:status")
        if status == "DEAD": continue
            
        m = await redis_c.get_value(f"node:{peer}:metrics")
        sc = 100
        if m:
            err = m["error_rate"] / 100.0
            sc = (100 - m["cpu_percent"])*0.4 + (1000 - m["latency_ms"])*0.4 + (100 - err*100)*0.2
            
        peer_scores.append({"id": peer, "score": sc})
        
    if not peer_scores:
        return
        
    def get_num(n): return int(n.replace('node', ''))
    peer_scores.sort(key=lambda x: get_num(x["id"]))
    
    target_peer = peer_scores[0]["id"]
    
    await redis_c.publish("propagation", {
        "from_node": NODE_ID,
        "to_node": target_peer,
        "packet_id": packet_id,
        "status": "IN_PROGRESS",
        "delay": delay,
        "ttl": ttl - 1,
        "path": new_path
    })
    
    async def forward(p=target_peer):
        try:
            port = f"800{p[-1]}"
            async with httpx.AsyncClient() as client:
                await client.post(f"http://{p}:{port}/receive_file", json={
                    "packet_id": packet_id,
                    "from_node": NODE_ID,
                    "delay": delay,
                    "ttl": ttl - 1,
                    "path": new_path
                })
        except Exception:
            pass
    
    asyncio.create_task(forward())
