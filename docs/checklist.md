# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-28 (final review of PR #12).

## Milestone

Phase 1 exit ([plan.md](plan.md), Phases).

## Next replan

When any of T10, T11, T14, T15, T16, T17, T18 or T19 has a `Reviewed:` line or stops on a stop condition (workflow.md, Task session). Once T10 is in, brief T20. Once T10, T11, T14, T16, T17 and T19 are in, brief the batch env (Later in Phase 1). Once it has merged with its calibration run, brief the v0-lite run (For the v0-lite brief).

## Needs you

- **T18's provider account:** when you want T18 to run, set up the account and payment for a rented box and give the session access from your Mac (T18, Limits).

Answered 2026-11-27: T12's usage-matched selection is accepted (decisions.md, D4); Pokémon Champions content is out of scope, since the bot plays only `gen9nationaldex` as the pin defines it; the ~$5 rented benchmark is approved (T18).

Answered 2026-11-28: the held-out filter is code in PR #12 (`loadPool`); the calibration run moves from T16 to the batch env; T10 is split into the layer (T10) and ground truth (T20); the prior-confidence feature and v0-lite's scope (resampling in, aux heads deferred) are approved.

## Active

- T15: ladder-pool write-up. [Brief](../tasks/T15-ladder-writeup/README.md). Starts on or after 2026-12-10 22:52 UTC, on your Mac. T13's hourly job collects until then; any session can check it with `tasks/T13-ladder-monitor/job.sh status`.

## Ready

All seven can start now, each in its own session (`/do-task T16` and so on). Their May change paths are disjoint. T14 and T16 both work around `worker/skeleton/`, split by file: T16 has `env.ts`, `record.ts`, `record.test.ts`, `vocab.ts`, `drive.ts` and `frames.ts`, and T14 has `main.ts`, `mask.ts` and `mask.test.ts`. T16 follows T14's game-schedule config for its own entry point.

- T16: observation, first cut (record version 2, calcs on T12's prior, the leak test, the builder's cost). [Brief](../tasks/T16-observation/README.md). Start it first: it is v0-lite's longest prerequisite. Its timed runs need your Mac.
- T19: the 5M net, on T07's 33-token format, which T16's tensorizer emits. [Brief](../tasks/T19-net-v0/README.md). Policy, value and lead heads; the aux heads wait for a labels design. Timed runs on your Mac.
- T10: tracker fix layer. [Brief](../tasks/T10-tracker-layer/README.md). Small, so it merges early; ground truth is T20 (Later in Phase 1). T16 builds on the raw client meanwhile; swapping to the layer is an import change, made when joining the parts.
- T11: PPO learner, toy checks, and the learner's rate on MPS measured, replacing T07's estimate. [Brief](../tasks/T11-learner/README.md).
- T14: baselines, eval runner and sampled mask check. [Brief](../tasks/T14-eval-baselines/README.md).
- T17: D4's set resampling. [Brief](../tasks/T17-set-resampling/README.md). Small. A v0-lite prerequisite: without it Team Preview identifies each of the 40 training teams, and the net can memorize their sets instead of reading the prior.
- T18: rented env and learner benchmark, ≤$5. [Brief](../tasks/T18-rented-env-bench/README.md). It needs you to set up the provider account and payment, and runs from your Mac.

## Later in Phase 1

Briefed once their inputs exist (plan.md, Phase 1):

- **T20: ground truth,** moved out of T10's brief on 2026-11-28 (full text at 7d169b1). Briefed once T10 is in; not a v0-lite prerequisite. Phase 1's Ground truth exit (plan.md):
  - A harness that records games (its own copy of `Game` from `worker/sim/battles.ts`, to merge back later), replays them for the sim's state, and diffs the tracked state as T08's `compare.py` does, on the fields T08 compared plus own-side PP and the sleep and toxic counters.
  - On ≥10k random-player games from new seeds (not T08's 0–499): every mismatch class with its cause (tracker bug, unsupported content, or information the player isn't shown) and count, under 0.5% of decisions with a tracker-bug or unsupported-content mismatch, and for each class tied to one mechanic, the share of decisions where that mechanic is present. Max-damage games join once T14 is in. No mismatch beyond hidden information is the bar at Phase 2's online gate, not here.
  - No throws and no message type outside the layer's allowlist on those games and on T04's 1,100 replays, with the final layer. The harness reruns from Outputs on a clean checkout with identical counts, and `tsc -p tsconfig.json` passes.
  - A scripted-scenario suite passing as tests: Wish, Healing Wish and Lunar Dance; Future Sight into a faint; two-turn moves; Transform and Imposter on both sides; Illusion breaking, fainting in disguise, and the player's own; Mega Evolution and Z-Moves; Regenerator; Gastro Acid; Yawn; type changes; `-*` formes.
  - Illusion re-attribution at `|replace|` in T10's layer, and the harness commands and remaining mismatch classes in observation-builder.md.
- **The Python batch env,** joining T09's transport and T16's tensors to T11's learner interface. It logs training's `[Invalid choice]` rate and decisions per game, since self-play game lengths are unmeasured and set games/day. The 1M-request fuzz is at Phase 2's online gate.
  - Its brief also joins the parts (below) and adapts max-damage to record version 2, so that the calibration run trains as v0-lite will.
  - It ends with v0-lite's calibration run (moved from T16, your call, 2026-11-28): T19's net on T11's learner through record version 2, on v1's training teams, for a fixed number of training decisions (about 3 hours' worth on the M4 Max, so load from other sessions doesn't move the point), under the timing lock. It reports the curve and 1,000 duplicate games each against random, with ≥75% as a floor, and against max-damage.
- **Joining the parts,** in the batch env's brief: wire T17's resampling into `drawGame` (`worker/sim/`, after T14 merges), and swap `env.ts` to T10's layer. Then rerun T16's leak test and T14's mask check on the result.
- **The v0-lite run** (plan.md, Phase 1), last. It needs T10, T11, T14, T16, T17, T19, and the batch env with its calibration run. T14's mask check and T16's leak test must pass on that observation.
- **For the v0-lite brief** (raised by the strategic review of PR #12, 2026-11-27):
  - Set the bar from the batch env's calibration run and T14's skeleton-against-max-damage result, not only plan.md's default of 60%. Also require the win rate against max-damage to rise over checkpoints, and report it on the held-out teams (`loadPool` returns training teams only, so that needs an option on it).
  - That held-out report needs D7's 1760 fallback for a mon with no consistent library set, which T16 leaves out: up to 27 of the 60 held-out mons can become inconsistent mid-game and lose their calcs (team-pool.md, species_sets.json). The v0-lite brief builds the fallback, and the option on `loadPool`.
  - Pre-register diagnostics before the run: value explained variance, entropy, KL and clip fraction, self-play turns per game, the cap-hit rate, and win rates against random and earlier snapshots. Pre-register one fallback rerun (for example, faint-differential reward shaping, or weaker regularization), so that a miss is read before Phase 1 goes back to planning.
  - Set D10's KL and entropy coefficients by a short sweep on NatDex with a small configuration of T19's net. T11's toy-tuned ones are provisional.
- The full observation: the evidence features, the second leak test (player against spectator stream), and D7's option of expected damage over the top few consistent combinations. After T16 and T20.
- The aux heads and their training labels: what labels the env emits, and how that channel stays out of the observation.
- The SPRT for the eval runner (plan.md, Evaluation: Tests), before Phase 2's comparisons. It reads T14's per-pair outcomes.
- Merging T20's copy of `worker/sim/`'s game driver back into it.

## For a later replan

Raised by the strategic review of PR #8 (2026-11-26), not yet planned:

- D4: grow the Phase 2 pool toward 200–300 teams, sized from T12's count of what the sources yield. mikumiku trained on ~1,260. T12 counted 650 distinct teams that validate as OU from the NatDex tour dumps and sample teams: 191 first posted in 2026, 147 since April, 97 of unknown date (T12, Result).
- D2: restate the gate so the Rust engine comes only after cheaper levers (the 68-calc set, fewer PPO epochs, a calc fork, a modest budget increase), and recalibrate it after the trial.
- Phase 2's experiments: ablate the calcs (288 against 68 against none) ahead of the token A/B, since mikumiku reached #1 with no calcs and they cost ~68% of a decision at 12 processes in T09's skeleton (0.74 of 1.09 ms, plan.md, Compute). Consider running the token A/B rented.
- Play-time search cost on Showdown (`sim/state.ts` serialize and deserialize per rollout), D2's second trigger. A microbenchmark fits in Phase 1's slack.
- D9's open question on "held" (decisions.md, D9).
- Whether to register a bot account early and play ~100 rated games with a poke-env heuristic player, to measure queue times and the client before the online gate. Your call.

## Blocked

- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Waits for the online gate before Phase 2's rated games (plan.md, Phases); deferred 2026-11-25.

## Done

- T12: ~50-team pool and set library. Merged 2026-11-27 ([PR #11](https://github.com/ayan-s-learn/TycheBot/pull/11)): pool v1, 50 teams with 10 held out; library v0, 1063 sets over 103 species. Notes in [team-pool](areas/team-pool.md).
- T13: ladder-pool monitor, setup. Merged 2026-11-27 ([PR #10](https://github.com/ayan-s-learn/TycheBot/pull/10)). The hourly job has run since 2026-11-26; the write-up is T15.
- T09: walking skeleton. Merged 2026-11-27 ([PR #9](https://github.com/ayan-s-learn/TycheBot/pull/9)): ~11.1k env decisions/s at 12 processes, ~5.8× T07's learner estimate, so neither D7's calc revisit nor D10's asynchronous collection fires yet; the policy beat random in 982 of 1,000 games. Notes in [env-workers](areas/env-workers.md).
- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
- T05: stub pool. Merged 2026-11-25 ([PR #2](https://github.com/ayan-s-learn/TycheBot/pull/2)); notes in [team-pool](areas/team-pool.md).
- T04: replay corpus. Merged 2026-11-25 ([PR #3](https://github.com/ayan-s-learn/TycheBot/pull/3)); turns per game in plan.md (Compute).
- T02: S1 sim throughput. Merged 2026-11-25 ([PR #4](https://github.com/ayan-s-learn/TycheBot/pull/4)): `Battle` direct; env numbers in plan.md (Compute).
- T06: S3 damage-calc cost. Merged 2026-11-25 ([PR #5](https://github.com/ayan-s-learn/TycheBot/pull/5)): stop condition met; D7 now keeps all 288 calcs with a revisit trigger (decisions.md, D7).
- T07: S4 MPS throughput. Merged 2026-11-26 ([PR #6](https://github.com/ayan-s-learn/TycheBot/pull/6)): the learner bounds the M4 Max; 5M net under bf16; D9's threshold set at 7 days (decisions.md, D9).
- T08: S6 battle-state tracker. Merged 2026-11-26 ([PR #7](https://github.com/ayan-s-learn/TycheBot/pull/7)): @pkmn/client in the Node workers (decisions.md, D7); edge-case passes added to its README.
