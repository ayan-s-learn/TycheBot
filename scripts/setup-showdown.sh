#!/usr/bin/env bash
# Fetches Showdown at the commit in showdown.pin into vendor/pokemon-showdown, builds it,
# and emits type declarations for sim/ and sim/tools/ so TS code can type-check against dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
sha=$(tr -d '[:space:]' < showdown.pin)
dir=vendor/pokemon-showdown

if [ ! -d "$dir/.git" ]; then
  git init -q "$dir"
  git -C "$dir" remote add origin https://github.com/smogon/pokemon-showdown.git
fi
if [ "$(git -C "$dir" rev-parse -q --verify HEAD || true)" != "$sha" ]; then
  git -C "$dir" fetch -q --depth 1 origin "$sha"
  git -C "$dir" checkout -q --detach "$sha"
fi
cd "$dir"
npm ci --no-audit --no-fund --loglevel=error
rm -rf dist  # the build only adds files, so a re-pin would keep stale modules
node build
node node_modules/typescript/bin/tsc --ignoreConfig sim/global-types.ts sim/index.ts \
  sim/tools/runner.ts sim/tools/exhaustive-runner.ts \
  --declaration --emitDeclarationOnly --declarationDir dist/ --target es2020 --strict \
  --module commonjs --moduleResolution bundler --types node --lib es2020
echo "Showdown $(git rev-parse HEAD) built with Node $(node --version)"
