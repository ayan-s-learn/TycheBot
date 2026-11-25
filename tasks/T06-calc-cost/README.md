# T06: S3 damage-calc cost

## Brief

- **Objective:** measure the cost of damage calcs per decision with @smogon/calc, with a cache, for both calc sets in plan.md's Network v0: 288 per decision (every mon's moves) and 48 (only the active mons'). Then apply D7's rule: if calcs take more than 30% of env time, v0 uses the 48. Also check that @smogon/calc handles NatDex content, since v0's calc features rely on it.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - @smogon/calc (root `package.json`). plan.md (Network v0: Damage calcs; Phase 0: S3), D7 (Damage calcs).
  - Game states: in-process seeded games, as in T01's `battle.ts`, with Smogon NatDex sample teams that validate at the pin.
  - Opponent sets: D7's calcs use a species-level prior set, but the set library doesn't exist until Phase 1. Use each opposing mon's true set. A calc costs the same whichever set it uses, but the cache hit rate may differ under D7's prior sets, so Result says how.
  - T02 (S1) measures the sim at the same time. This task measures the sim time it needs itself, so it doesn't wait for T02; D7's rule uses this task's own sim figure, measured in the same setup, and T02's Result, if it is out by the end, is a cross-check.
- **Deliverables,** in this folder:
  - The benchmark: at each decision of seeded games, compute both calc sets as Network v0 defines them, uncached and with a cache keyed on every input the calc reads. In the same setup (process count, core type), time the sim's own work per decision with `Battle` driven directly.
  - Result: µs per calc; ms per decision for 288 and 48 calcs, cached and uncached; the cache hit rate; median and spread over ≥3 runs, with load averages. Then the calcs' share of env time, as calc / (sim + calc) per decision, and what D7's rule gives.
  - Result, NatDex support: whether gen 9 calcs accept the Mega formes, Z-Moves, and Past Pokémon, moves and items on the sample teams, listing any rejected or computed wrong. As a check, for at least 200 single-hit, non-crit damaging moves in in-process games, where both sets are known, whether the sim's damage falls in the calc's range, with mismatches listed by cause.
  - Under For integration: the text this changes in plan.md (Compute, Network v0) and D7.
- **Acceptance checks:**
  - The benchmark reruns from Outputs on a clean checkout and lands within the reported spread.
  - Every mismatch in the range check has a stated cause, such as a mechanic the calc lacks.
- **May change:** `tasks/T06-calc-cost/` only.
- **Limits:** one session, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:**
  - the 48 calcs, cached, still take more than 30% of env time. D7 has no step after "use the 48", so it would reopen;
  - @smogon/calc can't compute gen 9 damage for Megas, Z-Moves or Past content, or the range check finds mismatches it can't explain. Either would put v0's calc features (D7) in question.

## Progress

```text
2026-11-24 (3)
State: blocked (stop condition met on the brief's measure, calc / (sim + calc): the 48 calcs, cached,
  are 52-60% of it. Whether they exceed 30% of the whole env waits on S5 and S4)
Verified: bench.ts with a sim-alone pass, 5 runs of 200 games at load 3-5 (Result). An independent
  review (PR #5) found the sim figure inflated by the calc passes around it; the sim-alone pass
  measures that. Its HP-key hit rate is reproduced (hitrate.ts). NatDex support and range check,
  100 games, every mismatch with a confirmed cause. Node 24.22.3, Showdown 29f2d99, @smogon/calc 0.12.0.
Pending: acceptance check 1 strictly (Result, Reruns); For integration's D7 text, which waits on the
  user.
Next: planning session: put D7's calc cost to the user (Result, What D7's rule gives).
```

```text
2026-11-24 (2)
State: blocked (stop condition met: the 48 calcs, cached, take 51% of env time, so D7 reopens)
Verified: benchmark, 5 runs of 200 games (Result); NatDex support and range check, 100 games, every
  mismatch with a confirmed cause. Node 24.22.3, Showdown 29f2d99, @smogon/calc 0.12.0.
  Clean-checkout rerun: support.json identical; sim time 7% and calc rows up to 2% above the spread, at
  higher load (Result).
Pending: acceptance check 1 strictly (timings within the spread) needs a rerun at lower load; T02's sim
  figure as a cross-check, once its Result is out; For integration's D7 text, which waits on the user.
Next: planning session: put D7's calc cost to the user (Result, What D7's rule gives).
```

```text
2026-11-24
State: active
Verified: nothing yet (claimed 2026-11-24)
Pending: setup, benchmark, NatDex support check, range check
Next: run setup, then write the benchmark
```

## Result

### Calc cost

Five runs of `node bench.ts 200 20`, back to back in one process each, under the timing lock: 200 seeded games of RandomPlayerAI vs RandomPlayerAI (21,932 decisions, 9,532 turns) after 20 untimed warm-up games. A decision is a request a player must answer (wait requests excluded). At each one, the deciding player's calc set is run four ways: both sets, uncached and cached. Sim time covers battle creation, `choose`, `sendUpdates` and `extractChannelMessages`, with `Battle` driven directly. It is timed twice: next to the calcs (the pass above), and alone (the same games replayed with no calcs). One process on an M4 Max (10 P + 4 E cores), load averages 2.7–4.6 (`runs/2026-11-24-sim-alone.jsonl` has each run's).

| Measure | Median | Min–max |
|---|---|---|
| sim ms per decision, next to calcs | 0.230 | 0.229–0.234 |
| sim ms per decision, alone | 0.168 | 0.168–0.172 |
| all: calcs per decision (max 288) | 96.4 | 96.4–96.4 |
| all: µs per calc, uncached | 15.0 | 15.0–15.1 |
| all: ms per decision, uncached | 1.449 | 1.443–1.453 |
| all: ms per decision, cached | 0.534 | 0.531–0.535 |
| all: cache hit rate | 0.692 | 0.692–0.692 |
| all: ms per decision at 288 calcs, uncached | 4.331 | 4.314–4.344 |
| all: calc share of env time, uncached | 0.863 | 0.861–0.863 |
| all: calc share of env time, cached | 0.699 | 0.694–0.700 |
| all: calc share of env time, cached, sim alone | 0.760 | 0.756–0.761 |
| active: calcs per decision (max 48) | 20.2 | 20.2–20.2 |
| active: µs per calc, uncached | 15.7 | 15.6–15.8 |
| active: ms per decision, uncached | 0.318 | 0.316–0.319 |
| active: ms per decision, cached | 0.254 | 0.252–0.254 |
| active: cache hit rate | 0.260 | 0.260–0.260 |
| active: ms per decision at 48 calcs, uncached | 0.755 | 0.751–0.759 |
| active: calc share of env time, uncached | 0.580 | 0.575–0.582 |
| active: calc share of env time, cached | 0.524 | 0.519–0.526 |
| active: calc share of env time, cached, sim alone | 0.601 | 0.595–0.602 |

- **Two sim figures:** the calc passes between sim steps leave garbage and cold caches, which slow the sim by about 37% (0.230 against 0.168 ms). In a Node worker that runs both, that slowdown is a cost of the calcs. So the share against the sim alone (60% for the 48) is closer to the calcs' full cost, and the share next to calcs (52%) is a lower bound. T02's sim figure, 0.21 ms per decision at 1 process with 32 battles interleaved (0.218 on its clean rerun), falls between the two.
- **Calc sets as run** (`calcs.ts`): fainted mons and status moves get no calcs, which is why the sets average 96 and 20 calcs rather than 288 and 48. The "at 288/48 calcs" rows scale µs per calc to the full sets. "active" has no calcs at Team Preview or for a fainted active.
- **Cache:** one Map per player per game, keyed on every input passed to the calc, current HP included (`readMon`, `readField` in `calcs.ts`). Calc objects are built only on a miss. Cached time includes building the keys.
- **Where calc time goes:** in one CPU profile of a 10-game run (`node --cpu-prof bench.ts 10 3`, output not kept), `calculate` was 71% of the process's time, and `Pokemon.clone`, which `calculate` runs on both mons for every call, 36%. So roughly half of the time inside `calculate` went to @smogon/calc copying its inputs. Building our own calc objects was 4% of the process.
- **Hit rate under D7's prior sets:** these runs use true sets for both sides, so it may differ there. A player's own mons keep their true sets. An opposing mon's prior set changes whenever a reveal changes which library set is consistent, which invalidates that mon's entries, so the per-game hit rate may be somewhat lower early in a game and about the same once sets are revealed. Prior sets are shared across games, so a worker-wide cache could hit across games, unlike this one. Not measured: the set library doesn't exist yet.
- **Reruns** (acceptance check 1):
  - Before the sim-alone pass existed, the same benchmark ran 5 times at load 14.7 falling to 4.1 (`runs/2026-11-24.jsonl`, summarized by `summarize.ts` at 89d7a24): sim 0.243 (0.236–0.256), µs per calc 15.5 and 16.2, the 48 cached at 0.261 ms per decision, 51% of sim + calc. The calc rows above are ~3% below those runs, at lower load.
  - Clean checkout: a fresh clone of 719b754, sharing this worktree's `vendor/` and `node_modules/` (same pin and lockfile), 3 runs (`runs/2026-11-24-clean-rerun.jsonl`) at load 31.9 falling to 10.3: sim 0.274 (0.273–0.283), µs per calc 15.6 and 16.3, the 48 cached at 0.263 ms, 48.9% of sim + calc. `support.json` was identical.
  - So the timings move with load by up to ~7% (sim) and ~4% (calcs), more than any one set of runs' spread. The clean checkout's run used the bench before its sim-alone pass; the sim-alone runs weren't repeated on a clean checkout.

### What D7's rule gives

D7: if calcs take more than 30% of env time, use the 48. On the brief's measure, calc / (sim + calc), both sets are over 30%: the 288 at 70–76% cached, and **the 48 at 52% cached against the sim next to calcs, 60% against the sim alone**. That is this brief's first stop condition: D7 has no step after "use the 48", so it reopens.

That measure leaves out the env's other per-decision work: Python parsing, the observation builder, transfer and inference (S5, S4). **The 48 stay over 30% of the whole env only if that other work comes to less than 0.36–0.42 ms per decision** (0.254 / 0.3 − 0.254, less the sim next to calcs or alone). So the full test can't be settled until S5 and S4 report.

At full load, T02 measured the sim slowing from 0.21 to 0.38–0.43 ms per decision per process at 14 processes. If calcs didn't slow at all under that contention, the 48 cached would still be 40% of sim + calc (0.254 / (0.254 + 0.38)). Calcs under contention weren't measured.

Two levers:

- The cache key includes current HP, which changes most turns for an active mon. Dropping HP from the key raises the 48's hit rate from 26.3% to 59.4% (`node hitrate.ts 100`, key counts only). Most damage results don't depend on current HP, but some do (Eruption, Multiscale, Nature's Madness), so a real key would keep HP for those. A bound from the measured numbers: the cached 48 cost 0.254 ms per decision with 74% misses at ~15.7 µs each (0.235 ms), so ~0.02 ms is keys and lookups. With the no-HP hit rate, misses would cost 0.406 × 20.2 × 15.7 µs ≈ 0.129 ms, so ≥0.15 ms in all, still ≥39% of sim + calc next to calcs (47% against the sim alone). A key that keeps HP where it matters hits less often than the no-HP key, so its share is higher still. This lever alone doesn't reach 30%.
- The calc's per-call copying of its inputs: roughly half of `calculate` in the profile above (34% of process time in the review's own profile). Avoiding it needs a patched or forked @smogon/calc. Not tested.

### NatDex support

`node support.ts 100` (output in `support.txt` and `support.json`).

- **Names:** every species (49, including 5 Mega formes), item (38, including 8 Z-Crystals and 5 Mega Stones), ability (38) and move (141, including 8 Z-Moves) on the pool teams is in the calc's gen 9 data. Past content on the pool: 9 species, 13 items, 12 moves (`support.json`, `names.*.poolPast`). Of everything gen9nationaldex allows at the pin (1,206 species, 531 items, 304 abilities, 874 moves), the calc names only species differently: 37 cosmetic formes (Vivillon-*, Alcremie-*, …) that it lacks and that calc as their base species, and Aegislash, which it calls Aegislash-Shield. `calcSpecies` in `calcs.ts` maps both.
- **Calcs on the pool sets:** 2,934 calcs (each set's damaging moves against the next team's six sets; 120 as Z-Moves, 252 from the Mega forme) ran without an error. Each Z-Move's power matched the sim's.
- **Range check:** in 100 games, 3,608 single-hit, non-crit damaging hits between active mons, with the calc run on the state at the moment of the hit. 3,554 (98.5%) of the sim's damage values were one of the calc's 16 rolls, including all 64 Z-Move hits, 377 of 380 hits involving a Mega, and 1,412 of 1,423 involving Past content. Each of the 54 mismatches has a cause confirmed on its own state (the sim's number follows from the rule, or the calc rerun with the missing input gives it exactly):

| Cause | Hits |
|---|---|
| Ruination: the calc has no half-HP rule for it (it has one for Nature's Madness) and returns 0. Super Fang isn't on the pool, and a direct calc (Rattata vs Mew) also returned 0. | 25 |
| Payback: the calc doubles it by Speed order, Showdown only if the target moved first this turn | 11 |
| Counter, Mirror Coat: twice the damage the attacker took this turn, which the calc has no input for | 10 |
| The defender used Roost this turn and lost its Flying type; the calc has no input for that | 7 |
| Pursuit on a target switching out: the calc supports this (`isSwitching`), but this harness didn't set it. Not a calc gap | 1 |

What "exact" shows (`support.json`, `range.power` and `range.fieldCoverage`):
- In 1,270 hits (35%) the calc's rolls cover every integer in their range, so for those an exact roll is the same as being in range. On average 72% of the integers in a range are rolls.
- If the calc's rolls were all off by a constant factor, 1,897 of the 3,554 exact hits (53%) would still pass at ×1.05, 1,258 (35%) at ×1.1 and 121 (3%) at ×1.2. So the check rules out errors of ~20% or more on its own, and smaller ones only in aggregate.
- Field coverage is thin: weather was Snow (252 hits), Sun (32) and Sand (29), with no Rain; terrain was Psychic only (372); screens 50; Protosynthesis/Quark Drive 17; `abilityOn` 19.

Skipped: 179 crits, 49 multi-hit moves, 549 calls where `getDamage` returned no number (Showdown's code comments: immunity, failure or no damage), and 42 Future Sight hits, whose user wasn't active.

Limits:
- RandomPlayerAI games, not ladder play.
- The pool's 25 teams, so content off the pool was only checked by name.
- Active-vs-active only. `readField` doesn't pass field-wide ability effects (`isSwordOfRuin` and the other Ruins, Fairy/Dark Aura, Aura Break), and `readMon` sets `abilityOn` only for Flash Fire and Slow Start. The calc applies a Ruin only if the attacker or defender has it (`gen789.js` ~1186), so a bench-vs-bench calc with Ting-Lu active misses its effect. Feature code in Phase 1 needs to pass these.

## Outputs

Setup as in AGENTS.md (Conventions), then from this folder on Node 24 (`nvm use` in the same command):

```bash
L="$(git rev-parse --path-format=absolute --git-common-dir)/timing.lock"; until mkdir "$L" 2>/dev/null; do sleep 30; done; echo "T06 $(date +%FT%T)" > "$L/owner"; trap 'rm -f "$L/owner"; rmdir "$L" 2>/dev/null' EXIT; trap 'exit 143' INT TERM HUP; for i in 1 2 3 4 5; do node bench.ts 200 20 >> runs/<date>.jsonl || exit 1; done
```

```bash
node summarize.ts runs/<date>.jsonl
```

```bash
node hitrate.ts 100
```

```bash
node support.ts 100 > support.json 2> support.txt
```

- `bench.ts` prints one JSON line per run (~62 s each here, plus ~4 s for the sim-alone pass). `summarize.ts` gives the Result table. `support.ts` and `hitrate.ts` are deterministic.
- `teams/pool.jsonl`: T02's 25 Smogon NatDex sample teams, copied from `task/T02-sim-throughput` at 4664b14 (sha256 `cfebf44c…6d2a4d`). Games are seeded as in T02's `makeGame`.
- Type-check: `node ../../vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tsconfig.json`.

## For integration

plan.md, Compute, a new bullet after Env:

```markdown
- **Damage calcs** (S3, T06): @smogon/calc 0.12.0 takes ~15–16 µs per calc on the M4 Max, in one process. In random-AI games, skipping fainted mons and status moves, the 288 set averaged 96 calcs (1.45 ms per decision uncached, 0.53 ms cached) and the 48 set 20 (0.32 ms, 0.25 ms cached). The sim takes 0.17 ms per decision alone and 0.23 ms when calcs run between its steps (T02: 0.21). In one profile, roughly half the time inside the calc went to copying its inputs.
```

plan.md, Network v0, the Damage calcs bullet, appended:

```markdown
  - @smogon/calc's gen 9 data covers NatDex content; it lacks only cosmetic formes and names Aegislash differently (T06). Its gaps found against the sim: Ruination returns 0 (so does Super Fang, checked directly); Payback is doubled by Speed order; no input for Roost's type loss or for damage taken this turn (Counter, Mirror Coat). Field-wide effects (Ruin abilities, Auras) must be passed as field flags for pairs that don't hold the ability.
```

D7, Damage calcs, the last bullet: waits on the user. Measured, the 48 cached are 52–60% of sim + calc time (T06), so "restrict them to the active mons' moves" doesn't bring calcs under 30% unless the env's other work is ≥0.36–0.42 ms per decision. Options for the user:
- wait for S5 and S4, and apply the 30% rule to the whole env time;
- accept the cost, for example by revising the 30% threshold;
- reduce it, then remeasure. An HP-aware cache key alone was estimated to leave ~40–50%, so it would likely need a patched calc without the per-call copies as well (Result, What D7's rule gives).
