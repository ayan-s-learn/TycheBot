# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-27 (second replan).

## Milestone

Phase 1 exit ([plan.md](plan.md), Phases).

## Next replan

When any of T10, T11, T14, T16, T17 or T18 has a `Reviewed:` line or stops on a stop condition (workflow.md, Task session). Also when T16 pushes its record version 2 and tensor layout (Progress, `Verified`): that is the input the 5M net's brief needs (Later in Phase 1). Once T10's layer, T11, T14 and T16 are in, brief the batch env and the v0-lite run.

## Needs you

Nothing open. Answered 2026-11-27: T12's usage-matched selection is accepted (decisions.md, D4); Pokémon Champions content is out of scope, since the bot plays only `gen9nationaldex` as the pin defines it; the ~$5 rented benchmark is approved (T18).

## Active

- T15: ladder-pool write-up. [Brief](../tasks/T15-ladder-writeup/README.md). Starts on or after 2026-12-10 22:52 UTC, on your Mac. T13's hourly job collects until then; any session can check it with `tasks/T13-ladder-monitor/job.sh status`.

## Ready

All six can start now, each in its own session (`/do-task T16` and so on). Their May change paths are disjoint. T14 and T16 both work around `worker/skeleton/`, split by file: T16 has `env.ts`, `record.ts`, `vocab.ts` and `drive.ts`, and T14 has `main.ts` and `mask.ts`.

- T16: observation, first cut (record version 2, calcs on T12's prior, the hidden-content leak test, the builder's cost). [Brief](../tasks/T16-observation/README.md). Start it first: it is v0-lite's longest prerequisite. Its timed runs need your Mac.
- T10: tracker fix layer and ground truth. [Brief](../tasks/T10-tracker-layer/README.md). T16 builds on the raw client meanwhile and swaps to this layer by import.
- T14: baselines, eval runner and sampled mask check. [Brief](../tasks/T14-eval-baselines/README.md).
- T11: PPO learner and toy checks. [Brief](../tasks/T11-learner/README.md).
- T17: D4's set resampling. [Brief](../tasks/T17-set-resampling/README.md). Small, and not a v0-lite prerequisite.
- T18: rented env benchmark, ≤$5. [Brief](../tasks/T18-rented-env-bench/README.md). It needs you to set up the provider account and payment, and runs from your Mac.

## Later in Phase 1

Briefed once their inputs exist (plan.md, Phase 1):

- **The 5M net** (plan.md, Network v0: Size, Moves inside mon tokens, Action head, Other heads) on T16's tensors. Briefed once T16 has pushed its record version 2 and tensor layout (Next replan). T07's stand-in (`tasks/T07-mps-throughput/tokens/`) is the start.
- **The Python batch env,** joining T09's transport and T16's tensors to T11's learner interface, with training's `[Invalid choice]` rate logged. The 1M-request fuzz is at Phase 2's online gate.
- **The v0-lite run** (plan.md, Phase 1), last. It needs T10's layer as it stands, T11, T14, T16, the 5M net and the batch env. T14's mask check and T16's leak test must pass on that observation. Its brief adapts max-damage to record version 2 and wires in T17's resampling if it has merged.
- The full observation: the evidence features, D7's 1760 fallback for species without library sets, and the second leak test (player against spectator stream). After T16 and T10.
- The SPRT for the eval runner (plan.md, Evaluation: Tests), before Phase 2's comparisons. It reads T14's per-pair outcomes.
- Max-damage games in T10's ground-truth check, after T14.
- Moving T10's copy of the recorder onto `worker/sim/`.

## For a later replan

Raised by the strategic review of PR #8 (2026-11-26), not yet planned:

- D4: grow the Phase 2 pool toward 200–300 teams, sized from T12's count of what the sources yield. mikumiku trained on ~1,260. T12 counted 650 distinct teams that validate as OU from the NatDex tour dumps and sample teams: 191 first posted in 2026, 147 since April, 97 of unknown date (T12, Result).
- D2: restate the gate so the Rust engine comes only after cheaper levers (the 68-calc set, fewer PPO epochs, a calc fork, a modest budget increase), and recalibrate it after the trial.
- Phase 2's experiments: ablate the calcs (288 against 68 against none) ahead of the token A/B, since mikumiku reached #1 with no calcs and they cost ~68% of a decision at 12 processes in T09's skeleton (0.74 of 1.09 ms, plan.md, Compute), before the sim's slowdown with calcs between its steps (up to ~0.10 ms, T02 and T06). Consider running the token A/B rented.
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
