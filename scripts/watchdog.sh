#!/bin/bash
# SYLHN POS — Permanent Server Watchdog
# This script runs as a daemon and continuously monitors the dev server.
# If the server dies, it restarts it within 5 seconds.
# It is designed to survive shell exits and process kills via setsid + nohup.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log
WATCHDOG_LOG=/home/z/my-project/watchdog.log
PIDFILE=/home/z/my-project/dev.pid

# Function: start the dev server
start_server() {
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1
  setsid ./node_modules/.bin/next dev -p 3000 > "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Started dev server (PID $!)" >> "$WATCHDOG_LOG"
  
  # Wait for it to be ready (max 30 seconds)
  for i in $(seq 1 30); do
    if curl -sS -o /dev/null http://localhost:3000/ --max-time 3 2>/dev/null; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server is ready on http://localhost:3000" >> "$WATCHDOG_LOG"
      return 0
    fi
    sleep 1
  done
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server failed to start in 30s" >> "$WATCHDOG_LOG"
  return 1
}

# Main loop — runs forever
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Watchdog started" >> "$WATCHDOG_LOG"

while true; do
  # Check if server is responding
  if ! curl -sS -o /dev/null http://localhost:3000/ --max-time 5 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server is down, restarting..." >> "$WATCHDOG_LOG"
    start_server
  fi
  sleep 5
done
