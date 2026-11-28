#!/usr/bin/env bash
# T12's acceptance checks, from a set-up checkout (AGENTS.md, Conventions; run `nvm use` first).
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "== type check"
node vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tasks/T12-pool-v1/tsconfig.json
echo "== pool validates"
node scripts/validate-pool.ts data/pool/v1/teams.jsonl
echo "== library sets validate; training species covered; no set only from a held-out team"
node scripts/pool/check-library.ts data/priors/v0/species_sets.json data/pool/v1
echo "== rebuild from the snapshots"
tmp=$(mktemp -d)
node scripts/pool/build.ts "$tmp" > "$tmp/build-report.txt"
for f in data/pool/v1/teams.jsonl data/pool/v1/holdout.txt data/priors/v0/species_sets.json; do cmp "$f" "$tmp/$f"; done
cmp tasks/T12-pool-v1/evidence/build-report.txt "$tmp/build-report.txt"
rm -rf "$tmp"
echo "rebuild identical: teams.jsonl, holdout.txt, species_sets.json, build-report.txt"
