# T08: S6 battle-state tracker

## Brief

- **Objective:** recommend how the observation builder tracks battle state: poke-env's tracker (Python, as is or forked), @pkmn/client (TypeScript, in the Node worker), or our own. This is D7's open choice (see D7 for what choosing @pkmn/client changes). Rank candidates by the work each needs to pass Phase 1's ground-truth exit on NatDex content, then by how each keeps up with the monthly re-pin and the moving parts its architecture adds. Speed counts only if a tracker nears the env's budget.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`.
  - plan.md: Format facts (`-*` formes, Megas, Illusion), Network v0 (Tokens: the fields the tracker must give), Phase 0 (S6), and Phase 1's exit criteria (Ground truth, Leak tests). D7.
  - T02's recorder, `record.ts` and `sim.ts` in `tasks/T02-sim-throughput/` as of d0ab75e (unchanged on main). Its games use T02's 26 teams: Smogon's 25 NatDex sample teams and `teams/illusion.txt`. The committed 12-game `sample.jsonl` is enough for timing but thin for correctness, so record ≥500 games with a copy of the recorder (`node record.ts <out> 0-499`; spike code is copied, not imported). Each game's `inputLog` holds both teams and its `|t:|` lines are frozen at 0. Trackers get only the `p1` and `p2` chunks.
  - Ground truth: the sim's own `Battle` at each decision, from replaying the game in-process as T02's `sim.ts` does.
  - T04's replays (`data/replays/v0/`): 1,100 human games in the spectator view, with no request JSON. They test robustness on content random players don't produce.
  - Packages, already installed: @pkmn/client 0.7.4 with @pkmn/data and @pkmn/dex 0.10.15 (AGENTS.md, Dependencies; @pkmn/data 0.11.0 came out 2026-11-09, npm), and poke-env 0.17.0.
- **Deliverables,** in this folder:
  - A harness that feeds each existing candidate one player's chunks and requests, decision by decision, in stages. Each stage runs on the candidates that passed the last:
    1. Crash and unhandled-message rates over the ≥500 recorded games and T04's 1,100 replays, and how far each candidate's data lags the pin on the NatDex legal set (counts of missing or differing species, moves, items and abilities).
    2. Targeted checks on Mega Evolution, Z-Moves, Illusion, `Zamazenta-*` and `Urshifu-*`, and the Past content on T02's 26 teams, with any setup each needs (for @pkmn/client, possibly a non-default @pkmn/data `Generations` filter).
    3. A diff against the sim's state at each decision, on what the sim gives directly: the own side in full; the opposing side's HP%, status, boosts, volatiles, and active species and forme; side conditions and the field. Revealed opposing moves, items and abilities are checked as a subset of the true set.
  - Result, per candidate: each stage's findings, with mismatches by field and cause; what the monthly re-pin would touch; and ms per decision in one process.
  - Recorded games stay out of git: 500 games are ~160 MB at the sample's size. Write them outside the repo or under a `.gitignore` in this folder, and commit the harness, logs and counts.
  - "Our own" is not built. Result says what it would need to cover, judged from where the existing candidates fail.
  - The recommendation for the user. It covers where tracking, calcs and tensor building run, what crosses Node↔Python per step, and what Phase 1's walking skeleton then measures. Under For integration: the text it changes in D7 and plan.md (Components 2).
- **Acceptance checks:**
  - The harness reruns from Outputs on a clean checkout with identical mismatch counts.
  - Every mismatch class in Result has a cause: a tracker bug, unsupported content, or information the player isn't shown.
  - One timing run per tracker is enough, unless a tracker takes over ~2 ms per decision. At plan.md's learner estimate (Compute), D7's builder rule leaves ~10 ms of CPU per decision across the machine, and the sim and calcs already take ~1 ms of it. Then time it 3 times, each rerun median within 10% of the reported median.
- **May change:** `tasks/T08-tracker/` only.
- **Limits:** one or two sessions, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:**
  - neither existing tracker can represent Megas, Z-Moves, Illusion, `-*` formes or Past content without a rewrite;
  - the sim's state at a decision can't be read without patching Showdown.

## Progress

## Result

## Outputs

## For integration
