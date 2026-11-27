# T17: Set resampling

## Brief

- **Objective:** D4's per-game set resampling, so that Team Preview stops identifying a pool team's sets. Training and the eval runner call it when they deal a game. It is a v0-lite prerequisite (plan.md, Phase 1): without it, Team Preview identifies each training team and the net can memorize its sets. It is small and self-contained.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout and Tests.
  - D4, Decided: "Resample sets every game", including T12's weight refinements, and Keep team structure.
  - [team-pool](../../docs/areas/team-pool.md): `data/pool/v1/` and `data/priors/v0/species_sets.json` (format, weights, tags, the Greninja-Bond key). The validator and the gotchas are in the same notes.
- **Deliverables:**
  - `worker/pool/`: a pure function from (packed team, library, seed) to a packed team. On both teams, each mon is replaced with probability ~0.5 by a set of its species, drawn by weight; the draw may return the same set. The result keeps D4's team structure: Mega and Z-Crystal counts, a Stealth Rock setter and hazard removal, using the library's tags. You define how (for example, drawing only among sets whose tags keep the counts) and document it. It is deterministic in the seed, so the two games of a duplicate pair (T14) can share one draw.
  - A note in team-pool.md: the function, how structure is kept, and how far its draws move from the library's weights because of that.
  - Wiring it into dealing a game (`drawGame` in `worker/sim/`, which T14 owns) goes under For integration, as a short exact diff. The batch env's or v0-lite's brief applies it (checklist, Later in Phase 1: Joining the parts).
- **Acceptance checks:**
  - On ≥100k resampled v1 training teams: the structure counts are kept on every team, and the share of mons replaced is ~0.5.
  - On ≥10k of them: each validates for `gen9nationaldex` at the pin, as `validate-pool.ts` checks teams. The library's sets all validate alone (T12), so this checks the combinations.
  - Draw frequencies per species match the library's weights within sampling error, after the structure constraint. Where the constraint skews them, Result says by how much (total variation per species).
  - The same seed gives the same team. Tests (AGENTS.md, Conventions: Tests) cover these, and `tsc -p tsconfig.json` passes.
  - Random-player games on resampled teams end without errors, as `tasks/T12-pool-v1/smoke-battles.ts` checks (≥200 games).
- **May change:** `worker/pool/`, `docs/areas/team-pool.md` (a section on resampling), `tasks/T17-set-resampling/`.
- **Limits:** one session, no paid services.
- **Stop and report if:**
  - keeping the structure leaves some species with no eligible set often enough to matter (say over 5% of its draws), which would need a D4 decision on what to do instead.

## Progress

## Result

## Outputs

## For integration
