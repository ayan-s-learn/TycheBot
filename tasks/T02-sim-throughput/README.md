# T02: S1 sim throughput

## Brief

- **Objective:** measure Showdown's sim cost on the M4 Max for `Battle` driven directly and for `BattleStream`, and pick one by plan.md's rule: the faster, or `Battle` direct if they're within 10%. The numbers replace plan.md's env estimate (Compute). The harness also records the per-player streams that S6 (tracker comparison) times next. S1 → S6 → S5 is Phase 0's longest chain, so this task goes first.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - plan.md (Components 1; Phase 0: S1; Compute), D2, D7. T01's `battle.ts` drives both paths at the pin and is a starting point.
  - T01's gotchas: `Runner`'s `dual` option throws, so don't use it. `RandomPlayerAI` never Mega Evolves unless given a `mega` probability; use `Runner.AI_OPTIONS` or similar so games include Megas and Z-Moves.
  - Teams: Smogon's NatDex sample teams (`https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json`) that pass `validate-team gen9nationaldex` at the pin. T05 builds the stub pool from the same source at the same time; don't wait for it.
  - Turns per game come from T04 (replay corpus), not from random-AI games. The planning session combines the two.
- **Deliverables,** in this folder:
  - The harness for both drivers. Each gives what the training env needs at each decision: both players' protocol lines and request JSON, with `strictChoices` off (plan.md, Action head).
  - Result: ms per turn and per decision (a request a player must answer) for each driver, in one process and with several processes at once, up to all 14 cores (10 performance, 4 efficiency). The per-core figure under full load is what Compute needs. Median and spread over ≥3 runs, with load averages and the Node and pin versions.
  - The recommendation, by plan.md's rule.
  - A script that records per-player streams and requests for N seeded games, for S6, and a small committed sample of its output (≤5 MB).
  - Under For integration: replacement text for plan.md's Compute env bullet.
- **Acceptance checks:**
  - For the same seeds, both drivers play the same games, with matching per-player streams and requests, or Result lists every difference.
  - The timing commands in Outputs rerun from a clean checkout and land within the reported spread.
  - The recording script reproduces the committed sample byte for byte from its seeds.
- **May change:** `tasks/T02-sim-throughput/` only.
- **Limits:** one or two sessions, no paid services. Other tasks run on this machine at the same time, so take timed runs inside the timing lock: `until mkdir "$(git rev-parse --path-format=absolute --git-common-dir)/timing.lock" 2>/dev/null; do sleep 30; done`, then `rmdir` it when done. Tell the user if you've waited over an hour.
- **Stop and report if:** either driver needs a Showdown patch to give per-player streams and requests, or the same seed and choices give different games.

## Progress

## Result

## Outputs

## For integration
