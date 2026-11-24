# AGENTS.md

Start here for any agent work on TycheBot. This file is the index: what exists, where it lives, and the rules that hold in every area.

## Project

A self-play RL bot for [Gen 9] National Dex OU on Pokémon Showdown. GitHub: [ayan-s-learn/TycheBot](https://github.com/ayan-s-learn/TycheBot).

## Current state

Replace this line, don't append to it, when the phase or what's in flight changes.

- 2026-11-23: planning docs reviewed. There is no code or data, and there are no build or test commands. Next is Phase 0 (plan.md, Phases), starting with the toolchain choice.

## Docs

| Doc | Source of truth for |
|---|---|
| [docs/plan.md](docs/plan.md) | Goal, components, phases and exit criteria, evaluation |
| [docs/decisions.md](docs/decisions.md) | Design choices (D1, D2, …) and their status |
| [docs/prior-work.md](docs/prior-work.md) | Other bots and engines, and external numbers with sources |

On anything a D-number covers, decisions.md wins. When docs disagree with each other or with what was built, fix them in the same change or tell the user.

## Starting a task

1. Read Current state, and the Areas row for each area you will touch.
2. Read those areas' notes. If an area has no notes yet, read its part of plan.md.
3. Check the status of every decision the task relies on (Rules, below).

## Rules

- **This file:** record only what exists and has been checked. Don't add commands, paths or conventions before they are real.
- **Decisions:** build only on decided text. A "partly decided" decision (D4, D7, D9) marks each part that is open or deferred. Anything proposed, open or deferred needs the user's OK. To change a decision, follow the rule at the top of decisions.md.
- **Unverified numbers:** figures tagged "research agent's count", "planning agent's estimate" or similar were not checked. Verify one before a decision rests on it, then replace the tag with its source.
- **Stale facts:** Showdown code, format rules, usage stats and bot policy change. The docs say when they were checked. Re-check an old fact before relying on it.
- **Hidden information:** the bot sees only what its player is shown (D7). Changes to the env, observation builder, damage calcs or online client must keep plan.md's leak tests (Phase 1 exit) passing once those tests exist.
- **Secrets:** the repo is public. Showdown account credentials and API keys never go in it.

## Areas

No areas yet. Add a row when work in one starts, using the component names from plan.md (Components) where one fits:

| Area | Status | Code | Notes |
|---|---|---|---|

Status lives in the row (a few words) and the detail in the area's notes, `docs/areas/<area>.md`. Put in the notes only what has been verified, and skip what doesn't apply yet:

- what works and what doesn't, dated;
- code paths and entry points;
- exact commands that have been run and worked;
- interfaces the area produces: formats, files, versions. The producing area's notes own an interface, and consumers link to them;
- gotchas, each with its evidence.

Before ending a task in an area, update its row and notes. Rules that apply to one area go in its notes. Conventions that apply to every area (toolchain, layout, test commands) go in a Conventions section here once they exist. If an area's notes pass ~150 lines, split them by sub-area and link the parts from the row.
