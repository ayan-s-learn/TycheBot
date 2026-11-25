# T07: S4 MPS throughput

## Brief

- **Objective:** measure training and inference throughput on the M4 Max GPU (MPS) for 3M, 5M and 9M-parameter versions of plan.md's Network v0, in fp32 and under autocast, with CPU fallback disabled. Give the learner's games/day, which D7's calc revisit trigger uses, and end with two proposals for the user: the v0 net size, and the threshold for D9's "the M4 Max isn't enough".
- **Inputs:**
  - Setup: `uv sync --locked` (AGENTS.md, Conventions). No Showdown build is needed.
  - plan.md (Network v0, Training v0, Compute: M4 Max; Phase 0: S4; Phase 1), D6, D9 (Budget: the open threshold), D10.
  - For the threshold only: env throughput from T02's Result (S1) and turns per game from T04's (replay corpus), on main (plan.md, Compute).
- **Deliverables,** in this folder:
  - A stand-in for plan.md's Network v0, with its heads, at 3M, 5M and 9M parameters. It doesn't need to read real observations.
  - Result: samples/s for inference at the batch sizes an env would send, and for PPO training steps (forward, backward, optimizer) at realistic minibatch sizes. fp32 against fp16 and bf16 autocast. CPU inference too, since inference may run in each env process instead of on MPS: set torch's thread count as an env process would, at 1 and at a few threads, rather than torch's default of every core. Median and spread over ≥3 runs, with load averages and the torch version.
  - The learner's decisions/s per PPO epoch at the stated minibatch size, and the games/day the M4 Max then supports. If inference runs on MPS, it shares the GPU with training, since collection continues during updates (D10). GPU time per game is then MPS inference for every decision plus training for the trained ones, about 75% since half of games are against frozen snapshots (plan.md, Training v0: League), at a stated epoch count (Training v0 fixes none). Give it at T02's random-game length (48.9 turns, 2.29 decisions per turn) and at T04's human lengths (plan.md, Compute). Compare it with the env's CPU budget on the same machine: T02's sim, T06's calcs for the 288 and 48 sets (T06 timed calcs in one process only, so state that), and CPU inference if inference ran on CPU. Say which bounds the M4 Max, and how much per-decision Python parsing and transfer (unmeasured until Phase 1's walking skeleton) would have to cost to change that. D7's calc revisit trigger uses this (decisions.md, D7).
  - A FLOP count for the 5M net, checked against plan.md's estimate of ~2.4 GFLOP per decision step per PPO epoch.
  - The two proposals with their reasoning, and under For integration the text they change in plan.md and D9.
- **Acceptance checks:**
  - With `PYTORCH_ENABLE_MPS_FALLBACK` unset, so no op falls back to CPU, every MPS run completes without error.
  - Over a few hundred training steps on synthetic data, the autocast loss tracks fp32's with no NaN or inf. Result reports the gap.
  - The benchmark reruns from Outputs on a clean checkout and each rerun median lies within 10% of the reported median.
- **May change:** `tasks/T07-mps-throughput/` only.
- **Limits:** one session, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:** an op the net needs has no MPS kernel, or autocast diverges from fp32.

## Progress

2026-11-25, claim:

```text
State: active
Verified: torch 2.15.0, Python 3.14.7, MPS available (M4 Max, 32-core GPU, 36 GB)
Pending: everything
Next: write the stand-in net and benchmark
```

## Result

## Outputs

## For integration
