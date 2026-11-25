# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-25.

## Milestone

Phase 0 exit ([plan.md](plan.md), Phases): the toolchain is recorded (done 2026-11-24), the stub pool validates, S1's, S3's, S4's and S6's results are written up, and the user has signed off on S4's and S6's proposals.

## Next replan

When T07 or T08 opens a PR or stops on a stop condition. Once both are merged and you have signed off on their proposals, Phase 0 exits: then plan Phase 1, starting with the walking skeleton and the parallel learner track (plan.md, Phases). Add open-spiel to `pyproject.toml` for the toy checks (T01 found macOS wheels for cp311–cp314).

## Needs you

Nothing to decide now. Later: T07 (S4) brings the v0 net size and D9's threshold for sign-off, and T08 (S6) the tracker recommendation.

## Active

None yet.

## Ready

Start both now, each in its own session (`/do-task T07`, `/do-task T08`). They share no files. Both take timed runs under the shared lock (AGENTS.md, Conventions: Timed runs).

- T07: S4 MPS throughput. [Brief](../tasks/T07-mps-throughput/README.md). It decides the v0 net size and D9's threshold, and gives the learner's games/day for D7's calc revisit trigger.
- T08: S6 battle-state tracker. [Brief](../tasks/T08-tracker/README.md). The architecture choice left in Phase 0.

## Blocked

- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Waits for the online gate before Phase 2's rated games (plan.md, Phases); deferred 2026-11-25.

## Done

- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
- T05: stub pool. Merged 2026-11-25 ([PR #2](https://github.com/ayan-s-learn/TycheBot/pull/2)); notes in [team-pool](areas/team-pool.md).
- T04: replay corpus. Merged 2026-11-25 ([PR #3](https://github.com/ayan-s-learn/TycheBot/pull/3)); turns per game in plan.md (Compute).
- T02: S1 sim throughput. Merged 2026-11-25 ([PR #4](https://github.com/ayan-s-learn/TycheBot/pull/4)): `Battle` direct; env numbers in plan.md (Compute).
- T06: S3 damage-calc cost. Merged 2026-11-25 ([PR #5](https://github.com/ayan-s-learn/TycheBot/pull/5)): stop condition met; D7 now keeps all 288 calcs with a revisit trigger (decisions.md, D7).
