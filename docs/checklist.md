# Checklist

What's in flight. Only planning sessions edit this file ([workflow.md](workflow.md)).

Updated 2026-11-23.

## Milestone

Phase 0 exit ([plan.md](plan.md), Phases): the toolchain is recorded, the stub pool validates, each spike's result is written up, and the user has signed off on S4's and S6's proposals.

## Next replan

When T01's PR is up. The user then picks the toolchain, and the planning session records it in AGENTS.md (Conventions) and writes briefs for the tasks blocked on it.

## Needs you

Nothing yet. T01 will bring the toolchain choice.

## Active

None.

## Ready

- T01: toolchain proposal. [Brief](../tasks/T01-toolchain/README.md).

## Blocked

On T01 (the toolchain). Briefs get written once it is decided:

- S1: sim throughput, `Battle` direct vs `BattleStream`.
- S2: a local-server game replayed in-process, streams diffed.
- S3: damage-calc cost.
- S4: MPS training and inference throughput. Needs only the Python part of the toolchain.
- Replay corpus: ≥1k public NatDex replays. It is part of S1 in plan.md, but it runs as its own task because collecting it doesn't depend on S1's timing work. S1 uses it for turns per game, and Phase 1's robustness test reuses it.
- Stub pool: 20 validated teams.

Later in Phase 0:

- S6: battle-tracker comparison. Needs recorded per-player streams, such as S1's harness produces.
- S5: transfer overhead. Planned after S6, or else measuring both architectures. If S6 picks @pkmn/client, tracking moves into Node and the calc round trip S5 would measure goes away (D7).

## Done

None yet.
