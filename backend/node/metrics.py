import random
import os
from datetime import datetime, timezone

NODE_ID = os.getenv("NODE_ID", "node_x")

class MetricsSimulator:
    def __init__(self):
        self.slow_mode = False
        self.is_dead = False
        self.base_cpu = 35.0
        self.request_count = 0

    def get_metrics(self) -> dict:
        self.request_count += random.randint(10, 50)
        
        cpu = random.gauss(self.base_cpu, 10.0)
        
        if self.slow_mode:
            cpu = random.uniform(75.0, 95.0)
            latency = random.uniform(1500, 4000)
            error_rate = random.uniform(15, 30)
        else:
            latency = random.uniform(50, 500)
            error_rate = random.uniform(0, 2)
            
        cpu = max(0.0, min(100.0, cpu))
        
        return {
            "node_id": NODE_ID,
            "cpu_percent": round(cpu, 2),
            "memory_percent": round(random.uniform(40, 60), 2),
            "latency_ms": int(latency),
            "error_rate": round(error_rate, 2),
            "request_count": self.request_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

metrics_sim = MetricsSimulator()
