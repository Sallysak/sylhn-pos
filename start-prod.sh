#!/bin/bash
# SYLHN POS — Production server startup script with auto-restart
# Runs the pre-built standalone Next.js server. If it crashes, restarts it.
cd /home/z/my-project/sylhn-pos/.next/standalone

export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production
export DATABASE_URL=file:/home/z/my-project/sylhn-pos/db/custom.db
export SESSION_SECRET=dev-session-secret-32-chars-minimum-ok

while true; do
  echo "[$(date)] Starting SYLHN POS production server..."
  node server.js
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE. Restarting in 3s..."
  sleep 3
done
