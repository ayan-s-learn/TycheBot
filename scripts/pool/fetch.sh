#!/usr/bin/env bash
# Snapshots T12's sources into tasks/T12-pool-v1/evidence/, skipping files already there:
# Smogon's sample teams and analysis sets, the 1760 chaos stats for $MONTH, every page of each thread
# in threads.txt (gzipped), and every pokepast.es paste those pages link, bundled into pastes.jsonl.gz.
# Fetches one request at a time with a pause. Usage, from the root: scripts/pool/fetch.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
MONTH=2026-10
ev=tasks/T12-pool-v1/evidence
cache=${PASTE_CACHE:-$ev/.pastes}   # per-paste downloads, bundled at the end; not committed
mkdir -p "$ev/threads" "$cache"
get() { # url file
  [ -s "$2" ] && return 0
  curl -sSf --retry 3 --max-time 60 -o "$2.tmp" "$1" && mv "$2.tmp" "$2"
  sleep "${PAUSE:-1}"
}
get https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json "$ev/sample-teams.json"
get https://pkmn.github.io/smogon/data/sets/gen9nationaldex.json "$ev/analysis-sets.json"
chaos="$ev/chaos-gen9nationaldex-1760-$MONTH.json"
if [ ! -s "$chaos.gz" ]; then
  get "https://www.smogon.com/stats/$MONTH/chaos/gen9nationaldex-1760.json" "$chaos"
  gzip -n -9 "$chaos"
fi
grep -v '^#' scripts/pool/threads.txt | while read -r url; do
  slug=$(basename "$url"); dir="$ev/threads/$slug"; mkdir -p "$dir"
  if [ ! -s "$dir/page-1.html.gz" ]; then get "$url" "$dir/page-1.html"; gzip -n -9 "$dir/page-1.html"; fi
  id=${slug##*.}
  last=$(zcat "$dir/page-1.html.gz" | grep -o "\.$id/page-[0-9]*" | sed 's/.*page-//' | sort -n | tail -1 || true)
  for ((p = 2; p <= ${last:-1}; p++)); do
    if [ ! -s "$dir/page-$p.html.gz" ]; then get "${url}page-$p" "$dir/page-$p.html"; gzip -n -9 "$dir/page-$p.html"; fi
  done
done
ids=$(zcat "$ev"/threads/*/page-*.html.gz | grep -o 'pokepast\.es/[0-9a-f]\{16\}' | sed 's/.*\///' | sort -u)
for id in $ids; do get "https://pokepast.es/$id/json" "$cache/$id.json" || echo "paste $id: fetch failed" >&2; done
# One line per paste, sorted by id: {"id": ..., "body": <the response text, verbatim>}.
for id in $ids; do
  [ -s "$cache/$id.json" ] && node -e 'process.stdout.write(JSON.stringify({id: process.argv[1], body: require("fs").readFileSync(process.argv[2], "utf8")}) + "\n")' "$id" "$cache/$id.json"
done | gzip -n -9 > "$ev/pastes.jsonl.gz"
echo "$(echo "$ids" | wc -l) pastes linked, $(zcat "$ev/pastes.jsonl.gz" | wc -l) bundled"
