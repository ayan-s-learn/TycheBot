#!/usr/bin/env bash
# T05 acceptance checks. Needs a built vendor/ (scripts/setup-showdown.sh) and Node from .nvmrc.
set -euo pipefail
cd "$(dirname "$0")/../.."
pool=data/pool/v0/teams.jsonl
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "== commit $(git rev-parse --short HEAD), Node $(node --version)"
echo "== type check"
node vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tasks/T05-stub-pool/tsconfig.json
echo ok

echo "== pool validates"
node scripts/validate-pool.ts "$pool"

echo "== pool contents"
node tasks/T05-stub-pool/report.ts "$pool"

echo "== a banned Pokemon is rejected"
# Swaps Mewtwo into the first slot of the team on line 7.
node -e '
const fs = require("node:fs");
const [from, to] = process.argv.slice(1);
const lines = fs.readFileSync(from, "utf8").trimEnd().split("\n");
const entry = JSON.parse(lines[6]);
const sets = entry.team.split("]");
sets[0] = "Mewtwo||LifeOrb|Pressure|Psystrike,AuraSphere,IceBeam,Recover|Timid|4,,,252,,252|||||";
entry.team = sets.join("]");
lines[6] = JSON.stringify(entry);
fs.writeFileSync(to, lines.join("\n") + "\n");
' "$pool" "$tmp/banned.jsonl"
if node scripts/validate-pool.ts "$tmp/banned.jsonl" > "$tmp/out" 2>&1; then
	cat "$tmp/out"; echo "accepted, expected a rejection" >&2; exit 1
fi
cat "$tmp/out"
grep -q '^FAIL smogon-sample-06 (line 7' "$tmp/out"
grep -q 'Mewtwo is tagged ND Uber, which is banned' "$tmp/out"
grep -q '^19/20 teams valid' "$tmp/out"

echo "== acceptance checks passed"
