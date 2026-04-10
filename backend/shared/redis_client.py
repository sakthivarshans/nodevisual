import os
import json
import redis.asyncio as redis
from typing import Any

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

class RedisClient:
    def __init__(self):
        self.client = redis.from_url(REDIS_URL, decode_responses=True)

    async def publish(self, channel: str, message: dict):
        payload = json.dumps(message)
        await self.client.publish(channel, payload)
        
    async def set_value(self, key: str, value: Any, ttl: int = None):
        if type(value) in [dict, list]:
            value = json.dumps(value)
        await self.client.set(key, value, ex=ttl)
        
    async def get_value(self, key: str):
        val = await self.client.get(key)
        if val:
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                return val
        return None

    async def get_subscriber(self, *channels):
        pubsub = self.client.pubsub()
        await pubsub.subscribe(*channels)
        return pubsub

redis_c = RedisClient()
