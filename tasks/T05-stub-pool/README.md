# T05: stub pool

## Brief

- **Objective:** a pool of 20 `gen9nationaldex` teams that validate at the pinned Showdown commit, at D4's pool path. Phase 0's exit needs it, and Phase 1 grows it to ~50.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - D4's decided parts (sources through Phase 2, validation, interface), plan.md (Components 5).
  - Sources, in order: Smogon's NatDex sample teams (`https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json`; T01 used entries 0 and 2), then recent tournament pastes through pokepast.es JSON.
- **Deliverables:**
  - `data/pool/v0/teams.jsonl`: one team per line, with the team in Showdown's packed format and its source (URL, and name and date where given). The task picks any other fields.
  - `scripts/validate-pool.ts`: validates every team in a pool file at the pin and exits non-zero if any fails, naming it. The monthly re-pin (Conventions) will use it.
  - `docs/areas/team-pool.md`, the area's notes (AGENTS.md, Areas): the `teams.jsonl` format, the validate command, and what the pool contains.
  - Result: how many teams each source gave, how many failed validation and why, and counts of species, Mega Stones and Z-Crystals.
  - Under For integration: the team-pool row for AGENTS.md's Areas table, and the validate command for the re-pin step in Conventions.
- **Acceptance checks:**
  - `node scripts/validate-pool.ts data/pool/v0/teams.jsonl` exits 0 at the pin, with 20 distinct teams.
  - It exits non-zero on a copy in which one team has a banned Pokémon.
  - Between them, the teams include at least one Mega Stone, one Z-Crystal, one Illusion user, and one forme that Team Preview hides (plan.md, Format facts). If the sources lack any of these, Result says which. S6 and Phase 1 test against them.
- **May change:** `tasks/T05-stub-pool/`, `data/pool/v0/`, `scripts/validate-pool.ts`, `docs/areas/team-pool.md`.
- **Limits:** one session, no paid services.
- **Stop and report if:** fewer than 20 teams from D4's sources validate.

## Progress

## Result

## Outputs

## For integration
