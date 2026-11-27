# T16: Observation, first cut

## Brief

- **Objective:** record version 2, the first cut of Network v0's observation. The Node env worker builds it (D7), with calcs and the opponents' assumed moves on T12's species-level prior rather than the skeleton's true sets. The Python side turns it into the net's token tensors. This is the observation the v0-lite run trains on (plan.md, Phase 1), and the start of the builder, Phase 1's long pole. It also passes the hidden-content leak test, which comes before v0-lite, and re-measures env decisions/s for D7's calc revisit trigger and D10's collection.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout, Tests and Python entry points.
  - D7 (all of it, including the species-level prior and T12's file-order rule), D10 (the ~3× switch). plan.md: Network v0 (Tokens, Moves inside mon tokens, Damage calcs, Static dex features, Mega and Z flags, Action head); Compute (the M4 Max bullets, T09's budget); Phase 1 (v0-lite; Exit: Leak tests).
  - [env-workers](../../docs/areas/env-workers.md): T09's worker, record version 1, the transport, the calcs and Gotchas.
  - [team-pool](../../docs/areas/team-pool.md): `data/pool/v1/` (train on the training teams, not `holdout.txt`'s) and `data/priors/v0/species_sets.json`, its format, and the Greninja-Bond key gotcha. Every v1 species has library sets, so D7's 1760 fallback for a species without one is left to the full observation: here such a mon gets no calcs and is counted.
  - Tracking: T09's `Client` (@pkmn/client 0.7.4 as is). T10 builds its layer in parallel in `worker/tracker/`, and swapping to it is an import change in `env.ts`. Fields the raw client gets wrong are listed in env-workers.md, not worked around here.
  - T07's token stand-in (`tasks/T07-mps-throughput/tokens/`), to copy from.
- **Deliverables:**
  - **Record version 2,** built in the worker, beside version 1. Version 1 keeps working: T14's baselines and mask check use it.
    - Field: weather, terrain, hazards and screens per side, Trick Room, turn.
    - Own mons: species, item, ability, stats from the request, HP, status, boosts, a fixed list of volatiles you choose and document, and Mega and Z availability. Their four moves carry PP, disabled and Z eligibility (the request's `canZMove`).
    - Opposing mons: species as Team Preview shows them (`-*` formes unresolved until they switch in), and what the protocol has revealed: item, or that it is gone; ability; forme; moves. Unrevealed attributes are marked unknown. Their four moves are D7's prior-set moves, each flagged revealed or assumed.
    - The 288 calcs (plan.md, Network v0: Damage calcs): own mons on their own sets, opposing mons on D7's prior. The opposing active keeps a fixed column. Field-wide effects (Ruin abilities, Auras) are passed as field flags, as plan.md says. Version 1 keeps its true-set calcs.
    - The last 16 events of the player's stream, in an encoding you define and document.
    - The action mask, unchanged: T09's `mask.ts` and the queued-switch tracking in `env.ts`.
    - Left to the full observation: the evidence features (speed order, damage against the calc) and D7's 1760 fallback.
  - **Static dex tables:** base stats and types per species, and per move its base power, type, category, priority, flags and the effect fields Network v0 lists. They're exported from Showdown's Dex at the pin and keyed by the vocab ids, under the vocab hash.
  - **The Python side,** in `tyche/obs/`: record version 2 as a numpy dtype, and the tensorizer. It builds Network v0's 33 tokens as id arrays, feature arrays and masks, plus the per-move inputs that the per-move MLP pools into each mon token. Document the shapes. The 5M net is a later task that reads them.
  - **The hidden-content leak test** (plan.md, Phase 1 exit). Pairs of games share the seed, both teams and the inputs. They differ only in the opposing team's content: spread, nature, an unrevealed move, item or ability, Hidden Power's type, or a `-*` forme. At every decision before the first line where the two players' streams differ, the two records must be bit-identical. Cover each variant over enough pairs that a difference gets revealed in most of them, and report the decisions compared per variant.
  - **The cost:** the env with version 2 at 12 worker processes, as T09's `bench.py` measures it: 3 runs under the timing lock, with Python answering at random, and ms per decision per process by phase. Compare it with T09's 1.09 ms and with the budget in plan.md, Compute: ~2.1 ms keeps D10's collection synchronous, and ~6.3 ms is where the env bounds the M4 Max at 33 tokens.
  - **An end-to-end check:** a small net trained through version 2 on v1's training teams beats random legal actions, as T09's skeleton did. Copy from `tyche/skeleton/` into `tyche/obs/`.
  - **docs/areas/env-workers.md:** record version 2, its fields and their sources, the tensors, the static tables, the leak test, commands and gotchas. Version 2 is an interface, so record what each field holds as precisely as version 1 is recorded.
- **Acceptance checks:**
  - The leak test passes as a test (AGENTS.md, Conventions: Tests), with its per-variant counts in Result.
  - Version 2's records against the sim and the tracker on random games, as `record.test.ts` does for version 1. Every field holds what the player is shown, or the prior, never the opponents' true sets.
  - The calcs on the prior, on ≥8 random games: each nonzero calc equals @smogon/calc run directly on the prior set it names. Report the share of opposing mons whose prior set wasn't the true one.
  - The tensorizer: shapes, masks and ids are tested on real records. Records round-trip through the transport at version 2, and each end refuses another version.
  - The cost: 3 runs within 10% of their median, with load averages and the per-phase breakdown. Result gives the D7 and D10 verdicts against T07's learner estimate, both provisional as in T09.
  - The small net wins ≥75% of 1,000 games against random legal actions, playing both seats, on v1's training teams.
  - `node --test 'worker/**/*.test.ts'`, `uv run pytest` and `tsc -p tsconfig.json` pass. Version 1's tests still pass.
- **May change:** `worker/skeleton/env.ts`, `worker/skeleton/record.ts`, `worker/skeleton/record.test.ts`, `worker/skeleton/vocab.ts`, `worker/skeleton/drive.ts`, `worker/calc/`, `worker/obs/`, `tyche/transport/`, `tyche/obs/`, `docs/areas/env-workers.md`, `tasks/T16-observation/`.
  - The worker's entry point, `worker/skeleton/main.ts`, is T14's. Give version 2 its own entry point in `worker/obs/`, and let `tyche/transport/` start either one.
  - Keep `Env`'s public interface working for `main.ts`: the constructor's config, including `games`, and `collect`, `encode`, `apply`, `slots` and `stats`.
- **Limits:** up to six sessions, no paid services. Take the timed runs on the user's Mac, under the timing lock (AGENTS.md, Conventions: Timed runs); a cloud session can't take that lock.
- **Stop and report if:**
  - version 2 at 12 processes costs more than ~6.3 ms per decision per process (median of 3 runs), which fires D7's calc revisit trigger;
  - a field the observation needs can't be built without information the player isn't shown;
  - the leak test fails in a way that needs changing D7's prior rule.

## Progress

## Result

## Outputs

## For integration
