# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-24.

## Milestone

Phase 0 exit ([plan.md](plan.md), Phases): the toolchain is recorded (done 2026-11-24), the stub pool validates, each spike's result is written up, and the user has signed off on S4's and S6's proposals.

## Next replan

When T02 (S1) has a PR up, since its result unblocks S6's brief. Earlier if any other task opens a PR or stops on a stop condition.

## Needs you

Nothing now. T07 (S4) will bring the v0 net size and D9's threshold for sign-off, and S6 the tracker choice.

## Active

None yet.

## Ready

Start these four now, each in its own session (`/do-task T02` and so on). They share no files.

- T02: S1 sim throughput. [Brief](../tasks/T02-sim-throughput/README.md). Start it first: S1 → S6 → S5 is the longest chain.
- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md).
- T04: replay corpus. [Brief](../tasks/T04-replay-corpus/README.md). Gives turns per game for S1's numbers, and Phase 1's robustness test reuses it.
- T05: stub pool. [Brief](../tasks/T05-stub-pool/README.md).

Then start these as sessions free up, keeping to four at once:

- T07: S4 MPS throughput. [Brief](../tasks/T07-mps-throughput/README.md). Before T06, because its proposals need your sign-off.
- T06: S3 damage-calc cost. [Brief](../tasks/T06-calc-cost/README.md). Applies D7's 30% rule once T02's result is in.

T02, T06 and T07 take their timed runs under a shared lock (each brief's Limits), so their sessions can overlap without skewing each other's numbers.

## Blocked

- S6: battle-tracker comparison. Needs T02's recorded per-player streams. Its brief comes at the next replan.
- S5: transfer overhead. Needs T06's calc cost and T07's CPU inference numbers. Planned after S6, or else measuring both architectures: if S6 picks @pkmn/client, tracking moves into Node and the calc round trip S5 would measure goes away (D7).

## Done

- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
