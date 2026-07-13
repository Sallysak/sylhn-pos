#!/bin/bash
# SYLHN POS — Server Watchdog
# Continuously monitors and restarts the dev server if it dies.
# This solves the "sandbox is inactive" error by keeping the server alive.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log
PIDFILE=/home/z/my-project/dev.pid

while true; do
  # Check if server is running
  if curl -sS -o /dev/null http://localhost:3000/ --max-time 5 2>/dev/null; then
    # Server is alive, wait and check again
    sleep 10
    continue
  fi

  echo "[$(date)] Server is down, restarting..."
  
  # Kill any stale processes
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 2

  # Start fresh
  setsid bash -c './node_modules/.bin/next dev -p 3000 > '"$LOG"' 2>&1' < /dev/null &
  echo $! > "$PIDFILE"
  echo "[$(date)] Started dev server (PID $!)"

  # Wait for it to be ready
  for i in $(seq 1 30); do
    if curl -sS -o /dev/null http://localhost:3000/ --max-time 3 2>/dev/null; then
      echo "[$(date)] Server is ready on http://localhost:3000"
      break
    fi
    sleep 1
  done

  # Keep monitoring — if server dies, the loop will restart it
  sleep 5
done
