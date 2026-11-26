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

## Result

## Outputs

## For integration
