# T14: Baselines, eval runner and sampled mask check

## Brief

- **Objective:** three of the v0-lite run's prerequisites that need only T09's worker (plan.md, Phase 1). They are the random and max-damage baselines, an eval runner that plays duplicate games as plan.md's Evaluation says, and Phase 1's sampled mask check, which passes before v0-lite. The baselines' results also give context for v0-lite's bar: ≥60% of 1,000 duplicate games against max-damage.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout, Tests and Python entry points.
  - [env-workers](../../docs/areas/env-workers.md): the transport, record version 1, the actions, and Gotchas. T09's code, merged: `tyche/skeleton/eval.py` (the fixed game list, Wilson interval), `net.py` (`random_policy`), `worker/skeleton/mask.test.ts` (each action probed on a copy of the battle), `worker/sim/battles.ts` (`drawGame`). The skeleton's checkpoint is `tasks/T09-skeleton/runs/train-0/net.pt`.
  - plan.md: Evaluation (Opponents, Pairings, Tests); Phase 1 (v0-lite's bar; Exit: Action masks); Network v0 (Action head).
  - D7 (hidden information).
  - **Max-damage, decided by the user on 2026-11-27:** a Python policy over the record's `calcs`. At a move decision it picks the legal move of the own active with the highest calc against the opposing active. So it sees what the record's calcs see: the opponents' true sets on record v1, as in the skeleton, and the set library's priors once calcs move to them (checklist, Later in Phase 1). At v0-lite it has no hidden information. You define and document what it does elsewhere: ties, all-zero calcs (only status moves left, or an immunity), Mega Evolution and Z-Moves, forced switches and Team Preview.
  - Teams: the stub pool, `data/pool/v0/teams.jsonl`. The runner takes a pool path and a team list, so T12's v1 pool and its training teams drop in once merged. The skeleton's calcs throw on an opposing Transform or Illusion (env-workers, Status), so a pool with Ditto or Zoroark can't run until calcs move to priors.
- **Deliverables:**
  - `tyche/baselines/`: random (uniform over legal actions) and max-damage, each a policy that maps a batch of records to actions, behind a small protocol that the eval runner, and later the learner's league, call. A T09 checkpoint is wrapped behind the same protocol.
  - `tyche/eval/`, the eval runner. It plays agent A against agent B in duplicate pairs: two games with the same battle seed and the teams swapped (plan.md, Evaluation: Pairings), so each agent plays each team in each seat.
    - The game list is fixed by (seed, worker, game) before games start, as T09's eval does, so a rerun plays the same games.
    - It reports the win rate with a 95% interval, by seat, and the pair outcomes (both won, split, both lost). It also reports ties, cut-off games, mean turns, and the workers' `[Invalid choice]` and `[Unavailable choice]` counts.
    - It runs an SPRT over pairs, with the null and alternative gaps given as arguments and α = β = 0.05 (plan.md, Evaluation: Tests), and records both with the result.
    - The output is a JSON file whose format you document.
  - The worker support duplicate games need: a game spec with the teams swapped, in `worker/sim/` and the worker's config. If a record field or its meaning changes, bump the record version on both ends (env-workers, Transport: Versions).
  - The sampled mask check, as a rerunnable command. On ≥10k requests from random games and ≥10k from games T09's skeleton policy plays, it probes each of the 18 actions with `strictChoices` on a clone of the battle (`sim/state.ts`). It reports every legal action the mask leaves out, which must be none, and every masked-in action the sim rejects as `[Invalid choice]`. `[Unavailable choice]` is expected (plan.md, Phase 2: online gate). It counts the request kinds covered: Team Preview, move, forced switch, `trapped`, `maybeTrapped`, Mega, Z-Move, locked move. The mask comes from the request, not the observation, so this result carries to v0-lite while `mask.ts` is unchanged. Say so in the notes, so that any later change to `mask.ts` reruns it.
  - Results: 1,000 duplicate games (500 pairs) each, on the stub pool: random against random, max-damage against random, the skeleton's checkpoint against random, and the checkpoint against max-damage.
  - `docs/areas/eval.md`: the policy protocol, the runner's commands and output format, the max-damage rules, the mask-check command, and gotchas. Update env-workers.md for the worker changes. Propose the AGENTS.md Areas row under For integration.
- **Acceptance checks:**
  - Random against random lands within its 95% interval of 50%, and each pair's two games start with the same seed and swapped teams (a test).
  - Max-damage's choice is tested on hand-built records, including the cases you define above, and it never picks a masked action.
  - The SPRT is tested on simulated pair streams: at true gaps equal to the null and to the alternative, it accepts the wrong hypothesis at about α and β, within a tolerance you state.
  - The sampled mask check passes: no legal action masked out, on ≥10k requests from each source. A rerun from Outputs gives identical counts.
  - The four eval results are in Result, with their commands in Outputs, and a rerun gives identical game lists.
  - Tests (AGENTS.md, Conventions: Tests) and `tsc -p tsconfig.json` pass.
- **May change:** `tyche/baselines/`, `tyche/eval/`, `worker/sim/`, `worker/skeleton/`, `docs/areas/eval.md`, `docs/areas/env-workers.md`, `tasks/T14-eval-baselines/`.
- **Limits:** up to two sessions, no paid services. No timed runs are needed.
- **Stop and report if:**
  - a legal action is masked out and the fix needs information the player isn't shown;
  - max-damage wins under ~70% of its duplicate games against random, which would point to a bug in it or in the record's calcs.

## Progress

## Result

## Outputs

## For integration
