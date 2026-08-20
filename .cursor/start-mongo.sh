#!/usr/bin/env bash
# Idempotently start a local MongoDB for the test suite (Cloud Agent VM has no
# systemd, so mongod is launched directly instead of via systemctl/docker).
set -euo pipefail

MONGO_PORT="${MONGO_PORT:-27017}"
DATA_DIR="${MONGO_DATA_DIR:-$HOME/.cache/mongodb/data}"
LOG_DIR="${MONGO_LOG_DIR:-$HOME/.cache/mongodb}"
LOG_FILE="$LOG_DIR/mongod.log"
PID_FILE="$LOG_DIR/mongod.pid"

mkdir -p "$DATA_DIR" "$LOG_DIR"

# Already accepting connections? Nothing to do.
if mongosh --quiet --port "$MONGO_PORT" --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
  echo "MongoDB already running on port $MONGO_PORT"
  exit 0
fi

# Clean up a stale lock left by a previous boot before starting.
rm -f "$DATA_DIR/mongod.lock"

mongod \
  --dbpath "$DATA_DIR" \
  --port "$MONGO_PORT" \
  --bind_ip 127.0.0.1 \
  --logpath "$LOG_FILE" \
  --pidfilepath "$PID_FILE" \
  --fork

# Wait until it accepts connections.
for _ in $(seq 1 30); do
  if mongosh --quiet --port "$MONGO_PORT" --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
    echo "MongoDB is ready on port $MONGO_PORT"
    exit 0
  fi
  sleep 1
done

echo "MongoDB failed to become ready; last log lines:" >&2
tail -n 20 "$LOG_FILE" >&2 || true
exit 1
