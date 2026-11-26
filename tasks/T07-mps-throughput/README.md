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

2026-11-25, reviewed:

```text
State: done
Verified: Acceptance checks (Result), torch 2.15.0; benchmark code unchanged since a1f9e30
Pending: the user's OK on the net size, D9's threshold and the token-count question (For integration)
Next: planning session (workflow.md, Stage 1)
Reviewed: user, passes 1 and 2 (2026-11-25), fixes in 3f2c105, c5c940f, f47b622 and this commit; delta pass on f47b622 (Sonnet)
```

2026-11-25, done:

```text
State: done
Verified: Acceptance checks (Result), torch 2.15.0; benchmark code unchanged since a1f9e30
Pending: the user's review; the Reviewed: line
Next: review; the net size and D9's threshold need the user's OK
```

2026-11-25, claim:

```text
State: active
Verified: torch 2.15.0, Python 3.14.7, MPS available (M4 Max, 32-core GPU, 36 GB)
Pending: everything
Next: write the stand-in net and benchmark
```

## Result

Superseded in part, 2026-11-26: D7 no longer has a builder rule, so of the parsing bounds below only "the env becomes the bound" (~5.4 ms at 33 tokens) still applies (plan.md, Compute). The user set D9's threshold at 7 days, not the 14 proposed below. The token-layout follow-up is in `tokens/`.

**Proposals for the user:**
- A 5M v0 net, trained and run under bf16 autocast.
- For D9: the M4 Max "isn't enough" when the next planned run needs more than 14 days on it, at the games/day the current pipeline measures.

Both are argued under Proposals.

**The learner, not the env, bounds the M4 Max.** How much it leads depends on a question plan.md leaves open. Network v0's token list gives 33 tokens, but its Size line says 45–80, and the learner's cost scales with the token count:
- **At 33 tokens:** the 5M net gives an estimated ~1,900 learner decisions/s at 3 epochs, about 2M games/day at 35-turn games. The env has ~7× that. **D7's 2× builder rule trips once Python parsing and transfer cost ~2.2 ms per decision per process.** Parsing cost is unmeasured until Phase 1's walking skeleton, so whether it gets that high is open.
- **At 77 tokens:** ~820 learner decisions/s, ~0.9M games/day. The margin is ~16×, and the builder rule trips at ~6.4 ms.

No stop condition was hit.

All timings: 2026-11-25, torch 2.15.0, Python 3.14.7, MacBook Pro (Mac16,5) M4 Max with a 32-core GPU and 36 GB, on mains power. `PYTORCH_ENABLE_MPS_FALLBACK` was unset, which `bench.py` asserts. Each figure comes from three runs of `bench.py`, each a fresh process, back to back under the timing lock:
- 77 and 53 tokens: 17:02–17:19, 1-minute load averages 0.5–2.2 (`runs/2026-11-25.log`).
- 33 tokens: 18:26–18:37, load 0.9–3.0 (`runs/2026-11-25-33tok.log`).

### Stand-in net

`net.py` builds Network v0's tokens, trunk and heads from plan.md, fed synthetic inputs, in three token layouts:

- **33 tokens, plan.md's token list as written:** field (1), own mons (6), opposing mons (6), the active mon's moves (4), the last 16 events.
- **77 tokens:** every own and opposing mon's moves as tokens (24 + 24) instead of the active mon's 4. This matches the ~80 tokens behind plan.md's FLOP estimate and the top of its "45–80 tokens".
- **53 tokens:** the 77 without the opposing moves (5M only).

The rest is the same in every layout:

- **Tokens:**
  - **Mon tokens** are built from species, item, ability and four move embeddings, 64 wide, plus 128 numeric features, which include the mon's 24 damage calcs. The vocabularies are gen9nationaldex's sizes at the pin, from T06.
  - **Move tokens** carry a move embedding plus 48 dex features.
  - **Event tokens** carry three embeddings plus 16 features.
  - About 10% of the non-mon tokens are masked out of attention, standing in for empty event slots.
- **Trunk:** a pre-RMSNorm transformer with 64-wide heads, a GELU MLP 4× wide, and one set of weights shared by all token types.
- **Heads:**
  - **Acting:** 18 masked action logits and a value. The logits are 4 moves × {plain, Mega, Z}, read from the active mon's move tokens, plus a switch per team slot.
  - **Training only:** aux heads on the 6 opposing mon tokens (moves, item, ability, spread bucket), plus the opponent's next action.
  - The heads run in fp32 under autocast, because masking with −inf and log-softmax overflow in fp16.
- **Loss:** PPO's clipped surrogate, value MSE, entropy, KL(uniform‖π) over legal actions (D10), and the aux losses. A step is forward, backward, a grad-norm clip at 1.0, and AdamW. fp16 adds a `GradScaler`, which bf16 doesn't need.

| Size | d | Layers | Params | Trunk params | Tokens | Inference GFLOP per decision | Training GFLOP per decision per epoch |
|---|---|---|---|---|---|---|---|
| 3M | 192 | 5 | 3.09M | 2.22M | 77 | 0.369 | 1.132 |
| 5M | 256 | 5 | 5.06M | 3.95M | 77 | 0.644 | 1.963 |
| 9M | 320 | 6 | 8.76M | 7.39M | 77 | 1.191 | 3.616 |
| 5M@53 | 256 | 5 | 5.05M | 3.95M | 53 | 0.438 | 1.337 |
| 3M@33 | 192 | 5 | 3.09M | 2.22M | 33 | 0.154 | 0.477 |
| 5M@33 | 256 | 5 | 5.05M | 3.95M | 33 | 0.271 | 0.831 |
| 9M@33 | 320 | 6 | 8.74M | 7.39M | 33 | 0.502 | 1.530 |

Each net has 0.9–1.4M parameters (1.1M in the 5M) in embedding tables, input projections and heads, which cost few FLOPs.

**FLOP check:** `flops.py` counts the matmuls and attention with torch's `FlopCounterMode`, which leaves out elementwise ops.
- **The 5M net costs 1.96 GFLOP per decision step per PPO epoch at 77 tokens and 0.83 at 33** (forward + backward), against plan.md's ~2.4.
- The plan's figure is 6 × 5M params × 80 tokens. Here only the 3.95M trunk parameters act on every token (6 × 3.95M × 77 = 1.82 GFLOP). Attention scores, input projections and heads add the rest.
- At the measured rates, MPS sustains ~4.2 TFLOP/s training the 5M net under bf16 at either token count (3.8 at 77 in fp32), within the plan's assumed 4–6. Inference reaches 6.3 TFLOP/s at 33 tokens and 7.3 at 77.

### Throughput

Median (min–max) over 3 runs. Each configuration ran 3 untimed steps first, because MPS builds its graphs on a new shape. It then ran timed steps for at least 2 s and at least 5 steps, with the GPU synchronized before the first timed step and after every step from the fifth.

- **MPS inference** includes copying the batch to the GPU and the logits and value back, as an inference server would. It uses the policy and value heads only.
- **MPS training** times one PPO minibatch step on data already on the GPU. Minibatches stop at 1024: in an unlogged trial run, the 9M net in fp32 at 2048 pushed the machine into swap.
- **CPU inference** runs in fp32 with `torch.set_num_threads` at 1, 2 and 4 and one interop thread, as an env process would set it. The batch sizes are those one env process would send: up to 64, for 32 battles with two players.

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
| 3M@33 | 16 | 6,984 (6,973–7,088) | 6,345 (6,283–6,452) | 6,226 (6,224–6,269) |
| 3M@33 | 64 | 18,095 (18,082–18,132) | 17,757 (17,607–17,890) | 17,521 (17,506–17,614) |
| 3M@33 | 256 | 29,407 (29,358–29,444) | 33,088 (33,036–33,151) | 32,774 (32,746–32,790) |
| 3M@33 | 1024 | 24,149 (23,489–24,197) | 31,682 (31,634–31,941) | 31,479 (31,432–31,693) |
| 5M@33 | 16 | 6,112 (6,085–6,165) | 5,587 (5,562–5,593) | 5,570 (5,567–5,610) |
| 5M@33 | 64 | 13,887 (13,879–13,891) | 14,015 (14,001–14,119) | 13,974 (13,925–13,990) |
| 5M@33 | 256 | 20,436 (20,401–20,468) | 23,437 (23,436–23,455) | 23,358 (23,351–23,402) |
| 5M@33 | 1024 | 16,355 (16,351–16,380) | 21,401 (21,395–21,477) | 21,422 (21,402–21,463) |
| 9M@33 | 16 | 4,780 (4,603–4,823) | 4,425 (4,359–4,449) | 4,428 (4,420–4,432) |
| 9M@33 | 64 | 9,452 (9,266–9,469) | 9,647 (9,158–9,652) | 9,618 (9,571–9,705) |
| 9M@33 | 256 | 12,094 (12,065–12,411) | 14,373 (14,006–14,402) | 14,351 (14,324–14,405) |
| 9M@33 | 1024 | 9,847 (9,816–9,954) | 12,961 (12,912–12,986) | 12,985 (12,977–12,986) |

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
| 3M@33 | 256 | 7,034 (7,029–7,063) | 5,575 (5,551–5,586) | 7,133 (7,084–7,149) |
| 3M@33 | 512 | 7,380 (7,370–7,404) | 6,644 (6,632–6,654) | 7,622 (7,618–7,657) |
| 3M@33 | 1024 | 6,532 (6,528–6,562) | 6,781 (6,779–6,793) | 7,270 (7,266–7,298) |
| 5M@33 | 256 | 5,068 (5,064–5,090) | 4,278 (4,254–4,288) | 5,237 (5,211–5,250) |
| 5M@33 | 512 | 5,188 (5,176–5,190) | 4,841 (4,827–4,846) | 5,414 (5,408–5,423) |
| 5M@33 | 1024 | 4,514 (4,505–4,525) | 4,767 (4,764–4,773) | 5,046 (4,987–5,065) |
| 9M@33 | 256 | 3,062 (3,062–3,113) | 2,791 (2,790–2,793) | 3,261 (3,255–3,262) |
| 9M@33 | 512 | 3,076 (3,050–3,141) | 3,056 (3,041–3,066) | 3,336 (3,328–3,341) |
| 9M@33 | 1024 | 2,731 (2,705–2,751) | 2,965 (2,962–2,968) | 3,094 (3,093–3,095) |

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
| 3M@33 | 1 | 1,238 (1,232–1,245) | 1,121 (1,113–1,131) | 1,167 (1,167–1,178) |
| 3M@33 | 8 | 2,781 (2,763–2,797) | 2,705 (2,693–2,706) | 2,814 (2,800–2,814) |
| 3M@33 | 32 | 3,376 (3,374–3,383) | 4,328 (4,223–4,355) | 5,390 (5,229–5,393) |
| 3M@33 | 64 | 3,482 (3,478–3,485) | 4,910 (4,842–4,926) | 6,246 (6,212–6,338) |
| 5M@33 | 1 | 878 (876–880) | 783 (779–791) | 789 (787–789) |
| 5M@33 | 8 | 1,901 (1,895–1,907) | 1,962 (1,957–1,962) | 2,050 (2,048–2,061) |
| 5M@33 | 32 | 2,381 (2,343–2,428) | 3,101 (3,089–3,124) | 3,910 (3,897–3,956) |
| 5M@33 | 64 | 2,554 (2,523–2,566) | 3,625 (3,586–3,626) | 4,468 (4,464–4,471) |
| 9M@33 | 1 | 578 (576–579) | 540 (539–542) | 545 (545–551) |
| 9M@33 | 8 | 1,301 (1,297–1,320) | 1,422 (1,412–1,440) | 1,530 (1,501–1,537) |
| 9M@33 | 32 | 1,614 (1,594–1,620) | 2,128 (2,112–2,134) | 2,674 (2,673–2,678) |
| 9M@33 | 64 | 1,666 (1,652–1,672) | 2,303 (2,301–2,339) | 2,929 (2,915–2,931) |

Readings:

- **Autocast:** bf16 is faster than fp32 for the 5M net at both token counts, by how much depending on the minibatch.
  - Training at minibatch 1024: +12% (2,163 against 1,936 at 77 tokens, 5,046 against 4,514 at 33). But fp32 slows at 1024 and bf16 doesn't. At each dtype's fastest minibatch, bf16 is only 3–4% ahead (2,268 against 2,200 at 256 for 77 tokens, 5,414 against 5,188 at 512 for 33).
  - Inference at batch 256: +16% and +14%. At batch 16, bf16 is 3–9% slower.
  - In the learner model, each at its fastest minibatch, bf16 gives 4–5% more decisions/s (860 against 826 at 77 tokens, 2,029 against 1,927 at 33).
  - fp16 is no faster than bf16, needs a `GradScaler`, and is slower than fp32 at minibatch 256.
  - The 9M net gains least at 77 tokens: 3% under bf16.
- **Batch size:**
  - MPS inference peaks at batch 256. One env process's batch (64) reaches 68–83% of that peak for the 3M and 5M nets at 77 tokens, and 53–68% at 33. So an inference server batching across env processes at 256 gains about 20–90% over each process sending its own.
  - Training is flat from 512 to 1024 at 77 tokens. At 33 tokens, 1024 is 5–13% below 512 in fp32 and bf16. At 77 tokens, 256 is the fastest minibatch for most configurations.
- **Size:** throughput falls with FLOPs, though not in proportion. Against the 5M net under bf16 at minibatch 1024:

  | Net | FLOPs (77 tokens) | Throughput, 77 tokens | Throughput, 33 tokens |
  |---|---|---|---|
  | 3M | 0.58× | 1.44× | 1.44× |
  | 9M | 1.84× | 0.56× | 0.61× |

- **Tokens:** going from 77 to 33 tokens cuts the 5M net's FLOPs 2.36×. It then trains 2.33× as fast (5,046 against 2,163) and infers 2.07× as fast. The token count moves throughput more than the size range does: the 9M net at 33 tokens trains faster than the 5M at 77.
- **CPU inference** of the 5M net at batch 64 on one thread costs 0.96 ms per decision at 77 tokens and 0.39 at 33. Those are rates for one process alone. This torch build runs CPU matmuls through Apple's Accelerate (`BLAS_INFO=accelerate`). Accelerate likely uses the chip's shared matrix units, so processes compete for them, and the scaling below is consistent with that. In `cpu_scale.py` (`runs/cpu-scale.log`), 12 processes running 1-thread inference at once totalled only ~8.9k decisions/s at 33 tokens and ~3.75k at 77. That is 3.3–3.5× slower per process than one process alone.

### Learner and env

**The learner's decisions/s per PPO epoch** at minibatch 1024 is the training rate. **For the 5M net under bf16 that is 5,046 at 33 tokens and 2,163 at 77.** At 33 tokens, minibatch 512 trains 5–15% faster than 1024 (Readings), so the 33-token rates below are that much conservative.

**The learner model** (`summarize.py` computes every figure below):
- **GPU time per decision** = MPS inference for every decision + 0.75 × epochs × training time per decision.
  - 0.75 is the share of decisions trained. Half of games are against the latest policy, where both sides train, and half against frozen snapshots, where one side does. The snapshot side's inference costs the same as the learner's.
  - Inference runs at batch 256 and training at minibatch 1024.
- **CPU load:** the learner's rate is cut 7%, the loss training showed with the CPU loaded (Shared GPU, below).
- **Epochs:** Training v0 fixes no epoch count. Headline figures use 3, the low end of plan.md's planning estimate (3–4 PPO epochs). At 4 epochs the learner is 23% slower at 33 tokens, and every figure built on it moves with it.
- **Decisions per game:** T02's 2.29 decisions per turn. That gives 112 at random games' 48.9 turns, and 57 and 80 at T04's human 25 and 35 turns (plan.md, Compute). Self-play lengths are unmeasured.

The table shows selected rows. `uv run python summarize.py runs/2026-11-25.jsonl,runs/2026-11-25-33tok.jsonl` prints every size, both dtypes and 2–4 epochs. The last three columns use the env model under Env CPU budget.

| Size | dtype | Epochs | Learner decisions/s | Games/day, T02 random games (112 decisions) | Games/day, T04 human, 25 turns (57 decisions) | Games/day, T04 human, 35 turns (80 decisions) | Env / learner | Parsing + transfer ms to bound | ... to trip D7's 2x rule |
|---|---|---|---|---|---|---|---|---|---|
| 3M | bf16 | 3 | 1,192 | 0.92M | 1.80M | 1.29M | 11.0x | 9.1 | 4.1 |
| 5M | bf16 | 2 | 1,189 | 0.92M | 1.79M | 1.28M | 11.0x | 9.2 | 4.1 |
| 5M | bf16 | 3 | 824 | 0.64M | 1.24M | 0.89M | 15.9x | 13.6 | 6.4 |
| 5M | bf16 | 4 | 630 | 0.49M | 0.95M | 0.68M | 20.8x | 18.1 | 8.6 |
| 9M | bf16 | 3 | 462 | 0.36M | 0.70M | 0.50M | 28.3x | 25.1 | 12.1 |
| 3M@33 | bf16 | 2 | 3,927 | 3.03M | 5.93M | 4.23M | 3.3x | 2.1 | 0.6 |
| 3M@33 | bf16 | 3 | 2,735 | 2.11M | 4.13M | 2.95M | 4.8x | 3.5 | 1.3 |
| 5M@33 | fp32 | 3 | 1,699 | 1.31M | 2.56M | 1.83M | 7.7x | 6.1 | 2.6 |
| 5M@33 | bf16 | 2 | 2,735 | 2.11M | 4.13M | 2.95M | 4.8x | 3.5 | 1.3 |
| 5M@33 | bf16 | 3 | 1,903 | 1.47M | 2.87M | 2.05M | 6.9x | 5.4 | 2.2 |
| 5M@33 | bf16 | 4 | 1,459 | 1.13M | 2.20M | 1.57M | 9.0x | 7.3 | 3.2 |
| 9M@33 | bf16 | 3 | 1,167 | 0.90M | 1.76M | 1.26M | 11.2x | 9.4 | 4.2 |

**Shared GPU** (`contend.py`; 5M net, 77 tokens, bf16; three 20 s windows per scenario; `runs/contend.jsonl`):
- **Inference and training together:** run at the same time in separate processes, each kept 60% and 46% of its rate alone (medians). Those shares sum to 1.06 of the GPU, so summing their times, as the model does, is about right.
- **With the CPU loaded:** 13 more processes spinning on the CPU stood in for env workers. Training alone lost 7% (1,969 against 2,124 decisions/s), and training is ~92% of the learner's GPU time. With inference running too, the shares summed to 0.97.
- **So the model takes off 7%.** That is probably a lower bound: Python spin loops don't load memory bandwidth or caches the way Node sims and calcs would.

**Env CPU budget** on the same machine, per decision per process. With MPS inference there are 12 env processes, since the learner and the inference server take a core each. With CPU inference there are 13.

| Work | ms per decision | Source |
|---|---|---|
| Sim, `Battle` direct, slowed by interleaved calcs | 0.38 | T02 at 14 processes (0.28), × T06's 1.37 slowdown with calcs between sim steps. T06 ran four calc passes per decision, so this likely overstates the sim's cost |
| 288 calc set, cached | 0.53 | T06, one process |
| 48 calc set, cached | 0.25 | T06, one process |
| CPU inference, 5M fp32, batch 64, 1 thread, one process alone | 0.39 (33 tokens), 0.96 (77) | this task. 3.3–3.5× more with 12 processes (Readings) |

- **MPS inference, 288 calcs:** 12 processes / 0.92 ms (0.38 + 0.53, unrounded) ≈ 13k env decisions/s.
  - For the 5M net under bf16 at 3 epochs, that is **6.9× the learner at 33 tokens (1,903) and 15.9× at 77 (824).**
  - T06 timed calcs in one process only. If they slow under load as T02's sim did (×1.52, to 0.81 ms), the env does 10k decisions/s: 5.3× and 12×.
- **CPU inference, 288 calcs:** the learner then only trains, at 2,090 decisions/s at 33 tokens and 895 at 77, 9–10% faster.
  - The shared matrix units cap CPU inference at ~8.9k and ~3.75k decisions/s across 12 processes (`cpu_scale.py`), before the sim and calcs compete for the same cores.
  - So the env gets at most ~4.3× and ~4.2× the learner: a worse margin than with MPS inference at either token count. A real CPU-inference setup would need its own multi-process measurement.
- **What would change it:** per-decision Python parsing and transfer (unmeasured until Phase 1's walking skeleton) add to the env's 0.92 ms. For the 5M net, bf16, 3 epochs and MPS inference:
  - **D7's builder rule** ("reopens if the env's decisions/s ... falls below ~2× the learner's") trips at **~2.2 ms per decision per process at 33 tokens** and ~6.4 ms at 77.
  - **The env becomes the bound** at ~5.4 ms and ~13.6 ms.
  - Faster learner settings shrink these margins. The 3M net at 33 tokens and 2 epochs trips the builder rule at 0.6 ms.
- **For D7's calc revisit trigger:** S4 finds the learner bounds the M4 Max, so the trigger's first condition can only come from Phase 1's walking skeleton. Cutting calcs to the 48 set would save 0.28 ms per decision. That matters only if parsing lands near the figures above.

### Autocast against fp32

`converge.py` (77 tokens): 300 PPO steps at minibatch 256 on 8 fixed synthetic minibatches, cycled, all from the same init. The loss falls as the net memorizes them. A second fp32 run from another init seed is the reference for how far two fp32 runs drift apart. That is a loose bar, so the absolute gaps are given too (`runs/converge.json`, `runs/checks.log`).

| Size | fp32 loss: step 1 → mean of last 50 | fp16, last 50 | bf16, last 50 | fp32, other seed, last 50 | Mean absolute gap to fp32 over the last 50 steps: fp16 / bf16 / other seed |
|---|---|---|---|---|---|
| 3M | 2.345 → 0.825 | 0.835 | 0.823 | 0.874 | 0.010 / 0.005 / 0.049 |
| 5M | 2.283 → 0.497 | 0.493 | 0.487 | 0.515 | 0.007 / 0.010 / 0.019 |
| 9M | 2.319 → 0.145 | 0.137 | 0.154 | 0.165 | 0.008 / 0.009 / 0.020 |

- Every loss was finite.
- **Autocast's gaps to fp32 are under 0.5% of the starting loss**, and smaller than the gap between seeds, so autocast doesn't diverge.
- The 9M net memorizes the data down to losses near 0 on some steps, so its relative gaps are large there. Both of its largest single-step gaps (bf16 2.9×, other seed 3.3×) fall at step 287 of 300, where fp32's loss is 0.008.

### Other findings

- **No CPU fallback was needed:** every op ran on MPS in all three dtypes. That covers SDPA with a boolean mask, RMSNorm, embeddings, the losses, AdamW and `GradScaler`.
- **`torch.compile`** sped training of the 5M net at 77 tokens by ~14% in one probe (2,504 against 2,187 decisions/s, bf16, minibatch 1024). This was a single unlogged 10-step probe with a 7 s compile, so it can't be reproduced from Outputs. It's a lever for Phase 1's learner, unverified on the full net.

### Limits

- **A stand-in:** synthetic inputs, guessed feature widths, and one MLP shared by every token type. Per-type MLP weights, as in Jaxcalibur's net (prior-work.md), would add parameters but not FLOPs.
- **Not timed:**
  - rollout storage, GAE, and moving rollouts to the GPU;
  - passing observations between env and inference processes. Inference times include the copy to the GPU and back, but no inter-process transfer.
- **Short runs:** each configuration ran a few seconds. Days of sustained load on a laptop may throttle; that wasn't measured.
- **77 tokens only:** convergence and contention were checked at 77 tokens, not 33.
- **Snapshot inference** is assumed to cost the same as the latest policy's. Several snapshots split the inference batches, and batch 64's throughput is 17–47% below batch 256's. Inference is ~9% of the learner's GPU time, so this costs up to ~4–8%.

### Proposals

**v0 net size: 5M parameters** (d=256, 5 layers, ~1.1M of them in embeddings, input projections and heads), trained and run under bf16 autocast.

- **The measurements price each size, they don't pick one.** On a learner-bound M4 Max, games/day falls with FLOPs. Per 5M-net game, the 3M net plays ~1.45× as many and the 9M ~0.6×. On cost alone, 3M wins.
- **Why 5M over 3M is a judgment call:** the #1 bots used 3–8.7M parameters (prior-work.md). The 3M one (MissingNo) played random battles, with no team preview and no hidden sets from a pool. NatDex OU with hidden sets and five aux heads asks more of the net. Jaxcalibur found smaller nets trained longer beat larger ones, which argues against 9M on a learner-bound machine. Neither point was measured here.
- **It depends on the token count:** at 33 tokens the 5M net gives ~2M games/day (35-turn games). If v0 uses ~77 tokens, the 3M net (~1.3M) keeps games/day closer to that than the 5M (~0.9M).
- **NatDex content:** NatDex has more species, items, Megas and Z-Moves, but these mostly add embedding rows. Those cost parameters and almost no FLOPs, so the trunk keeps most of the 5M: 3.95M in the stand-in. That rests on the stand-in's guessed embedding widths, an assumption.
- **bf16:** never slower than fp32 for training. It is 4–5% faster in the learner model, each dtype at its fastest minibatch, and 14–16% faster in inference. Its loss tracked fp32's within the seed-to-seed gap. It is as fast as fp16 and needs no loss scaling.
- **Fallback:** the 3M net, if a Phase 2 run would pass D9's threshold below.
- **The token count is the larger lever.** It needs a planning decision (For integration).

**D9's threshold:** the M4 Max isn't enough when the next planned run needs more than 14 days on it, at the games/day the current pipeline measures.

- **What that means now:** until Phase 1's walking skeleton and learner measure their own figures, use S4's estimate for the 5M net at bf16 and 3 epochs, at 35-turn games: ~2.05M games/day at 33 tokens and ~0.89M at 77. That makes the threshold about 29M and 12M games.
- **Why wall time:** the learner's GPU is the bound, so renting buys time, not feasibility. Two weeks fits a run inside one monthly Showdown re-pin (plan.md, Versioning), with room to look at the results.
- **What it gives:**
  - Phase 2's PPO v0 runs stay on the M4 Max below that. plan.md gives no Phase 2 game count.
  - Phase 3's 30–50M games would take 15–24 days at 33 tokens and 34–56 at 77, so Phase 3 is rented at either token count, at 33 tokens by a small margin.

### Acceptance checks

- **No CPU fallback:** passed (Other findings), in every run and rerun.
- **Autocast tracks fp32:** passed (Autocast against fp32).
- **Rerun from a clean checkout:** passed for both runs.
  - A fresh clone of 17c2742, with its own `uv sync --locked`, ran `bench.py` three times under the lock, 17:37–17:53, load 0.7–5.1. `summarize.py runs/2026-11-25.jsonl runs/2026-11-25-clean-rerun.jsonl` exits 0: all 132 medians are within 2.7%. a1f9e30's later changes to `net.py` and `bench.py` only add sizes and a size filter, leaving these sizes' code unchanged.
  - For the 33-token sizes, a fresh clone of a1f9e30 ran 18:37–18:48, load 0.8–2.7. `summarize.py runs/2026-11-25-33tok.jsonl runs/2026-11-25-33tok-clean-rerun.jsonl` exits 0: all 99 medians are within 4.3%.

## Outputs

Setup: `uv sync --locked` (AGENTS.md, Conventions); no Showdown build is needed. Run everything from this folder, with `PYTORCH_ENABLE_MPS_FALLBACK` unset.

The benchmark runs. Three runs take about 17 minutes for the 77- and 53-token sizes and 11 for the 33-token sizes:

```bash
./timed.sh zsh -c 'for i in 1 2 3; do uv run python bench.py runs/<date>.jsonl all 2 3M,5M,9M,5M@53 || exit 1; done' > runs/<date>.log 2>&1
```

```bash
./timed.sh zsh -c 'for i in 1 2 3; do uv run python bench.py runs/<date>-33tok.jsonl all 2 3M@33,5M@33,9M@33 || exit 1; done' > runs/<date>-33tok.log 2>&1
```

The tables, games/day and env model above:

```bash
uv run python summarize.py runs/2026-11-25.jsonl,runs/2026-11-25-33tok.jsonl
```

A rerun check, which exits 0 if every rerun median is within 10% of the reference:

```bash
uv run python summarize.py runs/2026-11-25.jsonl runs/<rerun>.jsonl
```

The convergence and contention checks, about 16 minutes:

```bash
./timed.sh zsh -c 'uv run python converge.py runs/converge.json && uv run python contend.py runs/contend.jsonl 5M bf16 20 3' > runs/checks.log 2>&1
```

FLOPs per decision, then sizes and parameter counts:

```bash
uv run python flops.py
```

```bash
uv run python net.py
```

`timed.sh` is T02's, with T07 as the lock owner. It takes the timing lock of the repository the current directory is in. To time a separate clone under the shared lock, run it from here with the clone's paths, as the clean reruns did:

```bash
./timed.sh zsh -c "cd <clone>/tasks/T07-mps-throughput && for i in 1 2 3; do uv run python bench.py rerun.jsonl all || exit 1; done"
```

| File | What it is |
|---|---|
| `net.py` | The stand-in net, its sizes and token layouts, synthetic observations and rollouts, the PPO loss, and one training step (`Trainer`) |
| `bench.py` | `bench.py <out.jsonl> [mps\|cpu\|all] [seconds=2] [sizes]`: one run. It appends a JSON line per configuration with samples/s and the load averages before and after |
| `summarize.py` | Median (min–max) tables, games/day and the env model, from one or more runs (comma-separated). Given a second file, it runs the 10% rerun check against it instead |
| `converge.py` | Autocast against fp32 over 300 steps. `runs/converge.json` holds every loss curve |
| `contend.py` | Inference and training sharing the GPU, with and without 13 CPU-spinning processes |
| `flops.py` | FLOPs per decision, from `FlopCounterMode` |
| `cpu_scale.py` | CPU inference with 1, 4, 8 and 12 processes at once (`uv run python cpu_scale.py m <size>`, under `timed.sh`); output in `runs/cpu-scale.log` |
| `runs/2026-11-25.jsonl`, `.log` | The three reported runs for the 77- and 53-token sizes |
| `runs/2026-11-25-33tok.jsonl`, `.log` | The three reported runs for the 33-token sizes. The `.log` also covers their clean rerun |
| `runs/2026-11-25-clean-rerun.jsonl`, `runs/2026-11-25-33tok-clean-rerun.jsonl` | The runs from fresh clones (Acceptance checks) |
| `runs/converge.json`, `runs/contend.jsonl`, `runs/checks.log` | The autocast and contention checks |

