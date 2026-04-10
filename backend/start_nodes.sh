#!/bin/bash
export REDIS_URL="redis://localhost:6379"
export PEERS="node1=http://127.0.0.1:8001,node2=http://127.0.0.1:8002,node3=http://127.0.0.1:8003,node4=http://127.0.0.1:8004,node5=http://127.0.0.1:8005"

for i in {1..5}; do
    NODE_ID="node$i" PRIORITY=$i uvicorn node.main:app --host 127.0.0.1 --port 800$i &
done

uvicorn coordinator.main:app --host 127.0.0.1 --port 9000 &
echo "Started all services"
wait
