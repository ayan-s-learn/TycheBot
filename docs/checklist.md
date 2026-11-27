# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-27.

## Milestone

Phase 1 exit ([plan.md](plan.md), Phases).

## Next replan

When any of T10–T14 has a `Reviewed:` line or stops on a stop condition (workflow.md, Task session). Once T12 is merged, brief the first cut of the observation with calcs on its priors (Later in Phase 1). Then, once T10's layer, T11 and T14 are in, brief the v0-lite run.

## Needs you

- **A ~$5 rented env benchmark now?** plan.md's own estimate of $5.40–9 per million games straddles D2's $8 gate, and that trial isn't due until after Phase 2. Running T02's sim sweep and T06's calc benchmark on a rented many-vCPU box would show early whether the gate is likely to trip. It needs your OK as an exception to D9's budget rule (decisions.md, D9), and you would set up the account and payment. Recommended.

## Active

Running in their own sessions. T12's claim isn't on `origin` yet (2026-11-27).

- T12: ~50-team pool and set library. [Brief](../tasks/T12-pool-v1/README.md). The observation's calcs on priors wait for it.
- T13: ladder-pool monitor. [Brief](../tasks/T13-ladder-monitor/README.md). Its scheduled job needs your OK. The write-up comes after ≥14 days.

## Ready

All three can start now, each in its own session (`/do-task T10` and so on). They share no files with each other or with T12 and T13 (each brief's May change).

- T10: tracker fix layer and ground truth. [Brief](../tasks/T10-tracker-layer/README.md). Start it first: it begins the observation builder, Phase 1's long pole, and v0-lite's observation is built on its layer.
- T11: PPO learner and toy checks. [Brief](../tasks/T11-learner/README.md).
- T14: baselines, eval runner and sampled mask check. [Brief](../tasks/T14-eval-baselines/README.md). Max-damage reads the record's calcs (your call, 2026-11-27).

## Later in Phase 1

Briefed once their inputs exist (plan.md, Phase 1):

- **The v0-lite run** (plan.md, Phase 1), last. It needs T10's layer as it stands, T11, T12 and T14, a first cut of the observation with calcs on T12's priors, and the sampled mask check (T14) and the hidden-content leak test passing on it.
- **The first cut of the observation,** with calcs on T12's species-level prior (D7) and the hidden-content leak test. Briefed once T12 is merged (your call, 2026-11-27), on the tracker as it stands then: @pkmn/client as is, or T10's layer, which is an import change. Budget, from T09 (plan.md, Compute): the skeleton spends 1.09 ms per decision per process. Collection stays synchronous (D10) while the env is under ~2.1 ms, and the env stays off the bound (D7's revisit) under ~6.3 ms, both at 33 tokens. Calcs on priors replace the skeleton's true-set check, which throws on an opposing Transform or Illusion (env-workers, Status).
- The full observation and record, after that first cut and T10's tracker. Then the second leak test (player against spectator stream).
- Training's `[Invalid choice]` rate, logged by the learner through the batch env. The 1M-request fuzz is at Phase 2's online gate.
- The Python batch env, joining T09's transport to T11's learner interface.
- Max-damage games in T10's ground-truth check, after T14.
- Moving T10's copy of the recorder onto `worker/sim/`.

## For a later replan

Raised by the strategic review of PR #8 (2026-11-26), not yet planned:

- D4: grow the Phase 2 pool toward 200–300 teams, sized from T12's count of what the sources yield. mikumiku trained on ~1,260.
- D2: restate the gate so the Rust engine comes only after cheaper levers (the 68-calc set, fewer PPO epochs, a calc fork, a modest budget increase), and recalibrate it after the trial.
- Phase 2's experiments: ablate the calcs (288 against 68 against none) ahead of the token A/B, since mikumiku reached #1 with no calcs and they cost ~68% of a decision at 12 processes in T09's skeleton (0.74 of 1.09 ms, plan.md, Compute), before the sim's slowdown with calcs between its steps (up to ~0.10 ms, T02 and T06). Consider running the token A/B rented.
- Play-time search cost on Showdown (`sim/state.ts` serialize and deserialize per rollout), D2's second trigger. A microbenchmark fits in Phase 1's slack.
- D9's open question on "held" (decisions.md, D9).
- Whether to register a bot account early and play ~100 rated games with a poke-env heuristic player, to measure queue times and the client before the online gate. Your call.

## Blocked

- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Waits for the online gate before Phase 2's rated games (plan.md, Phases); deferred 2026-11-25.

## Done

- T09: walking skeleton. Merged 2026-11-27 ([PR #9](https://github.com/ayan-s-learn/TycheBot/pull/9)): ~11.1k env decisions/s at 12 processes, ~5.8× T07's learner estimate, so neither D7's calc revisit nor D10's asynchronous collection fires yet; the policy beat random in 982 of 1,000 games. Notes in [env-workers](areas/env-workers.md).
- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
- T05: stub pool. Merged 2026-11-25 ([PR #2](https://github.com/ayan-s-learn/TycheBot/pull/2)); notes in [team-pool](areas/team-pool.md).
- T04: replay corpus. Merged 2026-11-25 ([PR #3](https://github.com/ayan-s-learn/TycheBot/pull/3)); turns per game in plan.md (Compute).
- T02: S1 sim throughput. Merged 2026-11-25 ([PR #4](https://github.com/ayan-s-learn/TycheBot/pull/4)): `Battle` direct; env numbers in plan.md (Compute).
- T06: S3 damage-calc cost. Merged 2026-11-25 ([PR #5](https://github.com/ayan-s-learn/TycheBot/pull/5)): stop condition met; D7 now keeps all 288 calcs with a revisit trigger (decisions.md, D7).
- T07: S4 MPS throughput. Merged 2026-11-26 ([PR #6](https://github.com/ayan-s-learn/TycheBot/pull/6)): the learner bounds the M4 Max; 5M net under bf16; D9's threshold set at 7 days (decisions.md, D9).
- T08: S6 battle-state tracker. Merged 2026-11-26 ([PR #7](https://github.com/ayan-s-learn/TycheBot/pull/7)): @pkmn/client in the Node workers (decisions.md, D7); edge-case passes added to its README.
