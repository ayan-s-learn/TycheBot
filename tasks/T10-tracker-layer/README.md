# T10: Tracker fix layer

## Brief

- **Objective:** the tracking core of the observation builder (D7): a layer over @pkmn/client 0.7.4 with the fixes T08 and its edge-case passes found. v0-lite's observation takes it as it stands (plan.md, Phase 1), so it is kept small to merge early. Narrowed on 2026-11-28: the ground-truth harness, the 10k-game mismatch counts, the full scenario suite and Illusion re-attribution moved to T20 (checklist, Later in Phase 1), since v1 and the set library have no Illusion or Transform user.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout and Tests.
  - D7. plan.md: Format facts; Network v0 (the fields the observation uses: Tokens, Mega and Z flags); Phase 1 exit (Ground truth, Robustness).
  - T08's README: Result (the mismatch classes, and Fixes each tracker needs) and Edge-case passes. The passes add `-prepare`, plain Wish, Gastro Acid, Yawn and `addedType`.
  - Code to copy from, not import: `tasks/T08-tracker/edge-red/layer.ts` as the starting layer, and T08's edge-case scenario scripts (`edge-red/`, `edge-blue/gen.ts` and `scenarios.ts`) as the seed of the tests, with the T08 files they import (`pkmn.ts`, `sim.ts`, `truth.ts`, and the `teams/` files `sim.ts` reads).
  - T09's merged `worker/sim/battles.ts` (`Game`, `drawGame`) and `worker/skeleton/drive.ts` (`randomLegal`), to import for the random-player games, and the NatDex `Generations` filter in `worker/skeleton/env.ts`, to copy (it isn't exported).
  - T04's replays (`data/replays/v0/`), for the parse check.
  - Teams: all 50 v1 teams, `data/pool/v1/teams.jsonl` (team-pool.md). Read the file directly: `loadPool` returns only the 40 training teams, and the 10 held-out ones add 7 species.
- **Deliverables,** in `worker/tracker/`:
  - The layer: a subclass of the client's `Battle`, as `layer.ts` is, so T09's worker can switch to it by changing an import in `env.ts`.
    - It carries every fix in T08's list for @pkmn/client and the edge-case passes, apart from Illusion re-attribution (T20). That includes the Regenerator estimate for species with only one possible ability. Keep `layer.ts`'s partial Illusion handling as it is, untested here; T20 completes and tests it.
    - It keeps an allowlist of the message types the client may ignore. Any other type is an error.
    - It tracks the sleep and toxic counters, which the client doesn't (plan.md, Phase 1 exit: Ground truth).
  - A test per fix: a fixed-seed game, scripted where random play won't produce the case, in which the raw client's field differs from the sim's state at a chosen decision and the layer's matches it.
  - `docs/areas/observation-builder.md`: what the layer fixes, what it leaves to T20, how to swap it in, and gotchas. Propose the AGENTS.md Areas row under For integration.
- **Acceptance checks:**
  - The per-fix tests pass (AGENTS.md, Conventions: Tests).
  - No throws and no message type outside the allowlist on T04's 1,100 replays and on ≥1,000 random-player games between v1 teams.
  - `tsc -p tsconfig.json` passes.
- **May change:** `worker/tracker/`, `docs/areas/observation-builder.md`, `tasks/T10-tracker-layer/`.
- **Limits:** up to two sessions, no paid services. No timing is needed: T08 measured tracking at 0.018 ms per decision.
- **Stop and report if:**
  - a fix needs changing @pkmn/client's own code or forking it, which D7 says the layer avoids;
  - the observation needs a field that can't be tracked without information the player isn't shown.
- **Watch for** (final review of PR #12, 2026-11-28). Context, not added requirements; use your judgment:
  - A per-fix test that also passes on the raw client doesn't show the fix.
  - Keeping the client's constructor (`new Client(gens, side)` in `env.ts`) keeps the swap a one-line import change.

## Progress

## Result

## Outputs

## For integration
