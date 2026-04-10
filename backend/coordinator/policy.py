from pydantic import BaseModel

class PolicyConfig(BaseModel):
    restart_threshold: int = 1
    latency_threshold: int = 800
    cpu_threshold: int = 85
    auto_recovery: bool = True
    cooldown_seconds: int = 30
    chaos_mode: bool = False

config = PolicyConfig()
