#!/bin/sh
# Start the FocusQuiz quiz server in the background (survives this shell).
# Env overrides: PORT, BANK_PATH, GOAL_PATH, TZ.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8077}"
nohup env PORT="$PORT" python3 server.py > server.log 2>&1 &
echo "quiz server starting on 127.0.0.1:$PORT (pid $!) — logs: server/server.log"
