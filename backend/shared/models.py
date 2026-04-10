from pydantic import BaseModel
from typing import Optional, Any, Dict, List

class HealthStatus(BaseModel):
    node_id: str
    status: str
    uptime: int
    timestamp: float

class MetricsPayload(BaseModel):
    node_id: str
    cpu_percent: float
    memory_percent: float
    latency_ms: float
    error_rate: float
    request_count: int
    timestamp: str

class HeartbeatPayload(BaseModel):
    from_node: str
    timestamp: str
    term: int

class ElectionPayload(BaseModel):
    from_node: str
    term: int

class CoordinatorPayload(BaseModel):
    leader: str
    term: int

class IncidentRecord(BaseModel):
    id: str
    node_id: str
    rule_triggered: str
    severity: str
    status: str
    timestamp_detected: str
    timestamp_resolved: Optional[str] = None
    action_taken: Optional[str] = None
