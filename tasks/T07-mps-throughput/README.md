# T07: S4 MPS throughput

## Brief

- **Objective:** measure training and inference throughput on the M4 Max GPU (MPS) for 3M, 5M and 9M-parameter versions of plan.md's Network v0, in fp32 and under autocast, with CPU fallback disabled. End with two proposals for the user: the v0 net size, and the threshold for D9's "the M4 Max isn't enough".
- **Inputs:**
  - Setup: `uv sync --locked` (AGENTS.md, Conventions). No Showdown build is needed.
  - plan.md (Network v0, Training v0, Compute: M4 Max; Phase 0: S4 and S5), D6, D9 (Budget: the open threshold), D10.
  - For the threshold only: env throughput from T02's Result (S1) and turns per game from T04's (replay corpus), on their PRs or `main`. If either isn't there when you reach that step, set State to `blocked (T02 or T04)` and hand off.
- **Deliverables,** in this folder:
  - A stand-in for plan.md's Network v0, with its heads, at 3M, 5M and 9M parameters. It doesn't need to read real observations.
  - Result: samples/s for inference at the batch sizes an env would send, and for PPO training steps (forward, backward, optimizer) at realistic minibatch sizes. fp32 against fp16 and bf16 autocast. CPU inference too, since S5 compares inference in each env process (plan.md, S5): set torch's thread count as an env process would, at 1 and at a few threads, rather than torch's default of every core. Median and spread over ≥3 runs, with load averages and the torch version.
  - A FLOP count for the 5M net, checked against plan.md's estimate of ~2.4 GFLOP per decision step per PPO epoch.
  - The two proposals with their reasoning, and under For integration the text they change in plan.md and D9.
- **Acceptance checks:**
  - With `PYTORCH_ENABLE_MPS_FALLBACK` unset, so no op falls back to CPU, every MPS run completes without error.
  - Over a few hundred training steps on synthetic data, the autocast loss tracks fp32's with no NaN or inf. Result reports the gap.
  - The benchmark reruns from Outputs on a clean checkout and lands within the reported spread.
- **May change:** `tasks/T07-mps-throughput/` only.
- **Limits:** one session, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:** an op the net needs has no MPS kernel, or autocast diverges from fp32.

## Progress

## Result

## Outputs

## For integration
