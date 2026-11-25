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

2026-11-25, done:

```text
State: done
Verified: 3 benchmark runs, the convergence and contention checks, and a 3-run rerun from a fresh clone of 17c2742 (every median within 2.7%), torch 2.15.0
Pending: review (workflow.md, Task session, step 7)
Next: user review and two adversarial passes; then a planning session, with the user's OK on the net size and D9's threshold
```

2026-11-25, claim:

```text
State: active
Verified: torch 2.15.0, Python 3.14.7, MPS available (M4 Max, 32-core GPU, 36 GB)
Pending: everything
Next: write the stand-in net and benchmark
```

## Result

**Proposals for the user:** a 5M v0 net, trained and run under bf16 autocast; and for D9, the M4 Max "isn't enough" when the next planned run needs more than 14 days on it at the games/day the current pipeline measures. Both are argued under Proposals. The learner, not the env, bounds the M4 Max, by about 18×. With MPS inference, Python parsing and transfer would have to cost ~14 ms per decision per process to change that (Learner and env). No stop condition was hit.

All timings: 2026-11-25, torch 2.15.0, Python 3.14.7, MacBook Pro (Mac16,5) M4 Max with a 32-core GPU and 36 GB, on mains power. `PYTORCH_ENABLE_MPS_FALLBACK` was unset, which `bench.py` asserts. Three runs of `bench.py`, each a fresh process, ran back to back under the timing lock from 17:02 to 17:19 at 1-minute load averages of 0.5–2.2 (`runs/2026-11-25.log`).

### Stand-in net

`net.py` follows plan.md's Network v0, fed synthetic inputs:

- **Tokens (77):** field (1), own mons (6), opposing mons (6), every own and opposing mon's moves (24 + 24), and the last 16 events. A mon token is built from its species, item, ability and four move embeddings (64 wide; vocabularies are gen9nationaldex's sizes at the pin, from T06) plus 128 numeric features, which include its 24 damage calcs. Move tokens carry a move embedding plus 48 dex features, and event tokens carry three embeddings plus 16 features. About 10% of the non-mon tokens are masked out of attention, standing in for empty event slots.
- **Trunk:** a pre-RMSNorm transformer with 64-wide heads, a GELU MLP 4× wide, and one set of weights shared by all token types.
- **Heads:** 18 masked action logits (4 moves × {plain, Mega, Z} from the active mon's move tokens, plus a switch per team slot) and a value. Training adds the aux heads on the 6 opposing mon tokens (moves, item, ability, spread bucket) and the opponent's next action. The heads run in fp32 under autocast, because masking with −inf and log-softmax overflow in fp16.
- **Loss:** PPO's clipped surrogate, value MSE, entropy, KL(uniform‖π) over legal actions (D10), and the aux losses. A step is forward, backward, a grad-norm clip at 1.0 and AdamW. fp16 adds a `GradScaler`, which bf16 doesn't need.

| Size | d | Layers | Params | Trunk params | Inference GFLOP per decision | Training GFLOP per decision per epoch |
|---|---|---|---|---|---|---|
| 3M | 192 | 5 | 3.09M | 2.22M | 0.369 | 1.132 |
| 5M | 256 | 5 | 5.06M | 3.95M | 0.644 | 1.963 |
| 9M | 320 | 6 | 8.76M | 7.39M | 1.191 | 3.616 |
| 5M@53 | 256 | 5 | 5.05M | 3.95M | 0.438 | 1.337 |

5M@53 is the 5M net without the opposing move tokens, 53 tokens, to show what the token count costs. About 1.1M of each net's parameters sit in embedding tables, input projections and aux heads, which cost few FLOPs.

**FLOP check:** `flops.py` counts the matmuls and attention with torch's `FlopCounterMode`, which leaves out elementwise ops. The 5M net costs **1.96 GFLOP per decision step per PPO epoch** (forward + backward), against plan.md's ~2.4. The plan's figure is 6 × 5M params × 80 tokens. Here only the 3.95M trunk parameters act on every token (6 × 3.95M × 77 = 1.82 GFLOP), and the heads add the rest. At the measured rates, MPS sustains ~4.2 TFLOP/s training the 5M net under bf16 (3.8 fp32) and ~7.3 TFLOP/s in inference, within the plan's assumed 4–6 TFLOP/s for training.

### Throughput

Median (min–max) over the 3 runs. Each configuration ran 3 untimed steps (MPS builds its graphs on a new shape), then timed steps for at least 2 s and 5 steps, with the GPU synchronized at both ends.

- **MPS inference** includes copying the batch to the GPU and the logits and value back, as an inference server would. It uses the policy and value heads only.
- **MPS training** times one PPO minibatch step on data already on the GPU. The minibatch stops at 1024: the 9M net in fp32 at 2048 pushed the machine into ~9 GB of swap in a trial run, and throughput is flat from 512 up.
- **CPU inference** is fp32 with `torch.set_num_threads` at 1, 2 and 4 and one interop thread, as an env process would set it, at the batch sizes one env process would send (up to 64: 32 battles, two players).

#### MPS inference, samples/s

| Size | Batch | fp32 | fp16 autocast | bf16 autocast |
|---|---|---|---|---|
| 3M | 16 | 5,679 (5,598–5,690) | 5,347 (5,294–5,362) | 5,253 (5,250–5,287) |
| 3M | 64 | 11,329 (11,280–11,348) | 11,673 (11,642–11,679) | 11,480 (11,477–11,497) |
| 3M | 256 | 14,528 (14,484–14,716) | 17,060 (17,047–17,262) | 16,967 (16,953–17,125) |
| 3M | 1024 | 10,531 (10,446–10,722) | 14,089 (14,075–14,116) | 14,065 (14,015–14,154) |
| 5M | 16 | 4,628 (4,625–4,632) | 4,504 (4,471–4,514) | 4,499 (4,466–4,514) |
| 5M | 64 | 8,019 (7,999–8,022) | 8,614 (8,527–8,645) | 8,645 (8,592–8,665) |
| 5M | 256 | 9,720 (9,605–9,784) | 10,992 (10,813–11,147) | 11,286 (11,238–11,350) |
| 5M | 1024 | 7,190 (7,162–7,259) | 9,354 (9,332–9,512) | 9,463 (9,448–9,528) |
| 9M | 16 | 3,226 (3,223–3,254) | 3,191 (3,150–3,211) | 3,199 (3,198–3,201) |
| 9M | 64 | 4,958 (4,948–5,032) | 5,410 (5,384–5,414) | 5,407 (5,405–5,414) |
| 9M | 256 | 5,683 (5,647–5,696) | 6,533 (6,506–6,626) | 6,586 (6,572–6,628) |
| 9M | 1024 | 4,366 (4,363–4,384) | 5,707 (5,667–5,729) | 5,661 (5,642–5,671) |
| 5M@53 | 16 | 5,433 (5,370–5,475) | 5,078 (5,043–5,121) | 5,076 (5,062–5,080) |
| 5M@53 | 64 | 10,673 (10,635–10,756) | 11,177 (11,136–11,200) | 11,214 (11,177–11,280) |
| 5M@53 | 256 | 13,209 (13,205–13,304) | 16,175 (16,037–16,202) | 15,912 (15,877–16,367) |
| 5M@53 | 1024 | 10,028 (9,947–10,172) | 13,604 (13,586–13,822) | 13,589 (13,519–13,863) |

#### MPS training, samples/s per epoch

| Size | Batch | fp32 | fp16 autocast | bf16 autocast |
|---|---|---|---|---|
| 3M | 256 | 3,127 (3,108–3,170) | 2,870 (2,855–2,886) | 3,236 (3,234–3,276) |
| 3M | 512 | 2,782 (2,780–2,818) | 2,874 (2,864–2,893) | 3,069 (3,043–3,099) |
| 3M | 1024 | 2,814 (2,808–2,856) | 3,026 (3,012–3,042) | 3,120 (3,107–3,142) |
| 5M | 256 | 2,200 (2,183–2,220) | 2,061 (2,053–2,069) | 2,268 (2,263–2,292) |
| 5M | 512 | 1,935 (1,928–1,954) | 2,038 (2,035–2,053) | 2,146 (2,141–2,165) |
| 5M | 1024 | 1,936 (1,932–1,960) | 2,103 (2,094–2,115) | 2,163 (2,159–2,178) |
| 9M | 256 | 1,323 (1,317–1,338) | 1,293 (1,290–1,294) | 1,333 (1,327–1,349) |
| 9M | 512 | 1,164 (1,163–1,174) | 1,239 (1,238–1,241) | 1,218 (1,215–1,229) |
| 9M | 1024 | 1,173 (1,170–1,176) | 1,244 (1,239–1,246) | 1,208 (1,197–1,209) |
| 5M@53 | 256 | 2,846 (2,835–2,896) | 2,798 (2,793–2,828) | 3,150 (3,113–3,192) |
| 5M@53 | 512 | 2,899 (2,895–2,903) | 2,973 (2,937–3,033) | 3,162 (3,141–3,237) |
| 5M@53 | 1024 | 2,523 (2,491–2,564) | 2,845 (2,839–2,871) | 2,925 (2,893–2,988) |

#### CPU inference (fp32), samples/s

| Size | Batch | 1 thread | 2 threads | 4 threads |
|---|---|---|---|---|
| 3M | 1 | 817 (799–820) | 806 (804–808) | 799 (783–803) |
| 3M | 8 | 1,267 (1,203–1,277) | 1,455 (1,440–1,461) | 1,804 (1,769–1,812) |
| 3M | 32 | 1,436 (1,412–1,437) | 2,054 (2,033–2,133) | 2,809 (2,720–2,810) |
| 3M | 64 | 1,466 (1,438–1,474) | 2,200 (2,181–2,321) | 3,021 (2,956–3,028) |
| 5M | 1 | 568 (566–569) | 582 (577–583) | 610 (606–614) |
| 5M | 8 | 902 (884–906) | 1,163 (1,155–1,170) | 1,366 (1,360–1,377) |
| 5M | 32 | 1,037 (1,013–1,045) | 1,488 (1,472–1,494) | 1,876 (1,873–1,898) |
| 5M | 64 | 1,043 (1,014–1,045) | 1,552 (1,534–1,572) | 2,052 (1,985–2,053) |
| 9M | 1 | 381 (371–382) | 402 (389–403) | 425 (412–427) |
| 9M | 8 | 598 (577–599) | 757 (750–758) | 936 (924–960) |
| 9M | 32 | 686 (668–687) | 980 (963–982) | 1,246 (1,217–1,246) |
| 9M | 64 | 679 (659–681) | 1,008 (968–1,008) | 1,306 (1,256–1,307) |
| 5M@53 | 1 | 732 (724–732) | 699 (698–699) | 718 (714–722) |
| 5M@53 | 8 | 1,301 (1,285–1,305) | 1,454 (1,449–1,463) | 1,695 (1,670–1,700) |
| 5M@53 | 32 | 1,555 (1,534–1,557) | 2,114 (2,093–2,116) | 2,748 (2,705–2,748) |
| 5M@53 | 64 | 1,601 (1,573–1,615) | 2,314 (2,260–2,329) | 2,942 (2,793–2,945) |

Readings:

- **Autocast:** bf16 trains the 5M net 12% faster than fp32 (2,163 against 1,936 at minibatch 1024) and infers 16% faster at batch 256 (11,286 against 9,720). fp16 is no faster than bf16, needs a `GradScaler`, and is slower than fp32 at minibatch 256, likely because the scaler's per-step check of the gradients for inf weighs more there. The 9M net gains least: 3% training under bf16, 6% under fp16.
- **Batch size:** MPS inference peaks at batch 256 and drops 14–28% at 1024. One env process's batch (≤64) gets 68–83% of the peak for the 3M and 5M nets, so a shared inference server across env processes gains less than the batch sizes suggest. Training is flat from 512 to 1024.
- **Size:** throughput tracks FLOPs. Relative to the 5M net, the 3M trains 1.44× as fast and the 9M 0.56× (bf16, 1024).
- **Tokens:** cutting the 5M net to 53 tokens trains it 1.35× as fast (2,925 against 2,163) and infers 1.41× as fast: as much as dropping to the 3M net.
- **CPU inference** of the 5M net at batch 64 costs 0.96 ms per decision on one thread and 1.29 and 1.95 core-ms on 2 and 4 threads. One thread per env process uses the cores best. At batch 1 it is ~570 decisions/s whatever the thread count.

### Learner and env

**The learner's decisions/s per PPO epoch** at minibatch 1024 is the training rate: **2,163 for the 5M net under bf16** (1,936 fp32), 3,120 for the 3M, 1,208 for the 9M.

**GPU time per decision** = MPS inference for every decision + 0.75 × epochs × training per decision. 0.75 is the share of decisions trained: half of games are against the latest policy (both sides trained) and half against frozen snapshots (one side). The snapshot side's inference costs the same as the learner's. Inference at batch 256, training at minibatch 1024. Training v0 fixes no epoch count, so 2–4 are shown. Decisions per game use T02's 2.29 per turn: 112 at random games' 48.9 turns, and 57 and 80 at T04's human 25 and 35 turns (plan.md, Compute). Full table: `uv run python summarize.py runs/2026-11-25.jsonl`.

| Size | dtype | Inference ms/decision | Training ms/decision/epoch | Epochs | Learner decisions/s | Games/day, T02 random games (112 decisions) | Games/day, T04 human, 25 turns (57 decisions) | Games/day, T04 human, 35 turns (80 decisions) |
|---|---|---|---|---|---|---|---|---|
| 3M | bf16 | 0.059 | 0.320 | 2 | 1,853 | 1.43M | 2.80M | 2.00M |
| 3M | bf16 | 0.059 | 0.320 | 3 | 1,282 | 0.99M | 1.93M | 1.38M |
| 5M | fp32 | 0.103 | 0.517 | 3 | 791 | 0.61M | 1.19M | 0.85M |
| 5M | bf16 | 0.089 | 0.462 | 2 | 1,279 | 0.99M | 1.93M | 1.38M |
| 5M | bf16 | 0.089 | 0.462 | 3 | 886 | 0.68M | 1.34M | 0.96M |
| 5M | bf16 | 0.089 | 0.462 | 4 | 678 | 0.52M | 1.02M | 0.73M |
| 9M | bf16 | 0.152 | 0.828 | 3 | 497 | 0.38M | 0.75M | 0.54M |

**Shared GPU** (`contend.py`, 5M, bf16, three 20 s windows per scenario; `runs/contend.jsonl`): run in separate processes at once, inference and training each kept 60% and 46% of its alone rate (median), which sum to 1.06 of the GPU. So the summed times above hold, a little pessimistically. With 13 more processes spinning on the CPU, standing in for env workers, training alone lost 7% (1,969 against 2,124 decisions/s), and with inference too the shares summed to 0.97. **Under a full CPU, the games/day above are ~3% high.**

**Env CPU budget** on the same machine, per decision per process, with 13 env processes and one core left for the learner:

| Work | ms per decision | Source |
|---|---|---|
| Sim, `Battle` direct | 0.28 | T02, 14 processes |
| 288 calc set, cached | 0.53 | T06, one process |
| 48 calc set, cached | 0.25 | T06, one process |
| CPU inference, 5M fp32, batch 64, 1 thread | 0.96 | this task |

T06 timed calcs in one process only. If they slow under 14-process load as T02's sim did (0.18 to 0.28 ms, ×1.52), the 288 cost 0.81 ms.

- **MPS inference, 288 calcs:** 13 / 0.81 ms ≈ **16k env decisions/s against the learner's 886** (5M, bf16, 3 epochs): **18×.** With calcs slowed ×1.52: 12k, 13×.
- **CPU inference, 288 calcs:** 13 / 1.77 ms ≈ 7.3k env decisions/s. The learner then trains only (962 decisions/s): 7.6×.
- **What would flip it:** the env bounds the M4 Max once per-decision Python parsing and transfer (unmeasured until Phase 1's walking skeleton) cost more than 13 / 886 − 0.81 ≈ **13.9 ms per decision per process** with MPS inference, or 11.7 ms with CPU inference. D7's builder rule (env below 2× the learner) trips at 6.5 and 5.0 ms. For the fastest learner in the table (3M, bf16, 2 epochs, 1,853 decisions/s) these fall to 6.2 ms to bound and 2.7 ms for the 2× rule.
- **For D7's calc revisit trigger:** S4 finds the learner bounds the M4 Max. Its first condition (the env bounding the M4 Max) can then come only from Phase 1's walking skeleton measuring parsing and transfer above those figures. On the M4 Max the 48 set would not raise games/day, since calcs aren't the bound.

### Autocast against fp32

`converge.py`: 300 PPO steps at minibatch 256 on 8 fixed synthetic minibatches, cycled, from the same init, so the loss falls as the net memorizes them. A second fp32 run from another init seed shows how far two fp32 runs drift apart (`runs/converge.json`, `runs/checks.log`).

| Size | fp32 loss, step 1 → mean of last 50 | fp16 last 50 | bf16 last 50 | fp32, other seed, last 50 | Mean relative gap to fp32, last 50: fp16 / bf16 / other seed |
|---|---|---|---|---|---|
| 3M | 2.345 → 0.825 | 0.835 | 0.823 | 0.874 | 1.2% / 0.6% / 6.1% |
| 5M | 2.283 → 0.497 | 0.493 | 0.487 | 0.515 | 1.4% / 2.0% / 3.9% |
| 9M | 2.319 → 0.145 | 0.137 | 0.154 | 0.165 | 7.5% / 14.6% / 25.4% |

Every loss was finite. In every size, autocast's gap to fp32 is smaller than the gap between two fp32 seeds, so autocast doesn't diverge. The 9M net memorizes the data to a loss near 0.01 on some steps, where relative gaps are large: its largest single-step gaps (bf16 2.9×, other seed 3.3×) are both at step 286, where fp32's loss is 0.008.

### Other findings

- **No CPU fallback needed:** every op ran on MPS in all three dtypes (SDPA with a boolean mask, RMSNorm, embeddings, the losses, AdamW, `GradScaler`).
- **`torch.compile`** of the 5M net sped training up 14% (2,504 against 2,187 decisions/s, bf16, 1024), in one 10-step probe with a 7 s compile. It is not in the tables. It's a lever for Phase 1's learner, unverified on the full net.
- **Memory:** the 5M net at minibatch 2048 used 14 GB of GPU driver memory under bf16 and 20 GB in fp32, and the 9M 21 and 28 GB, on a 36 GB machine.

### Limits

- **A stand-in:** synthetic inputs, a guessed feature width, and one MLP shared by every token type. Jaxcalibur used separate MLP weights per token type (prior-work.md), which adds parameters but not FLOPs per token, so its 8.5M isn't directly comparable to the 9M here.
- **Not timed:** rollout storage, GAE, moving rollouts to the GPU, and passing observations between processes. Inference times include the host-to-GPU copies, but within one process.
- **Short runs:** each configuration ran a few seconds, and each run about 6 minutes. On a laptop, days of sustained load may throttle, which wasn't measured.
- **Snapshot inference** is assumed to cost the same as the latest policy's. Holding several snapshots on the GPU adds memory, not time.

### Proposals

**v0 net size: 5M parameters** (d=256, 5 layers, ~1.1M of them in embeddings and heads), trained and run under bf16 autocast.

- On the M4 Max, games/day falls in proportion to FLOPs, since the learner is the bound: per 5M game, the 3M net plays 1.45× as many and the 9M 0.56×.
- At 3 epochs the 5M net gives ~1.0–1.3M games/day at human game lengths. A Phase 2 run of a few million games then takes days, not weeks.
- The #1 bots used 3–8.7M (prior-work.md). Jaxcalibur found smaller nets trained longer beat larger ones, which argues against 9M on a learner-bound machine. NatDex's larger content (species, items, Megas, Z-Moves) sits in embedding tables, which add parameters but almost no FLOPs. So a 5M net keeps a 3.95M trunk.
- bf16 over fp32: 12–16% faster, and it tracked fp32 within the seed-to-seed gap. Over fp16: as fast and needs no loss scaling.
- Fallback: the 3M net, or fewer tokens (53 tokens gives the same speedup), if Phase 2's games/day falls short.

**D9's threshold:** the M4 Max isn't enough when the next planned run needs more than 14 days on it, at the games/day the current pipeline measures. Until Phase 1's walking skeleton and learner measure their own, that is S4's ~1M games/day for the 5M net at 3 epochs, so runs above ~14M games.

- Why wall time: the bound is the learner's GPU, so renting buys time, not feasibility. Two weeks keeps a run inside one Showdown re-pin (monthly, plan.md) with room to look at results. It also means one run at a time can't hold the machine for most of a month.
- What it gives: Phase 2's PPO v0 runs stay on the M4 Max unless they grow past ~14M games. Phase 3's 30–50M games (30–50 days here) are rented, as plan.md already plans.
- The user may prefer another wall-time limit. At ~1M games/day, 7 days means ~7M games and 28 days ~28M.

### Acceptance checks

- **No CPU fallback:** passed. Every MPS run here and in the rerun completed with `PYTORCH_ENABLE_MPS_FALLBACK` unset.
- **Autocast tracks fp32:** passed. Every fp16 and bf16 loss over 300 steps was finite, and each one's gap to fp32 was smaller than the gap between two fp32 seeds (Autocast against fp32).
- **Rerun from a clean checkout:** passed. A fresh clone of 17c2742 with its own `uv sync --locked` ran `bench.py` three times under the lock from 17:37 to 17:53 (load 0.7–5.1). `summarize.py runs/2026-11-25.jsonl runs/2026-11-25-clean-rerun.jsonl` exits 0: all 132 medians within 2.7% of the reported ones.

## Outputs

Setup: `uv sync --locked` (AGENTS.md, Conventions); no Showdown build is needed. From this folder, with `PYTORCH_ENABLE_MPS_FALLBACK` unset:

```bash
./timed.sh zsh -c 'for i in 1 2 3; do uv run python bench.py runs/<date>.jsonl all || exit 1; done' > runs/<date>.log 2>&1    # ~17 minutes
```

```bash
uv run python summarize.py runs/2026-11-25.jsonl                          # the tables and games/day above
```

```bash
uv run python summarize.py runs/2026-11-25.jsonl runs/<rerun>.jsonl       # exit 0 if every rerun median is within 10%
```

```bash
./timed.sh zsh -c 'uv run python converge.py runs/converge.json && uv run python contend.py runs/contend.jsonl 5M bf16 20 3' > runs/checks.log 2>&1    # ~16 minutes
```

```bash
uv run python flops.py      # FLOPs per decision
```

```bash
uv run python net.py        # sizes and parameter counts
```

`timed.sh` is T02's, with T07 as the lock owner: it takes the timing lock of the repository the current directory is in. To time a separate clone under the shared lock, run it from here with the clone's paths, as the clean rerun did: `./timed.sh zsh -c "cd <clone>/tasks/T07-mps-throughput && for i in 1 2 3; do uv run python bench.py rerun.jsonl all || exit 1; done"`.

| File | What it is |
|---|---|
| `net.py` | The stand-in net, its sizes, synthetic observations and rollouts, the PPO loss and one training step (`Trainer`) |
| `bench.py` | `bench.py <out.jsonl> [mps\|cpu\|all] [seconds=2]`: one run, appending a JSON line per configuration with samples/s and the load averages before and after |
| `summarize.py` | Median (min–max) tables and games/day from one or more runs (comma-separated), or a 10% rerun check against a second file |
| `converge.py` | Autocast against fp32 over 300 steps; `runs/converge.json` holds every loss curve |
| `contend.py` | Inference and training sharing the GPU, with and without 13 CPU-spinning processes |
| `flops.py` | FLOPs per decision from `FlopCounterMode` |
| `runs/2026-11-25.jsonl`, `.log` | The three reported runs |
| `runs/2026-11-25-clean-rerun.jsonl`, `.log` | The three runs from a fresh clone (Acceptance checks) |
| `runs/converge.json`, `runs/contend.jsonl`, `runs/checks.log` | The autocast and contention checks |

## For integration

Proposed edits. The two proposals need the user's OK first; the Compute and D7 edits record measurements and don't.

**plan.md, Compute:** replace the M4 Max bullet and its three sub-bullets with:

```markdown
- **M4 Max** (S4: T07, 2026-11-25, torch 2.15.0, M4 Max with a 32-core GPU and 36 GB), on a stand-in for Network v0 with 77 tokens:
  - The 5M net (3.95M of it in the trunk) costs 1.96 GFLOP per decision per PPO epoch. Under bf16 autocast it trains at ~2,160 decisions/s per epoch at minibatch 1024 (1,940 in fp32) and infers at ~11,300/s at batch 256 on MPS: ~4.2 and ~7.3 TFLOP/s. The 3M net is ~1.45× as fast and the 9M ~0.56×. bf16 tracked fp32; fp16 is no faster and needs loss scaling.
  - With inference on MPS for every decision and 75% of decisions trained (half of games are against frozen snapshots: Training v0, League), the 5M net at 3 PPO epochs gives the learner ~890 decisions/s. That is ~0.7M games/day at random games' length and ~1.0–1.3M at T04's human lengths. Inference and training sharing the GPU cost the sum of their times, and a fully loaded CPU cut that by ~3%.
  - The learner bounds the M4 Max. Sim plus the cached 288 calcs (~0.81 ms per decision per process, T02 and T06) give ~16k env decisions/s on 13 processes, ~18× the learner. Python parsing and transfer would have to cost ~14 ms per decision per process to change that, and ~6.5 ms to trip D7's 2× builder rule.
```

**decisions.md, D7** (v0 carries all 288 calcs): replace "On the M4 Max the learner likely bounds throughput (planning estimate, ~500–700 decisions/s: plan.md, Compute)" with:

```markdown
On the M4 Max the learner bounds throughput: S4 measured ~890 learner decisions/s against ~16k env decisions/s from the sim and cached calcs (plan.md, Compute)
```

**If the user approves the net size, plan.md, Network v0:** replace "- **Size:** 3–9M params, pre-RMSNorm, about 45–80 tokens." with:

```markdown
- **Size:** 5M params (d=256, 5 layers; ~1.1M of them in embeddings, input projections and heads), pre-RMSNorm, about 45–80 tokens, trained and run under bf16 autocast (S4: T07). On the M4 Max throughput tracks FLOPs, so tokens cost as much as size: 53 tokens instead of 77 train 1.35× as fast.
```

**If the user approves the threshold, decisions.md, D9:** replace "**Open:** the threshold for "isn't enough". S4 proposes one (plan.md, Phase 0)." with:

```markdown
**Threshold (decided <date>):** the M4 Max isn't enough when the next planned run needs more than 14 days on it, at the games/day the current pipeline measures. Until Phase 1 measures its own, that is S4's ~1M games/day for the 5M net at 3 epochs (plan.md, Compute), so runs above ~14M games. Phase 2's runs stay on the M4 Max below that, and Phase 3's 30–50M games are rented.
```
