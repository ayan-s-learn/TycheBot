# T01: Toolchain proposal

## Brief

- **Objective:** propose the toolchain that plan.md's Phase 0 asks the user to pick first, checked by a smoke test on the M4 Max, so the spikes can start. Recommend one option for each of these, and name the runner-up where it's close:
  - Python version and environment manager.
  - Node version, and TS or JS for the workers.
  - How Showdown is pinned: a git dependency (needs Showdown's build step), the `pokemon-showdown` npm package, or @pkmn/sim. Check that the choice gives the spikes what they use: `sim/tools/runner.ts`, `extractChannelMessages` from `sim/battle.ts`, `validate-team`, and a local server (S2, later the online client). The pin outlives Phase 0, so also check what later phases use: `sim/tools/exhaustive-runner.ts` (Phase 1 mask fuzzing) and `sim/state.ts` (Phase 1 probes, Phase 5 synthesizer). Say how the monthly re-pin works (plan.md, Evaluation: Versioning).
  - Whether spike code is throwaway or becomes the Phase 1 base. If it becomes the base, also propose the code layout and a test runner per language. D4 already fixes `data/pool/` and `data/priors/`.
- **Inputs:** plan.md (Components, Phase 0, Evaluation), D2, D4, D6, D7, prior-work.md (Reusable code). AGENTS.md's Stale facts rule applies to every version and package fact.
- **Deliverables:** in this folder: the smoke-test scripts; Result, with the recommendation per question and the source and check date of each fact it rests on; Outputs, with the commands that rerun the smoke test; and the proposed AGENTS.md Conventions section under For integration.
- **Acceptance checks:**
  - At the proposed Showdown pin, a `gen9nationaldex` battle between random players runs to completion in-process.
  - At that pin, `validate-team gen9nationaldex` accepts a Smogon NatDex sample team and rejects a team with a banned Pokémon.
  - In the proposed Python environment, `torch.backends.mps.is_available()` is true. The PyTorch version is recorded.
  - The smoke test reruns from a clean checkout of the task branch, using only the commands in Outputs.
- **May change:** `tasks/T01-toolchain/` only. Repo-wide config (pyproject.toml, package.json, lockfiles) waits for the user's OK.
- **Limits:** one session, no paid services. Installing Node, Python or an environment manager globally needs the user's OK.
- **Stop and report if:** no pin option gives the spikes what they need without patching Showdown.

## Progress

```text
2026-11-24 (3)
State: done
Verified: all acceptance checks. smoke.sh passes from a clean clone of this branch on Node 24 and on
  Node 22 (evidence/smoke-node24.log, smoke-node22.log). The user OK'd installing Node 24 (nvm) and
  uv (Homebrew) on 2026-11-24.
Pending: none
Next: a planning session reviews the PR, and the user picks the toolchain.
```

```text
2026-11-24 (2)
State: active
Verified: smoke.sh passes at Showdown 29f2d99 on Node 22.23.2 (nvm) with uv 0.13.10 run from a
  scratch venv, Python 3.14.7 (Homebrew), torch 2.15.0: validate-team, 20+20 battles, exhaustive
  runner, local server, MPS available.
Pending: rerun on the proposed Node 24 and a regular uv install, from a clean checkout; write Result.
Next: ask the user to OK `nvm install 24` and `brew install uv`; then rerun smoke.sh from a clean clone.
```

```text
2026-11-24
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: survey installed toolchain on the M4 Max, then check Showdown pin options
```

## Result

| Question | Recommendation | Runner-up |
|---|---|---|
| Python | 3.14 | 3.15, once OpenSpiel ships 3.15 wheels (close) |
| Environment manager | uv | venv + pip (not close: no lockfile without extra tools) |
| Node | 24 LTS | 22 LTS (close) |
| Workers | TypeScript, run by Node's type stripping | JavaScript (not close) |
| Showdown pin | A commit in `showdown.pin`, shallow-fetched and built by `setup-showdown.sh` | @pkmn/sim (not close) |
| Spike code | Throwaway | S1's harness as the env-worker base (not close) |

No stop condition was hit: the git pin gives the spikes everything they need without patching Showdown. Facts below were checked on 2026-11-24.

### Python 3.14 with uv

- macOS arm64 wheels per Python version (PyPI JSON API): torch 2.15.0 (2026-10-28) cp311–cp315, numpy 2.5.5 cp312–cp315, open-spiel 2.0.2 (Phase 2 toy checks) cp311–cp314, and poke-env 0.17.0 (S2, S6) is pure Python. So 3.14 is the newest version that every package the plan names installs on. In a scratch project, `uv sync --no-build` of all four on 3.14.7 used only wheels, and they import (`evidence/py314-deps.log`).
- Support (endoflife.date): 3.15 came out 2026-10-09. 3.14 gets bugfixes until 2027-10-01. 3.13 has been security-only since 2026-10-01.
- uv covers the interpreter version (`.python-version`), dependencies and a cross-platform lockfile (`uv.lock`) that rented Linux boxes can reuse in Phase 3. The latest release is 0.13.10 (PyPI); Homebrew has 0.13.9. With Homebrew's Python 3.14 on PATH, uv used it instead of downloading one.
- With torch 2.15.0, `torch.backends.mps.is_available()` is True and a matmul runs on `mps`.

### Node 24, TypeScript

- At the pin, Showdown requires Node ≥22.18.0 (`package.json` engines). Its CI tests only 22.x, as the oldest LTS that runs it (`.github/workflows/test.yml`). Its npm publish workflow uses 24 (`publish.yml`), and its `build` and `pokemon-showdown` scripts say "recommend 24".
- Node schedule (nodejs/Release `schedule.json`): 22 reaches end of life on 2027-04-30. Summing plan.md's phase durations from today puts that around the start of Phase 4. 24 is in maintenance LTS until 2028-04-30. 26 became active LTS on 2026-10-28, but Showdown doesn't test or recommend it. So 24 is the newest version Showdown uses itself. 22 is the runner-up: it's Showdown's CI version, but it ends mid-project.
- The smoke test passed on 22.23.2 and 24.22.3, with identical games for the same seeds. Speed per Node version wasn't measured; S1 could time it.
- `node battle.ts` runs the TypeScript file directly on both versions, by type stripping, with no build step.
- Showdown is written in TypeScript. `setup-showdown.sh` emits its `.d.ts` files for `sim/` and `sim/tools/` in under a second, with the TypeScript 7.0.2 in Showdown's devDependencies, and `battle.ts` passes strict `tsc` against them. JS would lose those checks against Showdown's API.
- Showdown's `dist/` is CommonJS without ESM export hints. A named ESM import (`import { Battle } from '.../dist/sim/battle.js'`) fails with `Named export 'Battle' not found`, while a default import or `createRequire` works.

### Showdown pin: a commit, built locally

The proposed pin is 29f2d9969159fd23f8bb96e177a70072fe573b0e, master's head on 2026-11-24. `setup-showdown.sh` shallow-fetches it into `vendor/pokemon-showdown/`, runs `npm ci` on Showdown's own lockfile and `node build`, and emits the declarations. It took about 5 s with npm's cache warm, and the checkout is ~300 MB (`du`).

At the pin (smoke test, sample teams 1 vs 2):

| Need | Result |
|---|---|
| `sim/tools/runner.ts` (S1) | 20/20 games between `RandomPlayerAI`s finished: 577 turns, 34 Mega Evolutions, 25 Z-Moves |
| `Battle` driven directly, `extractChannelMessages` (S1) | 20/20 games finished. The p1 and p2 streams have one line per `\|split\|` block and differ |
| `sim/state.ts` (Phase 1 probes, Phase 5) | In those 20 games, a copy round-tripped through `Battle.toJSON`/`fromJSON` after every choice ended with the same log and state as the original |
| `validate-team gen9nationaldex` (D4) | Accepts sample teams 1 and 2. Rejects `teams/banned.txt` with `Mewtwo is tagged ND Uber, which is banned.` |
| Local server (S2, online client) | `pokemon-showdown start --no-security` answers on `/showdown/info` |
| `sim/tools/exhaustive-runner.ts` (Phase 1) | 5 games on gen9nationaldex, 0 failures. Its pools need adapting (Gotchas) |

The other options:

Publish dates and source commits below come from the npm registry (`npm view`) and pkmn/ps's commit log, and the commit counts from `gh api repos/smogon/pokemon-showdown/compare`.

- **`pokemon-showdown` npm package:** 0.11.11 was published 2026-07-28 from 739a5e1, 315 commits behind the pin, and the release before it was 2025-02-27. A monthly re-pin can't track master this way.
- **@pkmn/sim:** 0.11.0 was published 2026-11-09 from Showdown a78551b0, 33 commits behind the pin, with 51 files changed under `sim/`, `data/` and `config/formats.ts`. It exports the runners, `State`, `extractChannelMessages` and `TeamValidator`, and its `[Gen 9] National Dex` definition matches the pin's. But it has no server and no `validate-team` CLI, it ships a curated subset of Showdown's formats, and its `Teams` parsing goes through @pkmn/sets with different defaults (its README). It had no release between 2026-06-18 (0.10.11) and 2026-10-28 (0.10.12), so a monthly re-pin could stall. Its README says projects like this would "probably be better off vendoring" Showdown.

The monthly re-pin (plan.md, Evaluation: Versioning) is in the proposed Conventions (For integration, item 3). Changes are read with a local `git diff` after fetching the new commit (changed at integration: GitHub's compare API lists at most 300 files). The pool is re-validated because a new ban can make a pool team illegal. Checkpoints already record the commit and the vocab hash, which changes when `data/` adds species, moves, items or abilities.

### Spike code: throwaway

The spikes produce numbers and choices that decide what Phase 1 builds: S1 picks `Battle` or `BattleStream`, S5 the transport, S6 the tracker. Code written to Phase 1's layout and tests before those results would be written for an unknown shape. So spike code stays in its task folder, and Phase 1 may copy from it but doesn't import it. The toolchain files (Python project, Node version, Showdown pin and setup script) are not spike code: they go to the repo root (For integration), and the spikes share them.

### Gotchas for later tasks

- `Runner`'s `dual` option throws `TypeError: stream is not async iterable` at the pin, because `getPlayerStreams` iterates its stream with `for await` and `DualStream` doesn't support that. S1 can't use it. `battle.ts` does the same State round-trip check by hand.
- exhaustive-runner's pools drop all `isNonstandard` content. On gen9nationaldex they hold none of the format's Mega Stones or 35 Z-Crystals (corrected at integration: the 93 counted every Gen 9 dex Mega Stone, including Future and CAP ones the format rejects), and no Past Pokémon such as Mawile. Adapting it to NatDex means letting in the content the format allows.
- `RandomPlayerAI` never Mega Evolves unless given a `mega` probability (default 0). `Runner.AI_OPTIONS` sets it to 0.6.
- On Node 24, Showdown's optional native dependencies (better-sqlite3, sqlite3) fail to build and npm drops them, which `--loglevel=error` hides: 219 packages vs 328 on Node 22 (cause corrected at integration). Nothing in the smoke test needs them.
- `--no-security` still works (`server/config-loader.ts`), though `pokemon-showdown help` doesn't list it.

### Not checked

- Any timing (S1, S3, S4), and Node 26.
- The server check only confirms the websocket endpoint answers. No login or game over it (S2).
- MPS: one matmul, not training or autocast (S4).
- uv downloading its own Python (it used Homebrew's), and Linux.

## Outputs

To rerun the smoke test, on macOS on Apple silicon with git, curl, nvm, uv and a Python 3.14 that uv can find (Homebrew's `python@3.14` here; uv downloading its own wasn't tried):

```bash
git clone --branch task/T01-toolchain https://github.com/ayan-s-learn/TycheBot.git
cd TycheBot/tasks/T01-toolchain
nvm install    # Node 24, from .nvmrc
./smoke.sh     # exits non-zero at the first failing check
```

Once the branch is merged and deleted, clone `main` instead. The first run downloads Showdown, its npm packages and torch (132 MiB, per uv). `evidence/smoke-node24.log` is a passing run from a clean clone, and `smoke-node22.log` a rerun in that checkout (the integration review found it reused the Node 24 one), with the commit and the elapsed time in them. `evidence/py314-deps.log` is the scratch install of torch, numpy, poke-env and open-spiel.

| File | What it is |
|---|---|
| `smoke.sh` | Runs all the checks, in order |
| `setup-showdown.sh`, `showdown.pin` | Fetch and build Showdown at the pinned commit into `vendor/` |
| `battle.ts`, `tsconfig.json`, `package.json` | In-process battles, the State round-trip and the exhaustive runner. `smoke.sh` type-checks `battle.ts` first |
| `teams/` | Smogon's NatDex sample teams 1 and 2 (entries 0 and 2 of pkmn.github.io/smogon/data/teams/gen9nationaldex.json), and sample 1 with Mawile replaced by Mewtwo |
| `check-server.sh` | Starts the local server and queries `/showdown/info` |
| `pyproject.toml`, `uv.lock`, `.python-version`, `mps_check.py` | The uv environment and the MPS check |
| `.nvmrc` | Node 24 |

