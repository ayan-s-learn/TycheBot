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

## Result

## Outputs

## For integration
