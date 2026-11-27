# T18: Rented env benchmark

## Brief

- **Objective:** an early read on D2's gate. plan.md's estimate of $5.40–9 per million games (Compute, Rented) straddles the gate's $8, and the Phase 2 trial that measures it is months away. This task measures the env's decisions/s on one rented many-vCPU box, converts that to an env-only $ per million games, and says how much room it leaves under $8. The user approved it on 2026-11-27, as an exception to D9's budget rule (decisions.md, D9).
- **Inputs:**
  - Setup (AGENTS.md, Conventions) on the rented box: Linux x86. T12 and the planning session of 2026-11-27 ran the setup and tests in a Linux cloud container, so it works there.
  - T09's `tyche/skeleton/bench.py` and its Outputs: the end-to-end env, with tracking, the cached 288 calcs, record version 1 and transfer, and Python answering at random. Run it on v1's training teams (`data/pool/v1/`).
  - T02's `tasks/T02-sim-throughput/sweep.ts`: the sim alone, for a like-for-like comparison with the M4 Max's figures in plan.md, Compute.
  - plan.md, Compute (Env, M4 Max, Rented) and D2's gate.
- **Deliverables,** in this folder:
  - The box: provider, instance type, CPU model, vCPU count, physical cores, RAM, $ per hour, and the date. Prefer a GPU listing with ≥48 vCPUs, since that is what a training run would rent (plan.md, Compute: Rented). The GPU sits idle here.
  - **T09's bench** at several worker counts: 1, the physical cores, the vCPUs, and two points between. Run each 3 times, with its median and spread. Also give ms per decision per process by phase, against T09's M4 Max figures.
  - **T02's sim sweep** at the same counts.
  - **The learner on the same box's GPU:** T07's `tasks/T07-mps-throughput/tokens/bench.py` ported to `cuda` (in this folder), for the 5M net at 33 tokens and at 53 with the per-move encoder. Give training and inference decisions/s. Then give a combined $ per million games at whichever of the env or the learner bounds the box.
  - **$ per million games,** env only first: $ per hour ÷ (decisions/s at the best count × 3,600) × decisions per game × 10⁶. State the decisions per game you use. Give T09's random games' figure and one derived from T04's human game lengths (plan.md, Compute: Env and Turns per game). Say what the figure leaves out: the learner (the trial's box runs it on the GPU), the full observation builder (T16 measures its cost), and self-play game lengths.
  - Result: the figures, and what they suggest for D2's gate, stated as provisional.
- **Acceptance checks:**
  - Each count's 3 runs are within 10% of their median, or the spread is reported with its cause (noisy neighbours, throttling).
  - Load and CPU share are recorded with each run, as `bench.py` does.
  - The box is terminated, and its total cost is recorded from the provider's billing.
- **May change:** `tasks/T18-rented-env-bench/` only.
- **Limits:**
  - Spend: aim for ≤$5, and stop at $8 total.
  - The user creates the account and payment, and gives the session access to the box. Run from the user's Mac.
  - No credentials, account details or hostnames in the repo, which is public.
  - One session.
  - The shared timing lock is for this Mac's runs; the box needs no lock, but run nothing else on it.
- **Stop and report if:**
  - the spend would pass $8;
  - setup fails on the box in a way that needs changing project code;
  - the env-only figure alone exceeds ~$4 per million games, half the gate, at the best count.

## Progress

## Result

## Outputs

## For integration
