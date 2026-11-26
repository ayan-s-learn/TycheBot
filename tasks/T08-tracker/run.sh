#!/bin/zsh
# Reruns the whole harness from this folder on Node 24 (after setup, AGENTS.md Conventions): records games 0-499,
# replays them for the sim's state, runs both trackers, compares, and summarizes. Recorded games, truth and views
# go to out/ (gitignored, ~0.8 GB); counts go to results/. About 75 seconds. Timing is separate (README, Outputs).
set -euo pipefail
cd "${0:A:h}"
mkdir -p out results
R=../../data/replays/v0
POKE_ENV_DATA="$(uv run python -c 'import os, poke_env; print(os.path.dirname(poke_env.__file__))')/data/static"

node record.ts out/games.jsonl 0-499
node truth.ts out/games.jsonl out/truth.jsonl

# Stage 1: errors on the recorded games and on T04's replays, and data lag.
node pkmn.ts games out/games.jsonl out/views-pkmn.jsonl > results/stage1-pkmn-games.json
node pkmn.ts games out/games.jsonl out/views-pkmn-default.jsonl default > results/stage1-pkmn-games-default.json
uv run python pokeenv.py games out/games.jsonl out/views-pokeenv.jsonl > results/stage1-pokeenv-games.json
node pkmn.ts replays $R/replays.jsonl.gz $R/high-rated.jsonl.gz > results/stage1-pkmn-replays.json
uv run python pokeenv.py replays $R/replays.jsonl.gz $R/high-rated.jsonl.gz > results/stage1-pokeenv-replays.json
node datalag.ts "$POKE_ENV_DATA" > results/datalag.json

# Stages 2 and 3: the diff against the sim, then every mismatch class assigned a cause.
uv run python compare.py out/games.jsonl out/truth.jsonl out/views-pkmn.jsonl pkmn results/examples-pkmn.jsonl \
	> results/compare-pkmn.json
uv run python compare.py out/games.jsonl out/truth.jsonl out/views-pokeenv.jsonl pokeenv results/examples-pokeenv.jsonl \
	> results/compare-pokeenv.json
uv run python summarize.py results/compare-pkmn.json results/compare-pokeenv.json > results/summary.json
