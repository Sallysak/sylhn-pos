#!/bin/bash
# SYLHN POS — Permanent Watchdog
# Runs forever: monitors port 3000 and restarts the production server
# whenever it dies. Designed to survive sandbox process kills via setsid.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log
WLOG=/home/z/my-project/watchdog.log

while true; do
  if ! curl -sS -o /dev/null http://localhost:3000/ --max-time 3 2>/dev/null; then
    echo "[$(date '+%H:%M:%S')] DOWN — restarting..." >> "$WLOG"
    pkill -9 -f "next start" 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    sleep 1
    setsid ./node_modules/.bin/next start -p 3000 > "$LOG" 2>&1 &
    # Wait up to 10s for it to be ready
    for i in $(seq 1 10); do
      if curl -sS -o /dev/null http://localhost:3000/ --max-time 2 2>/dev/null; then
        echo "[$(date '+%H:%M:%S')] UP" >> "$WLOG"
        break
      fi
      sleep 1
    done
  fi
  sleep 3
done
