# T16: Observation, first cut

## Brief

- **Objective:** record version 2, the first cut of Network v0's observation. The Node env worker builds it (D7), with calcs and the opponents' assumed moves on T12's species-level prior rather than the skeleton's true sets. The Python side turns it into the net's token tensors. This is the observation the v0-lite run trains on (plan.md, Phase 1), and the start of the builder, Phase 1's long pole. It also passes the hidden-content leak test, which comes before v0-lite, and re-measures env decisions/s for D7's calc revisit trigger and D10's collection.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout, Tests and Python entry points.
  - D7 (all of it, including the species-level prior and T12's file-order rule), D10 (the ~3× switch). plan.md: Network v0 (Tokens, Moves inside mon tokens, Damage calcs, Static dex features, Mega and Z flags, Action head); Compute (the M4 Max bullets, T09's budget); Phase 1 (v0-lite; Exit: Leak tests).
  - [env-workers](../../docs/areas/env-workers.md): T09's worker, record version 1, the transport, the calcs and Gotchas.
  - [team-pool](../../docs/areas/team-pool.md): `data/pool/v1/` (train on the training teams, which `loadPool` in `worker/sim/battles.ts` returns, leaving out `holdout.txt`'s) and `data/priors/v0/species_sets.json`, its format, and the Greninja-Bond key gotcha. Every v1 species has library sets. D7's 1760 fallback is left to later (below).
  - Tracking: T09's `Client` (@pkmn/client 0.7.4 as is). T10 builds its layer in parallel in `worker/tracker/`, and swapping to it is an import change in `env.ts`. Fields the raw client gets wrong are listed in env-workers.md, not worked around here.
  - T07's token stand-in (`tasks/T07-mps-throughput/tokens/`), to copy from.
- **Deliverables:**
  - **Record version 2,** built in the worker, beside version 1. Version 1 keeps working: T14's baselines and mask check use it.
    - Field: weather, terrain, hazards and screens per side, Trick Room, turn.
    - Own mons: species, item, ability, stats from the request, HP, status, boosts, a fixed list of volatiles you choose and document, and Mega and Z availability. Their four moves carry PP, disabled and Z eligibility (the request's `canZMove`).
    - Opposing mons: species as Team Preview shows them (`-*` formes unresolved until they switch in), and what the protocol has revealed: item, or that it is gone; ability; forme; moves. Unrevealed attributes are marked unknown. Their four moves are D7's prior-set moves, each flagged revealed or assumed.
    - Each opposing mon also carries the prior's confidence: the share of the species' library weight, among the sets consistent with what has been revealed, that the chosen set's combination holds. The first library set matches a training-team mon's item, ability and moves for only 51 of 240 mons (21%; planning session's check, 2026-11-27), so the net needs to see how sure the prior is. This feature is an addition to Network v0 (plan.md).
    - **The prior for a hidden forme** (`Urshifu-*`, `Zamazenta-*`), from D7's rule: the forme is unrevealed, so every library key of that base species is consistent. Take the consistent combination with the most summed weight across those keys, and its first set. Map the protocol's `Greninja` and `Greninja-*` to the library's `Greninja-Bond` key (team-pool.md, species_sets.json: Keys the protocol doesn't show).
    - **Consistent** means consistent with the set the mon started the game with, as far as the protocol has shown it: its own moves; its item once shown, not one gained by Trick or Switcheroo; its base ability, not a Mega's or one copied or swapped in; and a Mega forme as the stone that makes it. Library sets store a Mega's base ability and base species (team-pool.md), so a revealed Mega checked naively matches no set. A mon with no consistent set gets no calcs and is counted (D7's 1760 fallback is left to later). Every training-team set is a library set, and so is every resampled one, so on the 40 training teams the count should be 0, and any count is a bug to explain. Held-out teams can run out (team-pool.md, species_sets.json).
    - The 288 calcs (plan.md, Network v0: Damage calcs): own mons on their own sets, opposing mons on D7's prior. The opposing active keeps a fixed column. Field-wide effects (Ruin abilities, Auras) are passed as field flags, as plan.md says. Version 1 keeps its true-set calcs.
    - The last 16 events of the player's stream, in a fixed minimal schema: the event type from a fixed list you document, its side and slot, one id (move, item, ability or species), and the HP change. Richer events wait for the full observation.
    - The action mask, unchanged: T09's `mask.ts` and the queued-switch tracking in `env.ts`.
    - Left to later: the evidence features (speed order, damage against the calc), for the full observation, and D7's 1760 fallback, which v0-lite's held-out report needs first (checklist, For the v0-lite brief).
  - **Static dex tables:** base stats and types per species, and per move its base power, type, category, priority, flags and the effect fields Network v0 lists. They're exported from Showdown's Dex at the pin and keyed by the vocab ids, under the vocab hash.
  - **The Python side,** in `tyche/obs/`: record version 2 as a numpy dtype, and the tensorizer. It emits the 33-token input of T07's stand-in, `tasks/T07-mps-throughput/tokens/net.py` (the batch dict's keys and shapes, with the per-move inputs that the per-move MLP pools into each mon token), or a documented superset. Feature widths may differ from the stand-in's; document them. T19 builds the 5M net on that format in parallel.
  - **The hidden-content leak test** (plan.md, Phase 1 exit), in three parts:
    - The version 2 builder receives no opposing true sets. Enforce it in its constructor's types: own sets and the library only.
    - **Rebuilt from the stream:** on ≥100 full games, rebuild every decision's record from the logged player stream and requests, the player's own team and the library alone. Each must be bit-identical to the record the env produced. This catches leaks that switch on late in a game.
    - The tensorizer is a pure function of the record, so bit-identical records give bit-identical tensors (plan.md's wording). A test checks that.
    - **Paired games:** pairs share the seed, both teams and the inputs. They differ only in the opposing team's content: spread, nature, an unrevealed move, item or ability, Hidden Power's type, or a `-*` forme. At every decision before the first line where the two players' streams differ, the two records must be bit-identical. Report the decisions compared per variant.
  - **The cost:** the env with version 2 at 12 worker processes, as T09's `bench.py` measures it: 3 runs under the timing lock, with Python answering at random, and ms per decision per process by phase. Version 2's bench is a copy in `tyche/obs/`. In the same session and on the same teams, also run version 1 as the baseline: T09 timed v0's teams, and T02's medians moved by up to ~8% between sessions (plan.md, Compute). Compare version 2 with that baseline, with T09's 1.09 ms, and with the budget in plan.md, Compute: up to ~2.1 ms keeps D10's collection synchronous, and ~6.3 ms is where the env bounds the M4 Max at 33 tokens.
  - **The entry point** in `worker/obs/` accepts T14's game-schedule config, so v0-lite's eval can play duplicate games on version 2. Until T14 merges, follow its branch, and put any mismatch under For integration. `Worker(index, config)` in `tyche/transport/` already passes any config through; give `Workers` an entry-point parameter and extra config, so either entry point starts.
  - **docs/areas/env-workers.md** owns the record and tensor interface; T10's observation-builder.md owns the tracker layer. env-workers.md gets record version 2, its fields and their sources, the tensors, the static tables, the leak test, commands and gotchas. Version 2 is an interface, so record what each field holds as precisely as version 1 is recorded.
- **Acceptance checks:**
  - The leak test passes as a test (AGENTS.md, Conventions: Tests), with its per-variant counts in Result.
  - Version 2's records against the sim and the tracker on random games, as `record.test.ts` does for version 1. Every field holds what the player is shown, or the prior, never the opponents' true sets.
  - The calcs on the prior, on ≥8 random games: each nonzero calc equals @smogon/calc run directly on the prior set it names. Report the share of opposing mons whose prior set wasn't the true one.
  - The tensorizer: shapes, masks and ids are tested on real records. Records round-trip through the transport at version 2, and each end refuses another version.
  - The cost: 3 runs within 10% of their median, with load averages and the per-phase breakdown. Result gives the D7 and D10 verdicts against T07's learner estimate, both provisional as in T09.
  - `node --test 'worker/**/*.test.ts'`, `uv run pytest` and `tsc -p tsconfig.json` pass. Version 1's tests still pass.
- **May change:** `worker/skeleton/env.ts`, `worker/skeleton/record.ts`, `worker/skeleton/record.test.ts`, `worker/skeleton/vocab.ts`, `worker/skeleton/drive.ts`, `worker/skeleton/frames.ts`, `worker/calc/`, `worker/obs/`, `tyche/transport/`, `tyche/obs/`, `docs/areas/env-workers.md`, `tasks/T16-observation/`.
  - The worker's entry point, `worker/skeleton/main.ts`, is T14's. Give version 2 its own entry point in `worker/obs/`, and let `tyche/transport/` start either one. `frames.ts` takes the record version from `record.ts` today, so a version 2 entry point needs it to carry the version per pipe.
  - Keep `Env`'s public interface working for `main.ts` and T14's mask check: the constructor's config, including `games`; `collect`, `encode`, `apply`, `slots`, `ended`, `stats`, `resetStats`, `decisions` and `counts`; `drive.ts`'s `step` and `randomLegal`; and `frames.ts` as `main.ts` uses it.
  - Version 1's hello keeps its `vocab` (species, moves, hash) unchanged: `tyche/skeleton/eval.py` refuses T09's checkpoint on any other, and T14 runs that checkpoint. Items, abilities and anything else version 2 needs get ids of their own.
- **Limits:** up to six sessions, no paid services. Take the timed runs on the user's Mac, under the timing lock (AGENTS.md, Conventions: Timed runs); a cloud session can't take that lock.
- **Stop and report if:**
  - version 2 at 12 processes costs more than ~6.3 ms per decision per process (median of 3 runs), which fires D7's calc revisit trigger;
  - a field the observation needs can't be built without information the player isn't shown;
  - the leak test fails in a way that needs changing D7's prior rule.
- **Watch for** (final review of PR #12, 2026-11-28). Context, not added requirements; use your judgment:
  - Paired-game variants that change a spread or nature diverge at the first damage line, so they may compare little beyond Team Preview and turn 1. Variants on an unrevealed move, item or ability run deeper. The per-variant counts in Result show the difference.
  - `encode` in `env.ts` reads the turn from the sim (`d.slot.game.battle.turn`). It's public, but a rebuild from the logged stream has no sim to read, so version 2 takes its fields from the tracker and the request.
  - Prior sets change as an opponent reveals its set, and with them the calc cache keys. T09's calcs hit the cache on ~72% of lookups on v1's training teams (1,001 random games, 2026-11-28), so version 2's calc time may rise.
  - T19 builds against your tensor format in parallel. Putting its keys, shapes and widths in Progress once they're fixed saves it guessing.

## Progress

### 2026-11-28, session 1: builder, tests and tensors

State: active
Verified: record version 2 is built in `worker/obs/` and runs through `Env` (`record: 2`) and the transport (`worker/obs/main.ts`). `tsc -p tsconfig.json`, `node --test 'worker/**/*.test.ts'` (21) and `uv run pytest` (14) pass. The leak test's three parts pass (`worker/obs/leak.test.ts`, `tyche/obs/test_obs.py`), and both fail on a planted leak of the true opposing item. 0 of 130,837 nonzero calcs differ from calcs on the prior set and the sim's visible state (`worker/obs/calcs.test.ts`).
Pending: the timed runs (version 1 and 2 at 12 processes, 3 runs each, under the lock); env-workers.md; Result and Outputs.
Next: copy `bench.py` into `tyche/obs/` with a record-version flag, then the timed runs.

**Tensor format for T19**, fixed as of this entry: `tyche/obs/tensor.py`. `Tensorizer(hello["vocab"]["hash"])(records)` returns a dict of numpy arrays (`as_torch` converts). Its keys are the stand-in's (`tasks/T07-mps-throughput/tokens/net.py`, `obs`), plus `event_xids`:

| Key | Shape | dtype |
|---|---|---|
| `field` | (b, 1, 83) | float32 |
| `own_ids`, `opp_ids` | (b, 6, 7): species, item, ability, 4 moves | int64 |
| `own_num`, `opp_num` | (b, 6, 129): the first 24 are the mon's calcs, move j against each of the other side's 6 at 6j + k, as the stand-in's | float32 |
| `own_mnum`, `opp_mnum` | (b, 6, 4, 90): the last 6 are the move's calcs | float32 |
| `move_ids` | (b, 4): own mon 0's moves | int64 |
| `move_num` | (b, 4, 90): `own_mnum[:, 0]` | float32 |
| `event_ids` | (b, 16, 3): event type, species, move | int64 |
| `event_xids` | (b, 16, 2): item, ability (added) | int64 |
| `event_num` | (b, 16, 13) | float32 |
| `present` | (b, 33): field, own mons, opposing mons, own active's moves, events | bool |
| `action_mask` | (b, 18) | bool |

Vocab sizes (embedding rows, `Tensorizer.widths()`): species 1,520, moves 940, items 590, abilities 324, event types 41. Item and ability ids: 0 none, 1 outside the vocab, 2 not revealed. Opposing mons are ordered active first, so calcs keep the opposing active at k = 0. Mon order is the request's for own mons (switch logit j is own mon j).

### 2026-11-28, session 1: claimed

State: active
Verified: inputs exist at 02a09d0 (pool v1, library v0, T09's worker, T07's tokens); D7 and D10 are decided. T14 has no branch on `origin` yet, so the entry point follows T14's brief for the game schedule.
Pending: everything.
Next: record version 2's layout in `worker/obs/`, then the builder.

## Result

## Outputs

## For integration
