#!/bin/bash
# Auto-restart wrapper: runs `next dev` and restarts it if it dies
cd /home/z/my-project
while true; do
  ./node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  pkill -9 -f "next-server" 2>/dev/null
  sleep 2
done
