# T11: PPO learner and toy checks

## Brief

- **Objective:** build the learner away from Showdown, so Phase 2 starts from a working one (plan.md, Phase 1: In parallel). That covers PPO with GAE, Training v0's regularizers and value-gradient scaling, turn-cap truncation, and the snapshot store for the league. Toy games with known answers check it.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout and Tests. OpenSpiel 2.0.2 is in `pyproject.toml`.
  - D3, D6 and D10 (all of it).
  - plan.md: Training v0 (Regularization, Collection, League); Network v0 (Action head: 18 masked actions; Other heads); Compute (the M4 Max bullet: bf16 autocast and the minibatch sizes T07 found fastest).
  - T07's `net.py` (the stand-in net and PPO loss), to copy from.
  - prior-work.md: MissingNo's value-gradient finding, Jaxcalibur's KL term, and time-limit bootstrapping (Methods).
- **Deliverables:**
  - `tyche/learner/`, running on MPS under bf16 autocast:
    - PPO + GAE, with KL(uniform‖π) over legal actions plus the entropy bonus;
    - the value gradient into the trunk scaled down, with the value/policy gradient ratio logged;
    - a turn cap treated as truncation that bootstraps from V(s);
    - synchronous collection, built so it can go asynchronous later without a rewrite (D10): each stored decision carries its behavior log-prob and the version of the policy that chose it, and the clip fraction is logged;
    - a snapshot store and opponent sampling: half of games against the latest policy, half against past snapshots, weighted toward the ones it loses to.
  - The env interface the learner consumes, as a Python protocol in `tyche/learner/`. It carries batches of decisions from two-player games: observations as arrays, the legal-action mask, which side is trained, rewards, and episode end versus truncation. T09's batch env will be adapted to it later, so keep it independent of T09's record format.
  - `tyche/toy/`: toy envs behind that interface, and the checks below. OpenSpiel supplies the matrix games and exploitability.
  - `docs/areas/learner.md`. Propose the AGENTS.md Areas row under For integration.
- **Acceptance checks,** each a pytest test (AGENTS.md, Conventions: Tests) or a run that Outputs reproduces. They run with D10's KL term and the entropy bonus on, at the coefficients Result proposes for Phase 2. Where those shift the fixed point, as in the non-uniform game, measure against the regularized game's equilibrium and report how far it lies from the true one.
  - Rock-paper-scissors self-play ends near uniform: the final policy's exploitability is below 0.05.
  - A matrix game with a non-uniform mixed equilibrium, such as biased rock-paper-scissors, ends within 0.05 of that equilibrium.
  - A small sequential game with a known answer, such as Kuhn poker: exploitability below a bar you state in Progress, with its reason, before the run.
  - Truncation: on a toy env with a cap, the value at capped steps matches the analytic value within a tolerance you state, and treating the cap as terminal misses it by at least 5× that tolerance.
  - A test feeds the learner decisions from a policy one update older than the current one and checks the PPO ratio uses their stored log-probs.
  - The toy results rerun on a clean checkout and pass the same bars.
- **May change:** `tyche/learner/`, `tyche/toy/`, `docs/areas/learner.md`, `tasks/T11-learner/`.
- **Limits:** up to three sessions, no paid services. Take any timings as in AGENTS.md, Conventions (Timed runs).
- **Stop and report if:**
  - PPO with D10's KL term doesn't end near uniform on rock-paper-scissors.

## Progress

## Result

## Outputs

## For integration
