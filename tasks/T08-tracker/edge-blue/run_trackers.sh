#!/bin/zsh
# usage: ./run_trackers.sh  (from edge-blue; Node 24 via nvm)
set -euo pipefail
cd "${0:A:h}"
source ~/.nvm/nvm.sh && nvm use >/dev/null
node pkmn_run.ts out/games.jsonl out/views-pkmn.jsonl > out/errs-pkmn.json
uv run python pe_run.py out/games.jsonl out/views-pokeenv.jsonl > out/errs-pokeenv.json
uv run python ../compare.py out/games.jsonl out/truth.jsonl out/views-pkmn.jsonl pkmn out/ex-pkmn.jsonl 30 > out/cmp-pkmn.json
uv run python ../compare.py out/games.jsonl out/truth.jsonl out/views-pokeenv.jsonl pokeenv out/ex-pokeenv.jsonl 30 > out/cmp-pokeenv.json
