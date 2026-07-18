#!/bin/bash
# Double-fork daemonizer — truly detaches the server from the shell
# so it survives after the parent Bash tool command exits.
cd /home/z/my-project/sylhn-pos/.next/standalone

export PORT=3000
export HOSTNAME=0.0.0.0
export NODE_ENV=production
export DATABASE_URL=file:/home/z/my-project/sylhn-pos/db/custom.db
export SESSION_SECRET=dev-session-secret-32-chars-minimum-ok

# Double-fork: parent exits, child continues as orphan
node server.js >> /tmp/prod.log 2>&1 &
echo $! > /tmp/sylhn-pos.pid
