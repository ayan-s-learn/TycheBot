# T12: ~50-team pool and set library

## Brief

- **Objective:** D4's Phase 1 pool and set library (plan.md: Components 5, Phase 1). The pool is ~50 validated teams with 10 held out, and it corrects the stub pool's skew. The library is `species_sets.json`, the prior over hidden sets that D4's set resampling and D7's calc prior read.
- **Inputs:**
  - Setup (AGENTS.md, Conventions).
  - D4 (its Decided part: resampling, sources through Phase 2, weights, validation, holdout and the interface) and D7 (the calcs' species-level prior). plan.md: Format facts.
  - docs/areas/team-pool.md (the teams.jsonl format, the validator, gotchas), and T05's `build-pool.ts` and `evidence/`.
  - D4's sources: Smogon's 25 NatDex sample teams and 170 analysis sets (pkmn.github.io/smogon), recent tournament pastes through pokepast.es JSON, and the 1760 chaos stats for the latest month (October 2026 if November's aren't out). Snapshot every fetched file into the task's `evidence/`, as T05 did.
- **Deliverables:**
  - `data/pool/v1/teams.jsonl`: ~50 teams in v0's format, 10 of them held out, listed in a file whose format you define and document.
    - Report the stub pool's skew (Z-Crystals on 19 of 20 teams, Zamazenta on 12: team-pool.md) next to v1's.
    - Report how far v1's species usage is from the 1760 stats.
  - `data/priors/v0/species_sets.json`: the analysis sets plus every set on a training pool team (not the held-out ones), weighted as D4 says. Tag each set with what resampling keeps: Mega Stone, Z-Crystal, Stealth Rock setter, hazard removal.
  - Build scripts in `scripts/pool/` that rebuild both files from the snapshots.
  - docs/areas/team-pool.md updated with v1, the library's format, commands and gotchas. The library's format is an interface: the calc features and set resampling will link to it. Propose the AGENTS.md Areas row change under For integration.
- **Acceptance checks:**
  - `node scripts/validate-pool.ts data/pool/v1/teams.jsonl` passes.
  - Every library set passes Showdown's set validation for `gen9nationaldex` at the pin, without repairs (team-pool.md, Gotchas).
  - Every species on a training team has at least one library set, and no set comes only from a held-out team.
  - The build reruns from the snapshots on a clean checkout with identical output.
- **May change:** `data/pool/v1/`, `data/priors/v0/`, `scripts/pool/`, `docs/areas/team-pool.md`, `tasks/T12-pool-v1/`.
- **Limits:** one or two sessions, no paid services. Fetch only public pages, at a polite rate.
- **Stop and report if:**
  - fewer than ~40 teams validate from D4's sources;
  - over half of the library's sets weigh 0 under the 1760 stats.

## Progress

## Result

## Outputs

## For integration
