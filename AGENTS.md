# AGENTS.md

Start here for any agent work on TycheBot. This file is the index: what exists, where it lives, and the rules that hold in every area.

## Project

A self-play RL bot for [Gen 9] National Dex OU on Pokémon Showdown. GitHub: [ayan-s-learn/TycheBot](https://github.com/ayan-s-learn/TycheBot).

## Current state

Replace this line, don't append to it, when the phase changes. What's in flight is in [docs/checklist.md](docs/checklist.md).

- 2026-11-24: Phase 0 (plan.md, Phases). The toolchain is set (Conventions). There is no project code or data yet.

## Docs

| Doc | Source of truth for |
|---|---|
| [docs/plan.md](docs/plan.md) | Goal, components, phases and exit criteria, evaluation |
| [docs/decisions.md](docs/decisions.md) | Design choices (D1, D2, …) and their status |
| [docs/prior-work.md](docs/prior-work.md) | Other bots and engines, and external numbers with sources |
| [docs/workflow.md](docs/workflow.md) | How planning and task sessions work, and who may edit or push what |
| [docs/checklist.md](docs/checklist.md) | Current milestone, task status, decisions waiting on the user |
| `tasks/<ID>-<slug>/README.md` | One task's brief, progress and result |

On anything a D-number covers, decisions.md wins. When docs disagree with each other or with what was built, fix them in the same change or tell the user.

## Starting a task

1. Read Current state, docs/checklist.md, the task's brief if it has one, and the Areas row for each area you will touch.
2. Read those areas' notes. If an area has no notes yet, read its part of plan.md.
3. Check the status of every decision the task relies on (Rules, below).

## Rules

- **This file:** record only what exists and has been checked. Don't add commands, paths or conventions before they are real.
- **Decisions:** build only on decided text. A "partly decided" decision (D4, D7, D9) marks each part that is open or deferred. Anything proposed, open or deferred needs the user's OK. To change a decision, follow the rule at the top of decisions.md.
- **Unverified numbers:** figures tagged "research agent's count", "planning agent's estimate" or similar were not checked. Verify one before a decision rests on it, then replace the tag with its source.
- **Stale facts:** Showdown code, format rules, usage stats and bot policy change. The docs say when they were checked. Re-check an old fact before relying on it.
- **Hidden information:** the bot sees only what its player is shown (D7). Changes to the env, observation builder, damage calcs or online client must keep plan.md's leak tests (Phase 1 exit) passing once those tests exist.
- **Secrets:** the repo is public. Showdown account credentials and API keys never go in it.

## Conventions

Toolchain decided 2026-11-24 ([T01](tasks/T01-toolchain/README.md)).

- **Setup,** in every checkout or worktree, from the root: `nvm use`, `npm ci`, `uv sync`, then `scripts/setup-showdown.sh`. `vendor/` is gitignored, so each worktree builds its own Showdown (~300 MB).
- **Python 3.14 with uv.** `pyproject.toml`, `uv.lock` and `.python-version` are at the root. `uv sync` builds `.venv`; run Python with `uv run`.
- **Node 24** (`.nvmrc`), with `package.json` and `package-lock.json` at the root.
- **Dependencies:** only planning sessions edit `pyproject.toml`, `uv.lock`, `package.json` and `package-lock.json`, so parallel tasks don't conflict on them. A task that needs another package uses `uv run --with <pkg>` or `npm install --no-save <pkg>`, and proposes adding it under For integration. @pkmn/data and @pkmn/dex stay on the 0.10 line that @pkmn/client 0.7.4 depends on.
- **Showdown** is the commit in `showdown.pin`. `scripts/setup-showdown.sh` fetches and builds it into `vendor/pokemon-showdown/` and emits its type declarations. Rerun it after the pin changes.
- **Node code is TypeScript,** run directly with `node file.ts`. Type stripping allows erasable syntax only: no enums, namespaces or parameter properties. Load Showdown's CommonJS `dist/` with a default import or `createRequire`; named imports fail. Type-check with `node vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p <tsconfig>`, using a tsconfig like `tasks/T01-toolchain/tsconfig.json` with its `typeRoots` and `files` paths pointed at the root `vendor/`.
- **Re-pin Showdown monthly** (plan.md, Versioning): fetch master's head into `vendor/pokemon-showdown` (`git fetch --depth 1 origin <new>`) and read `git diff <old> <new> -- config/formats.ts data sim` there (GitHub's compare API lists at most 300 files). Write the new commit into `showdown.pin`, rerun the setup script, validate every pool team and rerun the tests that exist, then commit the pin.
- **Spike code is throwaway.** It stays in its task folder. Phase 1 code may copy from it but doesn't import it.

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

Before ending a task in an area, update its notes and its row. Task sessions edit the notes when their brief lists them and propose everything else under For integration (docs/workflow.md). Rules that apply to one area go in its notes. Conventions that apply to every area (toolchain, layout, test commands) go in a Conventions section here once they exist. If an area's notes pass ~150 lines, split them by sub-area and link the parts from the row.
