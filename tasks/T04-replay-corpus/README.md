# T04: replay corpus

## Brief

- **Objective:** collect at least 1,000 public `gen9nationaldex` replays. They give turns per game for the Compute estimates (S1 measures ms per turn; plan.md, Phase 0) and game lengths for the turn cap (Training v0). Phase 1's robustness test reuses them (≥1,000 replays parse without error).
- **Inputs:**
  - plan.md (Phase 0: S1; Training v0: turn cap; Phase 1 exit: Robustness), D10 (the cap is a truncation).
  - Showdown's replay server. On 2026-11-24, `https://replay.pokemonshowdown.com/search.json?format=gen9nationaldex` returned 51 replays per page, newest first, about 6 hours of uploads, each with a `rating`. `https://replay.pokemonshowdown.com/<id>.json` returns one replay with its log. Check paging, filters and fields before relying on them.
  - No Showdown build is needed.
- **Deliverables:**
  - `data/replays/v0/replays.jsonl.gz`: one replay per line with at least its id, upload time, rating and full log. Outputs documents the format.
  - The fetch and stats scripts, in this folder.
  - Result: turns per game (median, mean, p90, max) over all games, over games not ended by forfeit or inactivity, and by rating band, with ≥1500 reported separately if there are at least 100 such games. Also the forfeit share, the date range and the rating distribution.
  - Under For integration: the turns-per-game figures for plan.md (Compute), and whether game lengths support Training v0's starting cap of 300.
- **Acceptance checks:**
  - At least 1,000 distinct replays, each with format id exactly `gen9nationaldex` (not another NatDex format), and each log ending in `|win|` or `|tie|`.
  - The stats script reproduces Result's numbers from the committed file alone.
- **May change:** `tasks/T04-replay-corpus/`, `data/replays/v0/`.
- **Limits:** one session. Requests one at a time with a pause between them, and a generic User-Agent with no personal details.
- **Stop and report if:** fewer than 1,000 public replays are reachable, or the compressed corpus would exceed 20 MB.

## Progress

## Result

## Outputs

## For integration
