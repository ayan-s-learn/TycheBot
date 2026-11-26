# Token-layout deliberation

Added by the planning session, 2026-11-26. After T07, plan.md's token count was still open. An Opus agent compared v0 token layouts. The user adopted its recommendation on 2026-11-26 (plan.md, Network v0 and Phase 2). Run everything from this folder.

- **Layouts** (`net.py`, an extended copy of T07's): `5M@33enc` passes each mon's 4 moves (embedding, dex features, the move's 6 calcs) through a shared 2-layer MLP. It then sum- and max-pools them into the mon token. `5M@37enc` adds the opposing active's 4 moves as tokens, and `5M@39enc` adds 6 matchup tokens (each own mon against the opposing active) instead.
- **FLOPs** (`uv run python flops.py`), training GFLOP per decision per epoch: 0.831 at 33 tokens, 0.839 with the encoder, 0.940 at 37, 0.990 at 39, 1.337 at 53 and 1.963 at 77.
- **Timing** (`quick.py`, run as `uv run python quick.py quick.jsonl 5M@33,5M@33enc,5M@37enc,5M@53` under the timing lock; bf16, 3 interleaved rounds, load 2.2–3.4). Medians, training decisions/s at minibatch 1024: 4,967 at 33, 4,869 with the encoder (−2%), 4,385 at 37, and 3,110 at 53. T07 measured 4,514–5,046 at 33 and 2,925 at 53 at that minibatch.
- **Revealed opposing moves** (`uv run python revealed.py ../../../data/replays/v0/replays.jsonl.gz`, T04's 1,000 replays, both players' views at 49,103 turn starts):
  - On average 40% of the opposing active's moves are revealed (median 25%), and none at 23% of decisions.
  - Across the whole unfainted opposing team, the share is 26%.
  - For the active, it rises from 23% in turns 0–9 to 61% in turns 30–39.
- **Recommendation:** 33 tokens with the per-move encoder. Adding move tokens later is cheap surgery, while removing them needs distillation. An equal-wall-clock A/B against 53 tokens, both with the encoder, would settle it early in Phase 2: ~3 days each on the M4 Max, scored by SPRT on duplicate games, with checkpoints at equal game counts.
