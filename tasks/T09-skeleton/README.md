# T09: Walking skeleton

## Brief

- **Objective:** the first end-to-end loop, before the real observation builder exists. Node env workers play battles with tracking and the 288 calcs in-process, send Python a minimal numeric record per decision, and a simple synchronous PPO learns to beat random. The skeleton settles the Node↔Python transport and record format that later tasks build on. It also measures env decisions/s end to end for D7's calc revisit trigger (plan.md, Phase 1).
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout and Tests.
  - D7, which says where tracking, calcs and records run. D10: collection starts synchronous, and goes asynchronous once the env is within ~3× of the learner.
  - plan.md: Components 1 and 2; Network v0 (Action head: masking from the request, and mapping moves by the request's index); Compute (the M4 Max bullet: T07's learner figures and env model); Phase 1.
  - Code to copy from, not import (AGENTS.md: spike code): T02's `sim.ts` (`Battle` direct, `Collector`, the per-player split) and the gotchas in T02's README; T06's `calcs.ts` for the 288 set and its cache; T08's `pkmn.ts` for @pkmn/client's NatDex `Generations`.
  - Teams: the stub pool, `data/pool/v0/teams.jsonl`. The calcs use both sides' true sets, since the set library doesn't exist yet (T12). That leaks hidden information, which is acceptable in the skeleton only.
  - Tracking: @pkmn/client 0.7.4 as is. T10 builds the fix layer in parallel as a subclass of the client's `Battle`, so switching to it later is an import change.
- **Deliverables:**
  - `worker/sim/`: a worker process that runs many battles at once, collects each player's chunks and requests, and steps battles as actions come back.
  - `worker/calc/`: the 288 calcs per decision, on the tracked state plus the true sets, cached.
  - `worker/skeleton/`: the minimal record per decision (for example HP, species ids, the calcs and the action mask), the worker's main loop, and the Node end of the transport.
  - `tyche/transport/`: the Python end. It receives batches of records from many workers, stacks them into arrays, and returns one action per decision.
  - `tyche/skeleton/`: a small net, synchronous PPO on those records, and a random baseline.
  - `docs/areas/env-workers.md` covering the transport, the record format, entry points, commands that worked, and gotchas. The record format is an interface, so later tasks link to these notes. Propose the AGENTS.md Areas row under For integration.
  - Result: env decisions/s end to end, and how it compares with the learner.
- **Acceptance checks:**
  - The trained policy wins ≥75% of 1,000 games against random legal actions, playing both seats, on stub-pool teams. Result gives the training time and the win-rate curve.
  - Env decisions/s across 12 worker processes, measured under the timing lock with Python answering with random legal actions so the learner isn't the bound. Take 3 runs and report their median, with each run within 10% of it and load averages recorded. If a run falls outside, find the noise and rerun. Also break one process's ms per decision into sim, tracking, calcs, record building and transfer.
  - Result compares that rate with T07's learner estimate for the 5M net (~1,900 decisions/s at 33 tokens, ~820 at 77). It says whether D7's calc revisit trigger fires, and whether the env is within ~3× of the learner, which is D10's condition for asynchronous collection. Both verdicts are provisional, since the learner figure is T07's estimate.
  - The record format carries a version, documented in env-workers.md, and each end refuses a version it doesn't know.
  - Tests (AGENTS.md, Conventions: Tests) cover the transport round trip, the record layout on both ends, and the action mask against the request.
  - `tsc -p tsconfig.json` passes.
- **May change:** `worker/sim/`, `worker/calc/`, `worker/skeleton/`, `tyche/transport/`, `tyche/skeleton/`, `docs/areas/env-workers.md`, `tasks/T09-skeleton/`.
- **Limits:** up to four sessions, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:**
  - env decisions/s at 12 processes falls below T07's 33-token learner estimate (~1,900), which fires D7's calc revisit trigger;
  - the transport alone costs more than ~1 ms per decision per process. That is a fifth of the ~5.4 ms that record building and transfer have, at 33 tokens, before the env bounds the M4 Max (plan.md, Compute), and far more than moving a small numeric record should cost.

## Progress

```text
2026-11-26 (3)
State: done
Verified: all acceptance checks (Result, Acceptance checks), with the code at dce3f22, Showdown 29f2d99,
  Node 24.22.3, Python 3.14.7, torch 2.15.0. Env: 11,064 decisions/s at 12 processes (median of 3, within 8.4%).
  Trained policy: 982 of 1,000 games against random. node --test (10) and uv run pytest (8) pass; tsc passes.
Pending: none
Next: the user reviews the PR; two adversarial review passes (workflow.md, Task session, step 7).
```

```text
2026-11-26 (2)
State: active
Verified: worker/sim, worker/calc, worker/skeleton and tyche/transport built; tsc passes. Node tests (10):
  mask probe against the sim on every decision of 6 random games, the Eject Pack queued-switch case, calcs on
  tracked state equal to calcs on sim state (0 of 141,321 differ, 8 games), records against the sim. Python
  transport tests (6): round trip, stack, echo, both ends refusing another version. Showdown 29f2d99, Node 24.22.3.
Pending: env decisions/s at 12 processes (timed); transport-alone timing; PPO and the 1,000-game eval;
  env-workers.md; Result.
Next: tyche/skeleton/bench.py, then 3 timed runs under the lock.
```

```text
2026-11-26
State: active
Verified: nothing yet (claimed 2026-11-26)
Pending: all acceptance checks
Next: setup in this worktree, then worker/sim/ (Battle direct, many battles per process) and the transport
```

## Result

**Both bars pass and no stop condition was hit.** Twelve env workers ran ~11.1k decisions/s end to end, ~5.8× T07's 33-token learner estimate: D7's calc revisit trigger doesn't fire, and the env is not within D10's ~3×, so collection stays synchronous. Both verdicts are provisional (Against the learner). After 10 minutes of synchronous PPO, the policy won 982 of 1,000 games against random legal actions. The transport alone costs ~0.001–0.005 ms per decision, against the stop condition's 1 ms. All figures: 2026-11-26, M4 Max, Showdown 29f2d99, Node 24.22.3, Python 3.14.7, torch 2.15.0, stub pool v0.

What was built is in [env-workers](../../docs/areas/env-workers.md): the worker, the calcs on tracked state, record version 1 and the transport.

### Env decisions/s

`tyche/skeleton/bench.py`: each worker runs 32 battles; Python answers each batch with uniformly random legal actions; 10 s warm-up, then a 30 s window. Three runs (`results/env-12.jsonl`, `.log`):

| Run | Decisions/s | ms per decision per process | CPU share per worker (median) | Other cores | Load average before → after |
|---|---|---|---|---|---|
| 0 | 11,064 | 1.085 | 1.04 | 0.7 | 0.83 → 8.97 |
| 1 | 11,206 | 1.071 | 1.05 | 0.6 | 8.97 → 12.26 |
| 2 | 10,140 | 1.185 | 1.00 | 1.4 | 12.26 → 15.02 |

**Median 11,064 decisions/s; the farthest run is 8.4% off it,** inside the brief's 10%. Run 2 had the most other load (1.4 cores, from iostat over the window, less the workers' and Python's CPU) and the lowest CPU share. The load averages climb with the workers' own load.

One process's ms per decision by phase (median over workers; at 1 process, 3 runs of 20 s, `results/env-1.jsonl`):

| Phase | 12 processes (run 0) | 1 process (median run) |
|---|---|---|
| Sim (`choose`, output, game start and end) | 0.263 | 0.193 |
| Tracking (both players' @pkmn/client) | 0.048 | 0.037 |
| Calcs (288 set, cached) | 0.737 | 0.586 |
| Record building (request, mask, fields) | 0.019 | 0.010 |
| Transfer (write the batch, wait for the actions) | 0.017 | 0.003 |
| Total (window / decisions) | 1.085 | 0.829 |

- The phases add up to the window within 0.01 ms. Calcs are 68% of a decision at 12 processes.
- Transfer at 12 processes includes waiting while Python answers the other 11. Python took ~0.06 ms per 58-record batch and ~2.5% of a core.
- The games: 978k decisions and 7,717 games across the three windows, with no `[Invalid choice]`, no `[Unavailable choice]` and no game at the 300-turn cap. 111–112 calcs per decision with 72% cache hits. T06 counted 96.4 calcs and 69% hits with Showdown's `RandomPlayerAI` players, which pick moves 70% of the time; these players pick uniformly among legal actions.
- plan.md's estimate was 0.91 ms per decision (sim 0.38 under calcs, calcs 0.53 at one process) and ~13k decisions/s. The calcs cost more here, 0.59 ms alone and 0.74 at 12 processes, partly from the extra calcs per decision.

### Transport alone

With `--echo 58` each worker sends the same 58 blank records every step and plays nothing (`results/echo.jsonl`, `.log`; 3 runs of 20 s each):

| Workers | Decisions/s (median) | ms per decision per worker | Runs within |
|---|---|---|---|
| 1 | 1.73M | 0.0006 (~34 µs per batch round trip) | 3.6% |
| 12 | 2.57M | 0.0047 | 1.3% |

At 12 workers Python, one thread answering all of them, is the bound (0.81 of a core). Either way the transport is ~1/200 or less of the stop condition's 1 ms.

### Against the learner

| | T07's learner estimate (5M net, bf16, 3 epochs) | Env / learner |
|---|---|---|
| 33 tokens | ~1,903 decisions/s | 5.8× |
| 77 tokens | ~824 decisions/s | 13.4× |

- **D7's calc revisit trigger** (the env bounds the M4 Max): doesn't fire. The env is 5.8× the learner at 33 tokens.
- **D10's condition** for asynchronous collection (the env within ~3× of the learner): not met at 5.8×.
- **Both are provisional:** the learner rate is T07's estimate, not a measurement; the record is a minimal stand-in, and the full observation builder adds to it; the calcs use true sets, and calcs on prior sets will hit the cache differently (T06, Result); and the games are random play, not self-play. At 33 tokens the env reaches 3× of the learner at ~2.1 ms per decision per process (12 / 5,709) and bounds it at ~6.3 ms (12 / 1,903). So D10's switch hinges on the full builder adding about 1 ms per decision, and D7's on it adding about 5 ms.

### Training

`python -m tyche.skeleton.train --out runs/train-0 --minutes 10 --workers 12 --seed 0`, under the timing lock (`runs/train-0.log`, `runs/train-0/log.jsonl`): 12 workers with 32 battles each, a 390k-parameter MLP on CPU (2 threads). Half of the games are self-play and half the policy against random legal actions, in a random seat. PPO with GAE (γ 0.99, λ 0.95), clip 0.2, entropy 0.01, value 0.5, Adam 3e-4, 4 epochs of minibatch 2,048 per update of ≥32,768 decisions. Rewards are +1, −1 and 0 at the last decision; a game cut off at the cap bootstraps from its last value (none was).

- **Training time: 9.9 minutes,** 4.62M decisions, 67.5k games and 103 updates of ~0.5 s each. That is ~7.8k decisions/s through the loop, against the env's 11.1k alone. The gap is Python's inference, the updates, and gathering one batch from every worker per step.
- The win-rate curve, over each update's last 500 games against random (including games played by earlier policies):

| Minutes | Decisions | Win rate against random |
|---|---|---|
| 0.2 | 72k | 0.52 |
| 0.5 | 244k | 0.62 |
| 1.0 | 466k | 0.76 |
| 1.5 | 687k | 0.85 |
| 2.0 | 914k | 0.89 |
| 3.0 | 1.37M | 0.94 |
| 4.0 | 1.81M | 0.97 |
| 6.0 | 2.71M | 0.97 |
| 8.7 | 4.04M | 0.98 |
| 9.9 | 4.62M | 0.99 |

- **Evaluation:** `python -m tyche.skeleton.eval runs/train-0/net.pt --games 1000` (`results/eval-1000.json`): **982 of 1,000 wins (98.2%, 95% interval 97.2–98.9%)**, 491 of 500 as p1 and 491 of 500 as p2, with no ties or cut-off games and 24.1 turns on average. Its seeds (`eval-0`) weren't used in training; the teams are the same 20. Worker w plays games 0–99, the policy as p1 in even games, so the 1,000 games are fixed before they start. The policy samples its actions.
- Random is a low bar, and the calcs carry the opponents' true sets, so this policy may lean on information the player isn't shown. The skeleton allows that; v0-lite doesn't (plan.md, Phase 1).

### Acceptance checks

- **≥75% of 1,000 games against random, both seats:** passed, 98.2% (Training).
- **Env decisions/s at 12 processes, 3 runs within 10% of their median, with load averages and the breakdown:** passed (Env decisions/s).
- **Compared with T07's learner estimate, with the D7 and D10 verdicts:** above (Against the learner).
- **The record carries a version, documented, and each end refuses a version it doesn't know:** [env-workers](../../docs/areas/env-workers.md) (Record, Transport). `tyche/transport/test_transport.py` checks both ends refuse another version.
- **Tests** (`node --test 'worker/**/*.test.ts'`, 10; `uv run pytest`, 8): the transport round trip (`test_transport.py`); the record layout on both ends (`record.test.ts`, and the hello's layout against `record.py`); the mask against the request (`mask.test.ts`: hand-made requests, the queued-switch case played out, and every action probed on a copy of the battle at every decision of 6 random games). Also `calcs.test.ts`: on 8 random games, 0 of 141,321 nonzero calcs on the tracked state differ from the same calcs on the sim's state.
- **`tsc -p tsconfig.json`:** passes.

### Not checked

- The full observation, calcs on prior sets, and the leak tests: later Phase 1 tasks.
- Phase 1's sampled mask check wants ≥10k requests from random games and the skeleton's policy. `mask.test.ts` probes ~900 decisions from random games. No `maybeTrapped` request came up, and there is no Ultra Burst action.
- Self-play game lengths and decisions per turn: the timing used random players.
- The learner on MPS and asynchronous collection. The skeleton's learner is a CPU MLP.

## Outputs

Setup as in AGENTS.md (Conventions), then from the root, with `nvm use` in the same command. Code paths and the record format are in [env-workers](../../docs/areas/env-workers.md).

Timings, under the timing lock via this folder's `timed.sh` (a copy of T02's, owner T09):

```bash
tasks/T09-skeleton/timed.sh uv run python -m tyche.skeleton.bench --out tasks/T09-skeleton/results/env-12.jsonl --workers 12 --runs 3
```

```bash
tasks/T09-skeleton/timed.sh uv run python -m tyche.skeleton.bench --out tasks/T09-skeleton/results/env-1.jsonl --workers 1 --seconds 20 --warmup 5 --runs 3
```

```bash
tasks/T09-skeleton/timed.sh uv run python -m tyche.skeleton.bench --out tasks/T09-skeleton/results/echo.jsonl --workers 12 --echo 58 --seconds 20 --warmup 5 --runs 3
```

Training and evaluation (the training run stops on wall time, so a rerun's curve differs a little):

```bash
tasks/T09-skeleton/timed.sh uv run python -m tyche.skeleton.train --out tasks/T09-skeleton/runs/train-0 --minutes 10 --workers 12 --seed 0
```

```bash
uv run python -m tyche.skeleton.eval tasks/T09-skeleton/runs/train-0/net.pt --games 1000 --workers 10 --seed 0 --out tasks/T09-skeleton/results/eval-1000.json
```

| File | What it is |
|---|---|
| `results/env-12.*`, `env-1.*`, `echo.*` | The timing runs: one JSON line per run, and the printed summary |
| `runs/train-0.log`, `runs/train-0/log.jsonl` | The training run: one line per update |
| `runs/train-0/net.pt` | Its final checkpoint (1.6 MB), which the eval reads |
| `results/eval-1000.json` | The evaluation |
| `inproc.ts` | `node tasks/T09-skeleton/inproc.ts [games] [battles]`: the env in one process with random actions and no transport |
| `timed.sh` | T02's lock wrapper with owner T09 |

## For integration

1. **AGENTS.md, Areas:** add a row after Team pool and set priors:

   ```markdown
   | Env workers | Walking skeleton: sim, tracking, 288 calcs on true sets, record v1, transport | `worker/sim/`, `worker/calc/`, `worker/skeleton/`, `tyche/transport/` | [env-workers](docs/areas/env-workers.md) |
   ```

2. **AGENTS.md, Conventions:** after the Tests bullet, add:

   ```markdown
   - **Python entry points** under `tyche/` run as modules from the root: `uv run python -m tyche.skeleton.train`. Run by path, the root isn't on `sys.path`. Those that start env workers need Node 24 on `PATH` (`nvm use` in the same command), and refuse another major.
   ```

3. **plan.md, Compute, M4 Max:** replace the bullet "The learner bounds the M4 Max. The env's cost is the sim, …" and the next one ("Tracking adds 0.018 ms …") with:

   ```markdown
   - The learner bounds the M4 Max. T09's walking skeleton measured ~11.1k env decisions/s on 12 worker processes (median of 3 runs, 10.1–11.2k; 2026-11-26), with tracking, the cached 288 calcs on true sets, a minimal record and transfer to Python, which answered at random. That is ~5.8× T07's 33-token learner estimate and ~13× the 77-token one. Per decision per process: sim 0.26 ms, tracking 0.05, calcs 0.74, record 0.02, transfer 0.02, 1.09 ms in all. The transport alone costs ~0.001–0.005 ms per decision. Those games had uniformly random players.
   - The full observation builder adds to the record's cost. The env becomes the bound at ~6.3 ms per decision per process at 33 tokens (12 processes against ~1,900 learner decisions/s; ~14.6 ms at 77), and comes within D10's ~3× at ~2.1 ms (~4.9 ms at 77).
   ```

4. **decisions.md, D7, the Revisit bullet:** after "measured by Phase 1's walking skeleton and again with the full observation builder", add "(the skeleton: not env-bound, ~5.8× T07's 33-token learner estimate; T09, 2026-11-26)".

5. **decisions.md, D10, "Why not yet":** replace "on the M4 Max the env is ~7× faster than the learner (plan.md, Compute), so overlapping them would save only ~13% of wall time at 33 tokens (~6% at 77)" with "on the M4 Max T09's skeleton measured the env at ~5.8× T07's learner estimate at 33 tokens (~13× at 77; plan.md, Compute), so overlapping them would save only ~15% of wall time at 33 tokens (~7% at 77)". After "On the M4 Max that is T09's skeleton, at first against T07's learner estimate" add "(not yet within 3×; the full observation builder is measured next)".

6. **plan.md, Phase 1, Exit, Skeleton:** met by T09 (Result). The planning session marks it as it marks exit items.
