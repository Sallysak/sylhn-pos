#!/bin/bash
# SYLHN POS — Keep-Alive Server Loop
#
# This script runs as the FOREGROUND process (replacing `next dev` in package.json).
# It starts the Next.js dev server in the foreground, and when the server dies
# (killed by the sandbox OOM killer, signal, or crash), it immediately restarts it.
#
# This is the permanent fix for "sandbox is inactive" / 502 errors:
# the `bun run dev` command now runs THIS script instead of `next dev` directly,
# so the server is always restarted within 1-2 seconds of dying.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log

echo "[KEEP-ALIVE] Starting permanent server loop..."

while true; do
  echo "[KEEP-ALIVE] [$(date '+%H:%M:%S')] Starting Next.js dev server..."

  # Run next dev in the FOREGROUND (not background) so this script blocks
  # until the server exits. When it exits (crash/kill), the loop restarts it.
  ./node_modules/.bin/next dev -p 3000 2>&1 | tee "$LOG"

  EXIT_CODE=${PIPESTATUS[0]}
  echo "[KEEP-ALIVE] [$(date '+%H:%M:%S')] Server exited with code $EXIT_CODE, restarting in 2s..."

  # Kill any stale processes before restarting
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next dev" 2>/dev/null

  sleep 2
done
