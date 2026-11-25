# T06: S3 damage-calc cost

## Brief

- **Objective:** measure the cost of damage calcs per decision with @smogon/calc, with a cache, for both calc sets in plan.md's Network v0: 288 per decision (every mon's moves) and 48 (only the active mons'). Then apply D7's rule: if calcs take more than 30% of env time, v0 uses the 48. Also check that @smogon/calc handles NatDex content, since v0's calc features rely on it.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - @smogon/calc (root `package.json`). plan.md (Network v0: Damage calcs; Phase 0: S3), D7 (Damage calcs).
  - Env time per decision: T02's Result (S1), on its PR or `main`. If it isn't there when you reach that step, set State to `blocked (T02)` and hand off.
  - Game states: in-process seeded games, as in T01's `battle.ts`, with Smogon NatDex sample teams that validate at the pin.
  - Opponent sets: D7's calcs use a species-level prior set, but the set library doesn't exist until Phase 1. Use each opposing mon's true set; how the set is chosen doesn't change a calc's cost.
- **Deliverables,** in this folder:
  - The benchmark: at each decision of seeded games, compute both calc sets as Network v0 defines them, uncached and with a cache keyed on every input the calc reads.
  - Result: µs per calc; ms per decision for 288 and 48 calcs, cached and uncached; the cache hit rate; median and spread over ≥3 runs, with load averages. Then the calcs' share of env time per decision, using T02's number, and what D7's rule gives.
  - Result, NatDex support: whether gen 9 calcs accept the Mega formes, Z-Moves, and Past Pokémon, moves and items on the sample teams, listing any rejected or computed wrong. As a check, for at least 200 damaging hits in in-process games, where both sets are known, whether the sim's damage falls in the calc's range, with mismatches listed by cause.
  - Under For integration: the text this changes in plan.md (Compute, Network v0) and D7.
- **Acceptance checks:**
  - The benchmark reruns from Outputs on a clean checkout and lands within the reported spread.
  - Every mismatch in the range check has a stated cause, such as a crit, a multi-hit move, or a mechanic the calc lacks.
- **May change:** `tasks/T06-calc-cost/` only.
- **Limits:** one session, no paid services. Other tasks run on this machine at the same time, so take timed runs inside the timing lock: `until mkdir "$(git rev-parse --path-format=absolute --git-common-dir)/timing.lock" 2>/dev/null; do sleep 30; done`, then `rmdir` it when done. Tell the user if you've waited over an hour.
- **Stop and report if:** @smogon/calc can't compute gen 9 damage for Megas, Z-Moves or Past content, or the range check finds mismatches that no known calc limit explains. Either would put v0's calc features (D7) in question.

## Progress

## Result

## Outputs

## For integration
