# Distributed Incident Response System

A self-healing distributed monitoring and alerting platform showcasing distributed computing internals like the Bully Algorithm and automated responses.

## Architecture
- **Service Nodes (x5)**: Simulated microservices running FastAPI.
- **Coordinator**: Central event manager.
- **Frontend Dashboard**: Real-time React WebSocket UI.
- **Event Bus**: Redis Pub/Sub.

## Quick Start
Using Docker Compose:
```bash
docker-compose up --build
```

Then open `http://localhost:3000` in your browser.

## Ports
- `3000`: Dashboard
- `9000`: Coordinator
- `8001-8005`: Nodes
- `6379`: Redis
