#!/usr/bin/env bash
# Starts the pinned Showdown server (as S2 and poke-env use it) and checks its websocket endpoint answers.
set -euo pipefail
cd "$(dirname "$0")"
port=${1:-8123}
mkdir -p out
(cd vendor/pokemon-showdown && exec node pokemon-showdown start --skip-build --no-security "$port") > out/server.log 2>&1 &
pid=$!
trap 'pkill -P $pid 2>/dev/null; kill $pid 2>/dev/null' EXIT
for _ in $(seq 60); do
  if info=$(curl -fsS "http://localhost:$port/showdown/info" 2>/dev/null); then
    echo "server answered on port $port: $info"
    exit 0
  fi
  sleep 1
done
echo "server did not answer within 60 s; see out/server.log" >&2
exit 1
