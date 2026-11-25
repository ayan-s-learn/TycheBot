# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-25.

## Milestone

Phase 0 exit ([plan.md](plan.md), Phases): the toolchain is recorded (done 2026-11-24), the stub pool validates, each spike's result is written up, and the user has signed off on S4's and S6's proposals.

## Next replan

Now, after the 2026-11-25 merges of T02, T04, T05 and T06: S6's brief, and D7 (Needs you). S6 builds on T02's recorder and sample as of d0ab75e (T02's README, Outputs: Recorder), not the `Recorder ready: 8e01572` checkpoint, whose sample was replaced.

## Needs you

- **D7, damage calcs** (T06's stop condition). D7's fallback, the 48 active-mon calcs, cached, still takes 52–60% of sim + calc time per decision in one process (T06, Result), so "restrict them to the active mons' moves" doesn't bring calcs under 30% unless the env's other work is ≥0.36–0.42 ms per decision. With T02's final sim figure at 14 processes (0.28 ms per decision), and assuming calcs don't slow under contention, the 48 would be ~48%. The merge review added two points: charging all of the sim's slowdown next to calcs to the 48 gives ~65%, the top of the range; and at a forced switch the 48 give no calcs for the player's own bench mons, the ones it chooses among. Options, from T06:
  - wait for S5 and S4, and apply the 30% rule to the whole env time;
  - accept the cost, for example by revising the 30% threshold;
  - reduce it, then remeasure. An HP-aware cache key alone was estimated to leave ~40–50%, so it would likely need a patched calc without the per-call copies as well (T06, Result: What D7's rule gives).

Later: T07 (S4) brings the v0 net size and D9's threshold for sign-off, and S6 the tracker choice.

## Active

None yet.

## Ready

- T07: S4 MPS throughput. [Brief](../tasks/T07-mps-throughput/README.md). Its proposals need your sign-off, and S5 needs its CPU inference numbers.
- T03: S2 server game replayed in-process. [Brief](../tasks/T03-server-replay/README.md). Last, because no task needs it to start. It checks D7's one-builder premise, so S6's sign-off should wait for its Result.

T07 takes timed runs under the shared lock and records load averages (AGENTS.md, Conventions: Timed runs).

## Blocked

- S6: battle-tracker comparison. T02's recorder output is ready: `record.ts` and `sample.jsonl` in `tasks/T02-sim-throughput/`, as of d0ab75e. Its brief comes at the next replan. For the brief: the sample's `|t:|` lines are frozen at 0, and each game's `inputLog` holds both teams, so S6 reads only `p1` and `p2`.
- S5: transfer overhead. Needs T07's CPU inference numbers (T06's calc cost is in). Planned after S6, or else measuring both architectures: if S6 picks @pkmn/client, tracking moves into Node and the calc round trip S5 would measure goes away (D7).

## Done

- T01: toolchain. Merged 2026-11-24 ([PR #1](https://github.com/ayan-s-learn/TycheBot/pull/1)) and recorded in AGENTS.md (Conventions).
- T05: stub pool. Merged 2026-11-25 ([PR #2](https://github.com/ayan-s-learn/TycheBot/pull/2)); notes in [team-pool](areas/team-pool.md).
- T04: replay corpus. Merged 2026-11-25 ([PR #3](https://github.com/ayan-s-learn/TycheBot/pull/3)); turns per game in plan.md (Compute).
- T02: S1 sim throughput. Merged 2026-11-25 ([PR #4](https://github.com/ayan-s-learn/TycheBot/pull/4)): `Battle` direct; env numbers in plan.md (Compute).
- T06: S3 damage-calc cost. Merged 2026-11-25 ([PR #5](https://github.com/ayan-s-learn/TycheBot/pull/5)): stop condition met, D7 reopens (Needs you).
