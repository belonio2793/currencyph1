#!/usr/bin/env bash
# Simple supervisor: restarts the world worker if it exits unexpectedly
WORKER_CMD="node scripts/world-worker.js"
MAX_RESTARTS=10
restart_count=0

while true; do
  echo "Starting world worker..."
  $WORKER_CMD
  exit_code=$?
  echo "Worker exited with code $exit_code"
  restart_count=$((restart_count+1))
  if [ "$restart_count" -ge "$MAX_RESTARTS" ]; then
    echo "Reached max restarts ($MAX_RESTARTS). Exiting supervisor."
    exit 1
  fi
  echo "Restarting in 5s... (restart #$restart_count)"
  sleep 5
done
