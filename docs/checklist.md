# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-24.

## Milestone

Phase 0 exit ([plan.md](plan.md), Phases): the toolchain is recorded (done 2026-11-24), the stub pool validates, each spike's result is written up, and the user has signed off on S4's and S6's proposals.

## Next replan

When T02 (S1) pushes a checkpoint whose `Verified:` line starts `Recorder ready`: S6's brief can then be written on that commit, without waiting for T02's timing work. Earlier if any task opens a PR or stops on a stop condition.

## Needs you

Nothing to decide now. Later: T07 (S4) brings the v0 net size and D9's threshold for sign-off, and S6 the tracker choice. T06 (S3) may reopen D7 (its stop conditions).

## Active

None yet.

## Ready

Start these four now, each in its own session (`/do-task T02` and so on). They share no files.

- T02: S1 sim throughput. [Brief](../tasks/T02-sim-throughput/README.md). Start it first: S1 → S6 → S5 is the longest chain.
- T06: S3 damage-calc cost. [Brief](../tasks/T06-calc-cost/README.md). Early because it may reopen D7, and S5 needs its numbers.
- T04: replay corpus. [Brief](../tasks/T04-replay-corpus/README.md). Gives turns per game for S1's numbers, and Phase 1's robustness test reuses it.
- T05: stub pool. [Brief](../tasks/T05-stub-pool/README.md).

Then start these as sessions free up, keeping to your limit of four at once:

- T07: S4 MPS throughput. [Brief](../tasks/T07-mps-throughput/README.md). Its proposals need your sign-off, and S5 needs its CPU inference numbers.
- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Last, because no other task needs its output. It checks D7's one-builder premise, which the online client and S6's tracker choice rely on.

T02, T06 and T07 take timed runs under a shared lock and record load averages (AGENTS.md, Conventions: Timed runs). That keeps their timed runs apart, though not clear of the other sessions' lighter work.

## Blocked

- S6: battle-tracker comparison. Needs T02's recorder output. Its brief comes at the next replan.
- S5: transfer overhead. Needs T06's calc cost and T07's CPU inference numbers. Planned after S6, or else measuring both architectures: if S6 picks @pkmn/client, tracking moves into Node and the calc round trip S5 would measure goes away (D7).

## Done

- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
