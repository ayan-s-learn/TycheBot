# T19: The 5M net

## Brief

- **Objective:** Network v0's net, the one the v0-lite run trains (plan.md, Phase 1). It is built in parallel with T16 against the 33-token input of T07's stand-in, which T16's tensorizer emits or extends. That keeps the net off the critical path behind T16. v0-lite needs the policy, value and lead heads only. The aux heads wait for a design of their training labels, which nothing yet produces.
- **Inputs:**
  - Setup (AGENTS.md, Conventions), including Layout, Tests and Python entry points.
  - plan.md, Network v0: Tokens, Moves inside mon tokens, Damage calcs (the opposing active's fixed column), Static dex features, Mega and Z flags, Size, Action head, Other heads. Also Compute, the M4 Max bullet.
  - T07's stand-in, `tasks/T07-mps-throughput/tokens/` (`net.py`, `bench.py`, README): its 33-token layout, trunk, per-move MLP and heads, fed synthetic inputs. Copy from it; don't import it.
  - T16's brief (Python side): the tensorizer emits the stand-in's batch format or a documented superset, with feature widths T16 documents. Until T16 publishes them, take widths from a config whose defaults are the stand-in's.
- **Deliverables:**
  - `tyche/net/`: the net, configurable in d, layers and the feature widths, and running on MPS under bf16 autocast. At the v0 size (d=256, 5 layers, pre-RMSNorm) it has ~5M parameters.
    - The shared per-move MLP is pooled into each mon token by sum and max. The active mon's 4 move tokens are built from the same per-move outputs.
    - Tokens carry type embeddings, not per-slot positions. Calcs keep the opposing active in a fixed column.
    - Heads: the 18 masked action logits (plan.md, Action head), the value (win probability), and Team Preview's lead, reusing the switch logits.
  - A loader for T16's documented layout once it lands, and a test on real version 2 records then.
  - `docs/areas/net.md`: the net's config, its input format with a link to env-workers.md for version 2, its heads, checkpoint contents (plan.md, Versioning: commit, obs version, vocab hash, pool version), and commands. Propose the AGENTS.md Areas row under For integration.
- **Acceptance checks:**
  - Tests (AGENTS.md, Conventions: Tests):
    - Masked actions get zero probability.
    - Permuting a mon's 4 move slots, together with their calcs and features, leaves that mon's token unchanged.
    - Permuting the opposing bench, with the active fixed, permutes only what it should.
    - The parameter count is within 10% of 5M at the v0 size.
    - A checkpoint saves and loads with its versions.
  - Throughput on MPS at 33 tokens, on synthetic batches, under the timing lock (3 runs): inference and training decisions/s at T07's fastest minibatch, against T07's stand-in figures (plan.md, Compute). A gap over 15% either way is explained.
  - If T16 has merged, the net runs forward and backward on real version 2 tensors. If not, Result says so, and the next replan assigns it.
  - `uv run pytest` passes.
- **May change:** `tyche/net/`, `docs/areas/net.md`, `tasks/T19-net-v0/`.
- **Limits:** up to two sessions, no paid services. Take the timed runs on the user's Mac, under the timing lock (AGENTS.md, Conventions: Timed runs).
- **Stop and report if:**
  - the net at the v0 size trains more than 25% slower than T07's stand-in, which would change T07's learner estimate that D7 and D10 rest on.
- **Watch for** (final review of PR #12, 2026-11-28). Context, not added requirements; use your judgment:
  - Permuting the opposing bench also permutes the calc columns each own mon carries, so the test has to move those columns too, or it passes or fails for the wrong reason.
  - T07's stand-in without aux heads has ~4.6M parameters (the independent review's count), inside the 10% bar, so there's no need to pad to 5M.
  - T16 is asked to put its tensor keys, shapes and widths in its Progress once they're fixed (branch `task/T16-*`).

## Progress

## Result

## Outputs

## For integration
