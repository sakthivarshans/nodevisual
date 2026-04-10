import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
from shared.redis_client import redis_c

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_connections = []
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.append(connection)
                
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

async def redis_listener():
    pubsub = await redis_c.get_subscriber(
        "metrics", "heartbeat", "incident", "election", "response", "recovery", "leader_change", "propagation"
    )
    from datetime import datetime, timezone
    
    async for message in pubsub.listen():
        if message["type"] == "message":
            channel = message["channel"]
            data = message["data"]
            try:
                parsed_data = json.loads(data)
                node_id = parsed_data.get("node_id") or parsed_data.get("from_node")
                
                # Transform internally so the dashboard receives unified events
                ws_msg = {
                    "type": channel.upper(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "node_id": node_id,
                    "data": parsed_data
                }
                
                if channel == "election":
                    # Special parsing for Election logs
                    ws_msg["type"] = "ELECTION"
                    
                await manager.broadcast(ws_msg)
            except Exception as e:
                pass
