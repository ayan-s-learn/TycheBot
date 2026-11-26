# T10: Tracker fix layer and ground truth

## Brief

- **Objective:** the tracking core of the observation builder (D7), and the harness that shows it works. That means a layer over @pkmn/client 0.7.4 with the fixes T08 and its edge-case passes found, and a check against the sim's state at every decision. This starts the observation builder, Phase 1's long pole (plan.md), and works toward Phase 1's Ground truth exit.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout and Tests.
  - D7. plan.md: Format facts; Network v0 (the fields the observation uses: Tokens, Mega and Z flags); Phase 1 exit (Ground truth, Leak tests, Robustness).
  - T08's README: Result (the mismatch classes and Fixes) and Edge-case passes. The passes add `-prepare`, plain Wish, Gastro Acid, Yawn and `addedType`, and show that Illusion re-attribution is harder than T08 estimated.
  - Code to copy from, not import: T08's harness (`record.ts`, `sim.ts`, `truth.ts`, `pkmn.ts`, `compare.py`), `edge-red/layer.ts` as the starting layer, and the edge-case scenario scripts (`edge-red/`, `edge-blue/gen.ts` and `scenarios.ts`) as the seed of the scenario suite.
  - T04's replays (`data/replays/v0/`), for the parse check.
- **Deliverables,** in `worker/tracker/`:
  - The layer: a subclass of the client's `Battle`, as `layer.ts` is, so T09's worker can switch to it by changing an import.
    - It carries every fix in T08's list and the edge-case passes, including the Regenerator estimate for species with only one possible ability.
    - It keeps an allowlist of the message types the client may ignore. Any other type is an error.
  - A ground-truth harness. It records games with its own copy of the recorder (T09 builds `worker/sim/` in parallel; merging the two is later work), replays them for the sim's state, and diffs the tracked state as T08's `compare.py` does.
    - Node or Python is your choice, as long as it lives in this folder.
    - It covers the fields T08 compared, plus own-side PP and the toxic and sleep counters.
  - A scripted-scenario suite: each scenario is a fixed-seed game with chosen inputs and the expected state at chosen decisions. At least these:
    - Wish, Healing Wish and Lunar Dance; Future Sight into a faint;
    - two-turn moves; Transform and Imposter, on both sides;
    - Illusion breaking, fainting in disguise, and the player's own;
    - Mega Evolution and Z-Moves; Regenerator; Gastro Acid; Yawn; type changes; `-*` formes.
  - `docs/areas/observation-builder.md`: what the layer fixes, the harness commands, the mismatch classes left and why, and gotchas. Propose the AGENTS.md Areas row under For integration.
- **Acceptance checks:**
  - On ≥10k random-player games from new seeds (not T08's 0–499), on the fields listed above, every mismatch class is listed with its cause (a tracker bug, unsupported content, or information the player isn't shown) and a count. Under 0.5% of all decisions in those games have a tracker-bug or unsupported-content mismatch (plan.md, Phase 1 exit). For each class, also give the share of the decisions where its mechanic is present, so that a rare mechanic that is always wrong stands out. "No mismatch beyond information the player isn't shown" is the bar at Phase 2's online gate, not this task's. Max-damage games join the check once the baselines exist (checklist, Later in Phase 1).
  - The scenario suite passes as tests (AGENTS.md, Conventions: Tests).
  - No throws and no message type outside the allowlist, on the 10k games and on T04's 1,100 replays.
  - The harness reruns from Outputs on a clean checkout with identical counts.
  - `tsc -p tsconfig.json` passes.
- **May change:** `worker/tracker/`, `docs/areas/observation-builder.md`, `tasks/T10-tracker-layer/`.
- **Limits:** up to four sessions, no paid services. No timing is needed: T08 measured tracking at 0.018 ms per decision.
- **Stop and report if:**
  - a fix needs changing @pkmn/client's own code or forking it, which D7 says the layer avoids;
  - the observation needs a field that can't be tracked without information the player isn't shown.

## Progress

## Result

## Outputs

## For integration
