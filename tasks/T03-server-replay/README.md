# T03: S2 server game replayed in-process

## Brief

- **Objective:** check that one observation builder can read both what a live server sends and what the in-process sim produces (D7: one builder for training and online play). Play games on a local server, replay each in-process from its `/exportinputlog` with the same seed, and document every difference between the two per-player streams, such as `rqid`, room lines, timestamps and `|split|` handling.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - plan.md (Components 2 and 7; Phase 0: S2), D7.
  - The server: `node pokemon-showdown start --skip-build --no-security <port>` from `vendor/pokemon-showdown`, as T01's `check-server.sh` runs it. `--no-security` works but isn't listed in `pokemon-showdown help`. On Node 24, Showdown's optional native deps (better-sqlite3, sqlite3) fail to build and npm drops them silently; T01's server check didn't need them.
  - Server-side players: poke-env's websocket client (root `pyproject.toml`).
  - In-process: both `Battle` with `extractChannelMessages` and `BattleStream`'s player streams, since S1 (T02) hasn't picked one yet.
  - Teams: Smogon NatDex sample teams that validate at the pin. T01's `teams/sample-1.txt` and `sample-2.txt` are two.
- **Deliverables,** in this folder:
  - The scripts, and for each game the raw captures: both players' websocket messages and the exported input log.
  - A diff script that compares online and in-process streams and requests per player.
  - Result: each difference, whether it appears only online, only in-process, or as the same information in another form, and what the builder has to do about it.
- **Acceptance checks:**
  - At least 5 games, which between them include a Mega Evolution, a Z-Move, a faint followed by a forced switch, and a game played to `|win|`.
  - For every game and player, the diff script, applying only the normalizations Result lists, finds the streams and requests identical and exits 0.
  - The games rerun from Outputs on a clean checkout.
- **May change:** `tasks/T03-server-replay/` only.
- **Limits:** one session. Local server only, never the public one, and no accounts.
- **Stop and report if:** an in-process replay diverges from the online game (a different battle, not a format difference), or getting the input log or per-player messages needs a Showdown patch.

## Progress

## Result

## Outputs

## For integration
