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

```text
2026-11-25 (3)
State: done
Verified: all three acceptance checks (Result, Acceptance checks). ./run.sh from a fresh clone of 5974c17
  reproduces every file in results/ byte for byte. summarize.py assigns every mismatch class a cause (exit 0).
  Timing: 3 runs per tracker (one required), far under 2 ms. Showdown 29f2d99, Node 24.22.3, Python 3.14.7,
  @pkmn/client 0.7.4, @pkmn/data and @pkmn/dex 0.10.15, poke-env 0.17.0.
Pending: none
Next: the user reviews the PR and the recommendation; two adversarial passes (workflow.md, Task session, step 7).
```

```text
2026-11-25 (2)
State: active
Verified: harness stages 1-3 run on 500 recorded games (games 0-499, 55,563 decisions) and T04's 1,100
  replays, Showdown 29f2d99, Node 24.22.3, @pkmn/client 0.7.4, poke-env 0.17.0. truth.ts replays every game
  byte for byte. Neither tracker throws with @pkmn/data's NatDex filter; with the default filter @pkmn/client
  throws in 248 of 1,000 player-games. Each mismatch class traced to a cause (not yet written up).
Pending: data-lag counts, timing, cause summary script, Result, clean-checkout rerun.
Next: write datalag and summarize scripts, then time both trackers under the lock.
```

```text
2026-11-25
State: active
Verified: nothing yet. Setup done in this worktree (Showdown 29f2d99, Node 24.22.3).
Pending: all acceptance checks
Next: record 500 games with a copy of T02's recorder, then build the stage-1 harness for both trackers
```

## Result

**Recommendation: @pkmn/client, in the Node env workers, with our fixes in a thin layer over 0.7.4.** Both trackers represent Megas, Z-Moves, Illusion, `-*` formes and Past content without a rewrite, so no stop condition was hit. Each needs about nine fixes to pass Phase 1's ground-truth exit, plus the `Generations` filter and a message-type assert for @pkmn/client (Fixes, below). @pkmn/client's 167,244 mismatches against poke-env's 20,652 are mostly one 1-line bug (108,723 duplicate move slots). @pkmn/client's are mostly one-line fixes, plus Z-Move support. poke-env's include separating lasting effects from one-off events. With the work about even, architecture decides: @pkmn/client puts tracking next to the sim and @smogon/calc, which removes D7's calc round trip and the Python env processes (Architecture). poke-env is the pick if the builder stays in Python. Our own tracker isn't worth building. Speed doesn't separate them (Timing).

All figures: 2026-11-25, Showdown 29f2d99, @pkmn/client 0.7.4 with @pkmn/data and @pkmn/dex 0.10.15, poke-env 0.17.0, on games 0–499 recorded with T02's recorder (500 games, 24,235 turns, 55,563 decisions: 418 Mega Evolutions, 454 Z-Moves, 57 Illusions broken, 116 `-*` formes switched in) and T04's 1,100 replays.

### Harness

- `truth.ts` replays each recorded game in-process from its seeds (T02's `sim.ts`, `Battle` direct), checks the replay gives the recorded chunks and input log, and snapshots the sim's `Battle` at every request a player must answer. Reading the state needed no Showdown patch.
- `pkmn.ts` and `pokeenv.py` feed each player's chunks, line by line, to that tracker (requests included; `|error|` chunks skipped), and write its state at each decision in a shared view format. `pokeenv.py` dispatches lines as poke-env's `Player._handle_battle_message` does.
- `compare.py` derives each player's expected view from the sim's state and diffs it: the own side in full; the opposing mons seen so far (HP% as the protocol rounds it); revealed opposing moves, items and abilities as subsets of the true ones; side and slot conditions; the field; and whether each side has used its Mega and its Z-Move. Names are normalized to Showdown ids. It leaves out the sim volatiles no protocol line announces (`choicelock`, `stall`, `lockedmove`, `chillyreception`, `counter`, `mirrorcoat`, `pursuit`) and tracker markers that aren't volatiles (`fallenN`, `itemremoved`, `airballoon`, Protosynthesis' stat suffixes). A mismatch is one field of one mon (or one condition or flag) at one decision.
- `summarize.py` assigns every mismatch class a cause and exits 1 if any is left over.

### Stage 1: errors and data

| | @pkmn/client | poke-env |
|---|---|---|
| Recorded games (1,000 player-games): games with a throw | 0 with the NatDex filter; 248 with @pkmn/data's default | 0 |
| T04's 1,100 replays, spectator view: games with a throw | 0 | 0 |
| Message types it doesn't handle that carry state | `-zpower` (908 lines across both players' streams) | none |
| Unknown message types | ignored silently | `NotImplementedError` |
| Data lag at the pin, NatDex legal set | none: 1,365 species, 904 moves, 536 items, 310 abilities | none on species and moves; it has no item or ability data |

- **@pkmn/client needs a non-default `Generations`.** The default filter drops Past content, so Past Megas (Latios-Mega, Lopunny-Mega) have no species and `getPressurePP` and `types` throw. `new Generations(Dex, d => !!d.exists && [undefined, null, 'Past', 'Unobtainable'].includes(d.isNonstandard))` fixes it (`pkmn.ts`, `generations`).
- The other unhandled or ignored types are hit-result lines (`-resisted`, `-supereffective`, `-crit`, `-miss`, `-hitcount`, `-zbroken`), `-hint`, `-prepare`, timestamps and room lines, and for poke-env also `-fail` and `|upkeep|`; no mismatch traced to them. poke-env also logged 2 unknown effects (`HEALREPLACEMENT`) in the replays. Counts are in `results/stage1-*.json`.
- Data lag (`datalag.ts`) compares each tracker's species, move, item and ability data with Showdown's NatDex legal set.

### Stages 2 and 3: the diff against the sim

| Cause | Kind | @pkmn/client | poke-env |
|---|---|---|---|
| Regenerator's heal on switch-out is never logged (`pokemon.heal` writes no line), so an opposing benched mon's HP is stale. poke-env estimates it when it knows the ability, and misses Showdown's rounding to 99% | not shown | 12,071 | 10,677 |
| Illusion, while it holds: the disguise's entry gets the Zoroark's HP, status, boosts and moves | not shown | 478 | 520 |
| Illusion, after `\|replace\|` breaks it: what was attributed to the disguise stays on the wrong entry | tracker bug | 1,344 | 1,702 |
| A pending Healing Wish or Lunar Dance isn't kept as a slot condition (@pkmn/client's `side.wisher` holds the last Wish or Healing Wish user, which the diff didn't read) | unsupported | 430 | 430 |
| A pending Future Sight is kept after it ends without a message (its target fainted first) | tracker bug | 696 | 687 |
| The toxic counter isn't capped at 15, as the sim's stage is (Poison Heal games) | tracker bug | 61 | 67 |
| Each request duplicates the own active's move slots: `rememberMove` compares `virtual` with the request slots' `undefined` | tracker bug | 108,723 | |
| Z-Moves: no Z-used state (`-zpower` unhandled); a damaging Z-Move is recorded among the mon's moves under its Z name | unsupported | 25,085 | |
| No Mega-used state. Derived from the side's formes, it is lost when a fainted Mega reverts (`\|detailschange\|...\|[silent]`, `sim/battle.ts`) | unsupported | 18,021 | |
| Any `-heal` without `[from]` (Roost, Recover, Leech Seed's silent heal) runs the Healing Wish branch and zeroes the sleep and toxic counters | tracker bug | 175 | |
| The own active's move list is emptied when the request lists only a move without PP (a locked move, recharge, Struggle) | tracker bug | 151 | |
| Roost's volatile is kept only for Flying users, where it has an effect | tracker choice | 9 | |
| One-off events (`-activate`, `-singleturn`: Supreme Overlord, Tera Shell, Tera Shift, Psychic Terrain's block, Endure, Poltergeist) are stored as effects, and some are never cleared | tracker bug | | 3,565 |
| `species` keeps the pre-change name after Mega Evolution and other forme changes (Terapagos-Terastal); types, base stats and ability do change | tracker bug | | 1,581 |
| The toxic counter moves at `\|turn\|`, not at the poison damage, so it is one off for a mon that came in after a faint, and at decisions between the residual and the next turn | tracker bug | | 823 |
| A pending Future Sight is an effect on its user, lost when the user switches out or faints | tracker bug | | 588 |
| The counter carries over when Rest replaces toxic | tracker bug | | 12 |
| **Mismatches** | | 167,244 | 20,652 |
| **Decisions with any mismatch,** of 55,563 | | 51,388 | 16,917 |

- Most of @pkmn/client's 51,388 decisions with a mismatch are the duplicate slots. Own HP, status, item, ability and species matched for both trackers, since the request carries them.
- The Illusion causes are assigned by tag: "while it holds" at decisions where the sim has an active Illusion, "after" for any mismatch no other rule explains at a later decision of a game where one held. The classes checked by hand there (moves, item, HP and fainted flag on the disguise's entry) all came from the disguise. The "while it holds" mismatches are real, but the protocol hides the Illusion until `|replace|`, so they count as not shown.
- `compare.py` (`results/compare-*.json`) also counts mismatches by field and class, with [total, while an Illusion holds, after one held] per class; `results/examples-*.jsonl` has up to 5 examples per class and tag, as game:player:decision:turn.

**Stage 2, the targeted checks** (`byFeature` in `results/compare-*.json` counts mismatches on mons with each feature):

- **Mega Evolution:** both get the Mega's types, base stats and ability right. poke-env keeps the pre-Mega `species` name (1,100 mismatches on Megas). poke-env's Mega-used flags match the sim at every decision; @pkmn/client has none.
- **Z-Moves:** poke-env's Z-used flags match everywhere, and it keeps Z names out of the moves. @pkmn/client: as in the table. Own Z availability comes from the request for both.
- **Illusion:** as in the table. Neither infers a disguise before `|replace|`.
- **`Zamazenta-*` and `Urshifu-*`:** both resolve the forme when the mon switches in, with no extra or missing entries and no species mismatch. The mismatches on Zamazenta are from Illusion (it is the disguise in the Illusion team) and the general causes.
- **Past content:** apart from @pkmn/client's `Generations` filter (Stage 1), no mismatch is specific to Past species, items or moves (the `opp.species` counts on Past features in `compare-pokeenv.json` are poke-env's Mega forme name again).

### Fixes each tracker needs for the ground-truth exit

My estimates of size, not measured.

- **@pkmn/client:** the duplicate slots (1 line), the heal reset (1 line), the emptied move list (a few lines), the toxic cap (1 line), Future Sight's silent end (a few lines), Healing Wish and Lunar Dance (a few lines), Mega-used and Z-used flags from `-mega` and `-zpower` (a few lines), Z names kept out of revealed moves (tens of lines), and Illusion re-attribution at `|replace|` (tens of lines). Plus the NatDex `Generations`, and an assert on message types it doesn't handle. Most can go in a layer of our own rather than a fork: a handler run around the client's on each line, or overrides of its handler methods.
- **poke-env:** separating lasting effects from one-off events (tens of lines: its `Effect` enum mixes both), the forme name (a few lines, but `species` also identifies mons in `get_pokemon`), toxic counting at the poison damage, Future Sight as side state that survives its user leaving (tens of lines), Rest's carry-over (1 line), the toxic cap, Future Sight's silent end, Healing Wish and Lunar Dance, and Illusion re-attribution. Its Mega and Z flags already work.
- **Our own:** it would have to redo all the protocol handling both already get right, to fix the edge cases above, and none of those needs a rewrite.

### Keeping up with the monthly re-pin

- **@pkmn/client:** a protocol change needs a client release (0.7.3 on 2026-05-08, 0.7.4 on 2026-10-28; npm) or our own handler. It ignores message types it doesn't know, so the builder should assert on them. Its data was current at this pin, but the client depends on @pkmn/data ^0.10.12 while @pkmn/data and @pkmn/dex 0.11.0 came out on 2026-11-09 (npm). Whether the 0.10 line keeps getting data updates is unknown, so each re-pin reruns `datalag.ts`.
- **poke-env:** protocol handling and data come together in releases every 2–4 months (0.15.0 on 2026-04-14, 0.16.0 on 2026-08-21, 0.17.0 on 2026-11-15; PyPI). Its data is JSON files in the package, which we could regenerate. Unknown message types raise, so protocol drift shows up as a crash.
- Either way, a re-pin reruns `run.sh` on new games: the throw and mismatch counts mustn't grow, and fixes we carry are rebased on each upgrade.

### Architecture

- **With @pkmn/client:** each Node env worker runs the sim, a client `Battle` per player with our fix layer, @smogon/calc on the tracked state, and the observation builder. The builder writes a numeric record per decision (ids, numbers, action mask). Per env step, Node sends Python the records for every decision in the batch, and Python sends back one action each. There is no calc round trip and no Python env process. Python stacks records into tensors; feature code is TypeScript. Online, the websocket client feeds the same worker code.
- **With poke-env (D7 as written):** Node workers send raw protocol chunks and request JSON per player to Python env processes, which track, send one batched calc request per step back to Node, and build tensors. That is two round trips per step and a third process type.
- **Phase 1's walking skeleton measures** env decisions/s end to end (sim, tracking, 288 calcs, record building and transfer), against the learner's rate for D7's revisit triggers.

### Timing

`results/timing.log`: one process, tracking only (no view building), all 1,000 player-games, 3 runs under the timing lock, load average 1.4. @pkmn/client 0.0193, 0.0179 and 0.0179 ms per decision (median 0.018); poke-env 0.0368, 0.0380 and 0.0365 (median 0.037). Both are far under the brief's ~2 ms, so the 3 runs are more than the brief requires.

### Acceptance checks

- **Rerun on a clean checkout:** passed. `./run.sh` in a fresh clone of 5974c17 reproduces every file in `results/` (all but `timing.log`) byte for byte.
- **Every mismatch class has a cause:** passed. `summarize.py` assigns all of them (`results/summary.json`; exit 0).
- **Timing:** passed. Both trackers are under ~2 ms per decision (above).

### Not checked

- The leak tests (plan.md, Phase 1 exit): both trackers parse the spectator view without throwing, but nothing compared player-view and spectator-view features.
- State on T04's replays (no sim state to compare), and the server's streams (S2, deferred).
- Fields the tracker doesn't own: own stats and PP (both come from the request; @pkmn/client keeps no stats), the speed-order and damage evidence (the builder's), and the `-*` forme of an opposing mon before it switches in.
- Game content random players don't produce: hidden trapping, Transform, Baton Pass, Court Change. T04's replays only tested parsing.
- @pkmn/data 0.11, and Showdown's own `Dex` as @pkmn/client's data source.

## Outputs

Setup as in AGENTS.md (Conventions), then from this folder on Node 24:

```bash
./run.sh
```

It records games 0–499 into `out/` (gitignored; with truth and views ~0.8 GB) and writes `results/` (except `timing.log`, below), in about 75 s:

| File | What it is |
|---|---|
| `record.ts`, `sim.ts`, `teams/` | Copied from T02 at d0ab75e; `sim.ts` also exports `Battle` |
| `truth.ts` | The sim's state at each decision; checks each replay against the recording |
| `pkmn.ts`, `pokeenv.py` | The two trackers: views on the recorded games, throws and unhandled lines on games and replays, timing |
| `datalag.ts` | Each tracker's data against Showdown's at the pin |
| `compare.py`, `summarize.py` | The diff, and every class assigned a cause |
| `results/stage1-*.json`, `datalag.json` | Stage 1 |
| `results/compare-*.json`, `examples-*.jsonl`, `summary.json` | Stages 2 and 3 |
| `results/timing.log` | The timing run |

Timing, under the lock (AGENTS.md, Conventions: Timed runs):

```bash
node pkmn.ts time out/games.jsonl 3
uv run python pokeenv.py time out/games.jsonl 3
```

`node ../../vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tsconfig.json` type-checks the TypeScript.

Gotchas for whoever builds on this:

- Request move ids carry Hidden Power's type and Return's and Frustration's power (`hiddenpowerfire`, `return102`).
- Showdown keeps a benched mon's toxic stage until it switches in again, then resets it; the visible counter restarts on switch-out.
- The sim's `field.pseudoWeather` holds `sleepclausemod`, a rule, at every decision.

## For integration

These need the user's OK (D7 is partly decided). D7's header stays "partly decided": S2 stays deferred and the revisit triggers open. In the same sweep, prior-work.md's poke-env and @pkmn/client rows ("D7, spike S6"; "Speed and NatDex Mega/Z handling not checked") and plan.md's Phase 0 S6 line can point to T08.

**decisions.md, D7:** replace the bullet "**The builder is Python.**" and its sub-bullets with:

```markdown
- **Tracking and the observation builder run in the Node env workers** (S6, T08, 2026-11-25).
  - Each worker runs the sim, one @pkmn/client 0.7.4 `Battle` per player, @smogon/calc on the tracked state, and the builder, which writes a numeric record per decision (ids, numbers, action mask). @pkmn/data's `Generations` keeps Past and Unobtainable content.
  - Per env step, the worker sends Python the records for every decision in its batch, and Python sends back one action per decision. Python stacks records into tensors.
  - Our fixes to @pkmn/client (T08, Result) live in a layer over 0.7.4 rather than a fork, and the builder fails on message types it doesn't handle.
  - Why: poke-env and @pkmn/client need about the same fixes for Phase 1's ground-truth exit (T08), and in Node tracking sits next to the calcs, so there is no calc round trip and no Python env process.
  - Cost: feature code is TypeScript, apart from the model. The threshold carries over from the Python builder: this choice reopens if the env's decisions/s on the M4 Max, measured by Phase 1's walking skeleton, falls below ~2× the learner's (S4's figure until Phase 1's learner track gives its own).
  - Rejected: poke-env in Python env processes, which keeps the calc round trip; our own tracker, since no failure T08 found needs a rewrite.
```

**plan.md, Components 2:** replace with:

```markdown
2. **Observation builder** (D7): TypeScript, in the Node env workers. Tracks each player's state with @pkmn/client from its protocol stream and request JSON, runs the damage calcs on that state, and writes a numeric record per decision, which Python stacks into tensors. Used for both training and online play. Built in Phase 1.
```

**plan.md, Phase 1, Build:** "env workers with the batched 288-calc round trip" becomes "env workers with tracking and the 288 calcs in-process".
