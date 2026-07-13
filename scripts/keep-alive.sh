#!/bin/bash
# SYLHN POS — Keep-alive wrapper for the Next.js dev server.
# Restarts the server if it dies. Used for long-running preview sessions.
cd /home/z/my-project

LOG=/home/z/my-project/dev.log
PIDFILE=/home/z/my-project/dev.pid

# Kill any existing dev server
if [ -f "$PIDFILE" ]; then
  OLDPID=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    kill "$OLDPID" 2>/dev/null
    sleep 2
  fi
fi
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

# Start the dev server in a new session, detached from this shell
setsid bash -c './node_modules/.bin/next dev -p 3000 > '"$LOG"' 2>&1' < /dev/null &
SRVPID=$!
echo "$SRVPID" > "$PIDFILE"
echo "Started dev server (session leader PID $SRVPID)"

# Wait for it to be ready
for i in {1..20}; do
  if curl -sS -o /dev/null http://localhost:3000/ --max-time 3 2>/dev/null; then
    echo "Server is ready on http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "Server did not become ready in 20s"
exit 1
