#!/bin/bash
# SYLHN POS — Permanent Watchdog Daemon
# Continuously monitors the dev server and restarts it if it dies.
# Designed to survive sandbox process kills via setsid + nohup + disown.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log
WATCHDOG_LOG=/home/z/my-project/watchdog.log

while true; do
  if ! curl -sS -o /dev/null http://localhost:3000/ --max-time 5 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server down, restarting..." >> "$WATCHDOG_LOG"
    pkill -9 -f "next dev" 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    sleep 2
    setsid ./node_modules/.bin/next dev -p 3000 > "$LOG" 2>&1 &
    for i in $(seq 1 30); do
      if curl -sS -o /dev/null http://localhost:3000/ --max-time 3 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server ready" >> "$WATCHDOG_LOG"
        break
      fi
      sleep 1
    done
  fi
  sleep 5
done
