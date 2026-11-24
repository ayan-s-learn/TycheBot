#!/usr/bin/env bash
# T01 smoke test: Showdown at the pin (NatDex validation, in-process battles, local server)
# and PyTorch on MPS in the uv environment. Exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")"
echo "== $(uname -sm), Node $(node --version), $(uv --version)"

./setup-showdown.sh

echo "== validate-team gen9nationaldex"
ps=vendor/pokemon-showdown/pokemon-showdown
for f in teams/sample-1.txt teams/sample-2.txt; do
  node "$ps" validate-team gen9nationaldex < "$f"
  echo "$f: accepted"
done
if node "$ps" validate-team gen9nationaldex < teams/banned.txt; then
  echo "teams/banned.txt: accepted, expected a rejection" >&2
  exit 1
fi
echo "teams/banned.txt: rejected"

echo "== type check"
node vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tsconfig.json
echo "battle.ts: ok"

echo "== battles"
node battle.ts

echo "== local server"
./check-server.sh

echo "== python"
uv sync --locked
uv run python mps_check.py

echo "== smoke test passed"
