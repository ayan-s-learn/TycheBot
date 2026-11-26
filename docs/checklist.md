# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-26.

## Milestone

Phase 1 exit ([plan.md](plan.md), Phases).

## Next replan

When any of T09–T13 has a `Reviewed:` line or stops on a stop condition (workflow.md, Task session). T09's skeleton result decides whether D7's calc revisit trigger fires and whether D10's collection goes asynchronous. Once T09, T11 and T12 are merged, brief what the v0-lite run needs (plan.md, Phase 1), then the run.

## Needs you

- **A ~$5 rented env benchmark now?** plan.md's own estimate of $5.40–9 per million games straddles D2's $8 gate, and that trial isn't due until after Phase 2. Running T02's sim sweep and T06's calc benchmark on a rented many-vCPU box would show early whether the gate is likely to trip. It needs your OK as an exception to D9's budget rule (decisions.md, D9), and you would set up the account and payment. Recommended.

## Active

None yet.

## Ready

All five can start now, each in its own session (`/do-task T09` and so on). Each owns its own subfolders (AGENTS.md, Conventions: Layout), so they share no files. T09 takes timed runs under the shared lock (AGENTS.md, Conventions: Timed runs).

- T09: walking skeleton. [Brief](../tasks/T09-skeleton/README.md). It settles the Node↔Python transport and record format, and measures env decisions/s for D7's calc revisit trigger and D10's collection.
- T10: tracker fix layer and ground truth. [Brief](../tasks/T10-tracker-layer/README.md). It starts the observation builder, Phase 1's long pole.
- T11: PPO learner and toy checks. [Brief](../tasks/T11-learner/README.md).
- T12: ~50-team pool and set library. [Brief](../tasks/T12-pool-v1/README.md). The calc features on priors need it.
- T13: ladder-pool monitor. [Brief](../tasks/T13-ladder-monitor/README.md). Its first session sets up a scheduled job, which needs your OK. The write-up comes after ≥14 days.

## Later in Phase 1

Briefed once their inputs exist (plan.md, Phase 1):

- **The v0-lite run** (plan.md, Phase 1), first. It needs T09, T10's layer as it stands, T11, T12, the max-damage baseline, the eval runner, a first cut of the observation with calcs on T12's priors, and the sampled mask check and first leak test passing on it.
- Observation features and the full record, after T09's record format and T10's tracker. Then the leak tests; the hidden-content one comes before v0-lite.
- Calc features on the species-level prior (D7), after T12's library and T09's calcs.
- Action masks: the sampled check for masked-out legal actions (before v0-lite), and training's `[Invalid choice]` rate. The 1M-request fuzz is at Phase 2's online gate.
- Baselines (random, max-damage) and the eval runner. Then max-damage games join T10's ground-truth check.
- The Python batch env, joining T09's transport to T11's learner interface.
- Moving T10's copy of the recorder onto `worker/sim/`.

## For a later replan

Raised by the strategic review of PR #8 (2026-11-26), not yet planned:

- D4: grow the Phase 2 pool toward 200–300 teams, sized from T12's count of what the sources yield. mikumiku trained on ~1,260.
- D2: restate the gate so the Rust engine comes only after cheaper levers (the 68-calc set, fewer PPO epochs, a calc fork, a modest budget increase), and recalibrate it after the trial.
- Phase 2's experiments: ablate the calcs (288 against 68 against none) ahead of the token A/B, since mikumiku reached #1 with no calcs and they cost ~58–69% of env CPU (derived from plan.md, Compute: of 0.91 ms per decision, 0.53 ms is calcs and up to ~0.10 ms is the sim's slowdown with calcs between its steps, 0.38 against ~0.28 without). Consider running the token A/B rented.
- Play-time search cost on Showdown (`sim/state.ts` serialize and deserialize per rollout), D2's second trigger. A microbenchmark fits in Phase 1's slack.
- D9's open question on "held" (decisions.md, D9).
- Whether to register a bot account early and play ~100 rated games with a poke-env heuristic player, to measure queue times and the client before the online gate. Your call.

## Blocked

- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Waits for the online gate before Phase 2's rated games (plan.md, Phases); deferred 2026-11-25.

## Done

- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
- T05: stub pool. Merged 2026-11-25 ([PR #2](https://github.com/ayan-s-learn/TycheBot/pull/2)); notes in [team-pool](areas/team-pool.md).
- T04: replay corpus. Merged 2026-11-25 ([PR #3](https://github.com/ayan-s-learn/TycheBot/pull/3)); turns per game in plan.md (Compute).
- T02: S1 sim throughput. Merged 2026-11-25 ([PR #4](https://github.com/ayan-s-learn/TycheBot/pull/4)): `Battle` direct; env numbers in plan.md (Compute).
- T06: S3 damage-calc cost. Merged 2026-11-25 ([PR #5](https://github.com/ayan-s-learn/TycheBot/pull/5)): stop condition met; D7 now keeps all 288 calcs with a revisit trigger (decisions.md, D7).
- T07: S4 MPS throughput. Merged 2026-11-26 ([PR #6](https://github.com/ayan-s-learn/TycheBot/pull/6)): the learner bounds the M4 Max; 5M net under bf16; D9's threshold set at 7 days (decisions.md, D9).
- T08: S6 battle-state tracker. Merged 2026-11-26 ([PR #7](https://github.com/ayan-s-learn/TycheBot/pull/7)): @pkmn/client in the Node workers (decisions.md, D7); edge-case passes added to its README.
