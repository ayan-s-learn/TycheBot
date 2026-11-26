# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-26.

## Milestone

Phase 1 exit ([plan.md](plan.md), Phases).

## Next replan

When any of T09–T12 has a `Reviewed:` line or stops on a stop condition (workflow.md, Task session), or when you decide the token layout (Needs you). T09's skeleton result decides whether D7's calc revisit trigger fires.

## Needs you

- **v0 token layout** (plan.md, Network v0: Size). The token list comes to 33, and T07 also timed 77, where the learner is ~2.3× slower. A deliberation on 2026-11-26 ([T07, tokens/](../tasks/T07-mps-throughput/tokens/README.md)) recommends 33 tokens with a shared per-move encoder in each mon token, which cost 2% in its timing, and proposes an equal-wall-clock A/B against 53 tokens early in Phase 2. None of T09–T12 depends on the answer.

## Active

None yet.

## Ready

All four can start now, each in its own session (`/do-task T09` and so on). Each owns its own subfolders (AGENTS.md, Conventions: Layout), so they share no files. T09 takes timed runs under the shared lock (AGENTS.md, Conventions: Timed runs).

- T09: walking skeleton. [Brief](../tasks/T09-skeleton/README.md). It settles the Node↔Python transport and record format, and measures env decisions/s for D7's calc revisit trigger.
- T10: tracker fix layer and ground truth. [Brief](../tasks/T10-tracker-layer/README.md). It starts the observation builder, Phase 1's long pole.
- T11: PPO learner and toy checks. [Brief](../tasks/T11-learner/README.md).
- T12: ~50-team pool and set library. [Brief](../tasks/T12-pool-v1/README.md). The calc features on priors need it.

## Later in Phase 1

Briefed once their inputs exist (plan.md, Phase 1):

- Observation features and the full record, after T09's record format, T10's tracker and the token decision. Then the leak tests.
- Calc features on the species-level prior (D7), after T12's library and T09's calcs.
- Action masks and their fuzz over 1M requests.
- Baselines (random, max-damage) and the eval runner. Then max-damage games join T10's ground-truth check.
- The Python batch env, joining T09's transport to T11's learner interface, with asynchronous collection.
- Moving T10's copy of the recorder onto `worker/sim/`.

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
