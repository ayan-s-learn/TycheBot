# T14: Baselines, eval runner and sampled mask check

## Brief

- **Objective:** three of the v0-lite run's prerequisites that need only T09's worker (plan.md, Phase 1). They are the random and max-damage baselines, an eval runner that plays duplicate games as plan.md's Evaluation says, and Phase 1's sampled mask check, which passes before v0-lite. The baselines' results also give context for v0-lite's bar: ≥60% of 1,000 duplicate games against max-damage.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout, Tests and Python entry points.
  - [env-workers](../../docs/areas/env-workers.md): the transport, record version 1, the actions, and Gotchas. T09's code, merged:
    - `tyche/skeleton/eval.py`: the fixed game list and the Wilson interval;
    - `net.py`: `random_policy`;
    - `worker/skeleton/mask.test.ts`: each action probed on a copy of the battle;
    - `worker/sim/battles.ts`: `drawGame`;
    - `worker/skeleton/env.ts`: `EnvConfig.games`, a hook that deals game i's seed and teams;
    - `tyche/transport/workers.py`: `Worker(index, config)`, which passes any config to the entry point.
    The skeleton's checkpoint is `tasks/T09-skeleton/runs/train-0/net.pt`.
  - plan.md: Evaluation (Opponents, Pairings); Phase 1 (v0-lite's bar; Exit: Action masks); Network v0 (Action head).
  - D7 (hidden information).
  - **Max-damage, decided by the user on 2026-11-27:** a Python policy over the record's `calcs`, so it sees what the record's calcs see. On record v1 that is the opponents' true sets, as in the skeleton. Once calcs move to the prior (T16's record version 2), it is the prior, and at v0-lite it has no hidden information. Read the calcs through one function, so switching to version 2 is a small change. Its rules, unless a test shows one is wrong (then say why in Result):
    - At a move decision, the legal move of the own active (mon 0) with the highest calc against the opposing active (the active one of mons 6–11): `calcs[0][0][j][k]`. Ties go to the lowest index.
    - It Mega Evolves whenever that is legal, and never uses a Z-Move, since the calcs don't cover Z-Moves.
    - When every legal move's calc is 0 (only status moves left, or an immunity), it takes the first legal move.
    - When the move list shrinks (a locked move, Recharge, Struggle), action 0 is the only legal one, while `calcs` slot 0 still describes the first base move (env-workers, Actions). It takes action 0.
    - At a forced switch, it takes the bench mon with the highest calc against the opposing active. At Team Preview, it leads with team slot 1.
    - It never switches voluntarily.
  - Teams: the v1 pool's 40 training teams (`data/pool/v1/teams.jsonl` less `holdout.txt`; team-pool.md). T09's worker plays them without errors: 2,000 random-player games, 0 `[Invalid choice]` (planning session, 2026-11-27). v1 has no Transform, Imposter or Illusion user, on which the skeleton's calcs throw (env-workers, Status).
- **Deliverables:**
  - `tyche/baselines/`: random (uniform over legal actions) and max-damage, each a policy that maps a batch of records to actions. They sit behind a small protocol that the eval runner, and later the learner's league, call. A T09 checkpoint is wrapped behind the same protocol.
  - **`tyche/eval/`, the eval runner.** It plays agent A against agent B in duplicate pairs (plan.md, Evaluation: Pairings).
    - A pair is two games with the same battle seed and the same team in each seat, with the agents swapped between seats. So each agent plays both teams and both seats, and the two games differ only in which agent holds which seat.
    - The game list is fixed by (seed, worker, game) before games start, as T09's eval does, so a rerun plays the same games.
    - It reports the win rate with a 95% interval, by seat, and the pair outcomes (A won both, split, A lost both). It also reports ties, cut-off games, mean turns, and the workers' `[Invalid choice]` and `[Unavailable choice]` counts.
    - The output is a JSON file whose format you document. The SPRT comes later (checklist, Later in Phase 1); keep the per-pair outcomes in the output, so it can read them.
  - **The worker support duplicate games need:** a game schedule passed through `main.ts`'s config to `EnvConfig.games`. Record version 1 is unchanged.
  - **The sampled mask check, as a rerunnable command.** It draws ≥10k requests from random games and ≥10k from games T09's skeleton policy plays.
    - Each of the 18 actions is probed with `strictChoices` on a clone of the battle (`sim/state.ts`). It reports every legal action the mask leaves out, which must be none, and every masked-in action the sim rejects as `[Invalid choice]`. `[Unavailable choice]` is expected (plan.md, Phase 2: online gate).
    - It counts the request kinds covered: Team Preview, move, forced switch, `trapped`, `maybeTrapped`, Mega, Z-Move, locked move, and the mid-turn queued switch.
    - Any kind with fewer than ~100 occurrences gets scripted requests, built as `mask.test.ts`'s are, or is reported as not covered. `maybeTrapped` likely needs scripting: NatDex OU bans Arena Trap and Shadow Tag (`config/formats.ts` at the pin), and v1 has no Magnet Pull user (2026-11-27).
    - Ultra Burst has no action (env-workers, Actions) and v1 holds no Ultranecrozium Z, so it is out of scope. Say so in the notes.
    - The mask depends on the request and on the queued-switch tracking in `env.ts` (`feed`, `apply`), not on the observation. So the result carries to v0-lite while `mask.ts` and that tracking are unchanged. Say so in the notes, so that any later change to either reruns the check.
  - **Results:** 1,000 duplicate games (500 pairs) each, on v1's training teams:
    - random against random;
    - max-damage against random;
    - the skeleton's checkpoint against random;
    - the checkpoint against max-damage.
  - **docs/areas/eval.md:** the policy protocol, the runner's commands and output format, the max-damage rules, the mask-check command, and gotchas. Propose the AGENTS.md Areas row, and the lines env-workers.md needs for the worker changes, under For integration.
- **Acceptance checks:**
  - Random against random lands within its 95% interval of 50%. A test checks that each pair's two games share the seed and the team in each seat, with the agents swapped.
  - Max-damage's rules are tested on hand-built records, case by case, and it never picks a masked action.
  - The sampled mask check passes: no legal action masked out, on ≥10k requests from each source, with each request kind covered or reported. A rerun from Outputs gives identical counts.
  - The four eval results are in Result, with their commands in Outputs, and a rerun gives identical game lists.
  - Tests (AGENTS.md, Conventions: Tests) and `tsc -p tsconfig.json` pass.
- **May change:** `tyche/baselines/`, `tyche/eval/`, `worker/eval/`, `worker/sim/`, `worker/skeleton/main.ts`, `worker/skeleton/mask.ts` and `mask.test.ts` (fixes the check finds), `docs/areas/eval.md`, `tasks/T14-eval-baselines/`.
  - T16 owns `worker/skeleton/env.ts`, `record.ts`, `vocab.ts`, `drive.ts`, `worker/calc/` and `tyche/transport/`. Use them by import; changes you need there go under For integration. T16 keeps `Env`'s config (`games`), `collect`, `encode`, `apply`, `slots`, `stats`, `decisions` and `counts`, and `drive.ts`'s `step` and `randomLegal`, working for you.
  - A mask fix that needs the queued-switch tracking in `env.ts` changed is one of those. Say so in Progress early, since T16 edits `env.ts` in parallel.
- **Limits:** up to two sessions, no paid services. No timed runs are needed.
- **Stop and report if:**
  - a legal action is masked out and the fix needs information the player isn't shown;
  - max-damage wins under ~85% of its duplicate games against random (a planning session's estimate, not a measurement: T09's 10-minute policy won 98.2% against random). That would point to a bug in it or in the record's calcs.

## Progress

## Result

## Outputs

## For integration
