# Prior work

Snapshot as of 2026-11-22. All numbers are self-reported by the authors and were not reproduced here. None of the 87 projects in [pkmn.ai's index](https://pkmn.ai/projects/) targets National Dex.

## Summary

| Bot | Format | Method | Engine | Compute | Result |
|---|---|---|---|---|---|
| [Jaxcalibur](https://jaxcalibur.github.io/) (Aug 2026) | Gen 9 Random Battle | PPO self-play, no search in training; regret-pUCT search at play time | Custom pure-JAX engine, closed | ~1 week on 1×H100, ~100M games | #1 ladder; peak 2557 Elo / 95.3 GXE |
| [mikumiku37](https://www.smogon.com/forums/threads/mikumiku37-a-self-play-vgc-bot-reached-1-on-the-vgc-reg-m-c-ladder.3789199/) (Oct 2026) | Champions VGC Reg M-C (doubles, Bo1) | PPO self-play + past-snapshot league; 1-turn matrix-game search at play time | Custom Rust engine, closed | 48.3 h on 1×RTX 5090, ~330M games | #1 ladder; 1857 Elo / 81.2 GXE |
| [MissingNo.Zero](https://nickgreenquist.com/blog/projects/2026/11/02/missingno-zero-self-play-pokemon-showdown/) (Sep–Nov 2026) | Random Battle, gens 1/2/4/6/7/9 | PPO self-play vs past versions; short look-ahead at play time | Showdown's own simulator | Gen 1: M4 Pro laptop, 40 h, ~2.6M games. Gens 6/7: ~16M games each. Gen 9: ~49.5M games, ~9 days rented GPU, ~$350 (before later optimizations). Whole project ~$2.1k ([README](https://github.com/nickgreenquist/missingno-zero)) | #1 in all six; gen 9 peak ~2420–2460 Elo |
| [PokaiTrainer](https://arxiv.org/abs/2608.29197) (Aug 2026) | Champions VGC Reg M-B, open team sheets, Bo3 | Behavior cloning, then ReBeL-style CFR search inside self-play | Custom Rust, ~99% turn parity | ~83k games (from its round schedule); ~250 L40S-h self-play + ~15 A100-h training | Settled at 1350–1400 Elo; 59% of 150 sets |
| [Foul Play](https://github.com/pmariglia/foul-play) (2019–) | All gens singles, incl. Gen 9 OU | MCTS over sampled opponent sets (narrowed by observed damage, speed and moves), hand-written eval, no learning | [poke-engine](https://github.com/pmariglia/poke-engine) (Rust) | CPU | ~2341 Elo randbats peak (top ~50) |
| [Metamon](https://arxiv.org/abs/2504.04395) (2025–) | Gen 1–4 OU, later Gen 9 OU | Offline RL + imitation on ~475k reconstructed human replays; Transformers up to 200M params | poke-env + Showdown | — | Gen 9 OU ~71% GXE ([PokéAgent paper](https://arxiv.org/abs/2603.15563)) |
| [Wang 2024](https://dspace.mit.edu/handle/1721.1/153888) (MIT thesis) | Gen 4 Random Battle | PPO self-play | Showdown | — | Peak #8, 1693 Elo. MissingNo's starting PPO recipe |

The [PokéAgent Challenge paper](https://arxiv.org/abs/2603.15563) (NeurIPS 2025) rates agents with full-history Bradley-Terry rather than Showdown Elo, which it calls too noisy.

## The 2026 recipe

The three #1 bots share one recipe. Jaxcalibur introduced it. mikumiku says it adapted Jaxcalibur's write-up. MissingNo dropped search during training after reading it, calling that approach a dead end it had been stuck on. So this is one recipe confirmed in three formats, not three independent findings. None of the three is a teambuilder singles format.

1. **Training:** PPO self-play with a terminal win/loss reward. No reward shaping, no human data.
2. **Model:** a small transformer. Sizes: MissingNo ~3M, PokaiTrainer 5.4M, Jaxcalibur 8.5M, mikumiku ~8.7M. Jaxcalibur found smaller nets trained longer beat larger ones.
3. **Search only at play time.** Gains:
   - Jaxcalibur estimates +100–150 Elo (not ablated).
   - mikumiku's net alone peaked at 1747. With search it reached #1 at 1857.
   - MissingNo saw small gains, and only after gating (see below).
4. **Throughput decides how far you get.** Jaxcalibur and mikumiku wrote custom engines for it. MissingNo stayed on exact Showdown and still reached #1. It tried per-gen ports and found them slow to build and never quite exact.

## Details worth copying

### Jaxcalibur
- **Tokens:** 1 field, 2 active Pokémon (stats, moves, damage calcs), 5 move tokens (+Struggle), 6 own team, 6 opponent team (masked until revealed), 16 recent events, 24 pairwise matchup tokens (damage calcs) added halfway through the net.
  - Pre-RMSNorm transformer with separate MLP weights per token type.
- **Heads:**
  - Actions: a switch logit per team slot, plus plain and Tera logits per move.
  - Value: win probability.
  - Auxiliary: opponent item, ability, moves and Tera type per Pokémon, plus the opponent's next action. The author says the next-action head made the bot substantially stronger.
- **Regularization:** entropy plus a small "zero-avoiding" KL-to-uniform term, i.e. KL(uniform‖π), so situational moves like Encore never drop to ~0 probability.
- **Search:**
  - Nodes live in a dict keyed by state hash; there is no explicit tree. There is no chance branching: each rollout uses a new RNG seed. HP is binned into 10 buckets.
  - Budget: depth 4, 20,480 rollouts over 32 sampled opponent "worlds", a few seconds on a GPU.
  - Simultaneous moves: edges are sampled ∝ max(Q−V, 0) + c·P/√N, which tends to regret matching as visits grow.
- **Hidden-info leak guard:** opponent-side search stops when the simulated opponent does something "surprising" (switches to an unrevealed Pokémon, or uses a move the opponent's view gives <65%). Otherwise search leaks hidden information.

### mikumiku37
- **Engine:** Rust, ~7k random battles/s per core, ~650× Showdown. Collection runs at ~100k steps/s including inference.
  - Batching: 8,192 parallel battles × 32 steps per update. The PPO update takes ~70% of wall time, so the 5090 is learner-bound.
- **League:** ~50% of games vs the current policy, the rest vs past snapshots, weighted toward the ones it still loses to. Never ablated against pure self-play.
- **Teams:** ~1,260 public tournament teams, some with guessed EV spreads. On ladder it plays a random team from the 10 best in training. Generalization to unseen teams was not reported.
- **Observation:** own-view battle plus static dex data only. No damage calc, usage stats or speed resolver.
- **Search:**
  - Each move: 1 turn deep, 16 sampled worlds, the policy's top 8 own actions × top 8 opponent replies.
  - Each cell is stepped through the real engine with several RNG seeds and scored by the value net. The matrix is solved with regret matching, blending worst-case and expected value.
  - 4 seeds per cell caused bad plays on outlier worlds. The bot uses 16; the author thinks 64–128 is ideal. Deepening endgame search gave no measurable gain.
- **Reported weakness:** it rarely expects a plain attack (players exploited this with Kingambit).

### MissingNo.Zero
- **Engine:** trains on Showdown's simulator. Gen 9 throughput was ~230k games/h (~64/s, ~$7 per million games), and ~740k games/h on one GPU box after optimization (~$1.80 per million). Core counts were not given. These figures are in the repo README, not the blog.
  - After optimization, the author projects a ~50M-game run at ~$90 and ~3 days.
- **Cost:** final runs cost ~$160 (gen 2), ~$230 (gen 4), ~$170 (gen 6), ~$220 (gen 7) and ~$350 (gen 9), ~$1.13k in all. The whole project, dead ends included, cost ~$2.1k, so about half went to dead ends (README).
- **Vs Foul Play:** the #1 gen 9 net won 66.7% of 3,000 games without search.
- **Search hurt at first** (−6.8 pp on gen 1). Search overruled the net on 72.8% of moves, the optimizer's curse on noisy values.
  - Fix: override the net only when search beats its pick by a clear margin. Overrules fell to 8.5%, and search went to +1.6 pp.
- **Value gradient into the shared trunk was ~50× the policy gradient.** The net predicted winners well but played poorly, ignoring status and Tera.
  - Fix: let only a fraction of the value gradient reach the trunk, use a shorter advantage horizon and an entropy schedule, and auto-pause when the ratio climbs.
- **Gen 2 sleep bug:** the net keyed on "did I just use Rest?" instead of "am I asleep?". Lesson: check that observations expose the real state.
- **Random-battle sets change monthly,** so each run trains on the current month's sets.
- **Ladder:** played under Showdown's bot registry (opened 2026-10-13), with "bot" in every account name. Since 2026-10-20, bots are matched only with players who opted in and with other bots ([staff thread](https://www.smogon.com/forums/threads/3789528/)). Its bot accounts appeared on the public top-10 boards (blog screenshots).

### PokaiTrainer
- The only serious search-in-training (AlphaZero/ReBeL-family) attempt. Each decision is a Bayesian matrix game solved with linear CFR. Beliefs over opponent worlds are reweighted by how likely the engine makes the observed outcome.
- **Findings:**
  - Search beat the raw policy everywhere (71% pooled).
  - A belief summary in the encoder was worth +8–12 pp.
  - Decoupled UCT matched CFR on win rate but was far more exploitable: a local best response beat it 83.6%, vs 49.6% against CFR.
- **Result:** it ended well below mikumiku on a related format. That comparison is confounded three ways: ~83k vs ~330M games, open vs closed team sheets, and Reg M-B vs M-C.
- **Team choice:** its corpus-top teams went 56.3% of 142 sets on ladder, vs 58.7–60.0% for its default teams (uncontrolled). Self-play team ratings correlated only weakly with a deeper round robin (Spearman +0.38, from a summarized appendix).
- **Parity method:** a 500-turn regression suite (499 of 500 turns matched after fixes), plus 527 human replays (3,452 turns) whose public state matched every turn.

### Metamon
- The offline-RL alternative to self-play. Its tooling rebuilds each player's first-person view from spectator replays.
- PokéAgent released 4M human demos and 18M synthetic battles, but only for Gen 1 OU and Gen 9 OU.

## Engines

| Engine | Lang / license | Coverage relevant to NatDex | Notes |
|---|---|---|---|
| Pokémon Showdown sim | JS / MIT | Exact, the reference | PokaiTrainer measured ~2.0 ms per median turn per Node process (VGC doubles). No singles figure found |
| [poke-engine](https://github.com/pmariglia/poke-engine) | Rust / MIT | Singles only; gens 1–9 via Cargo features; Tera; Mega Evolution (v0.0.48, Jul 2026). No mention of Z-Moves or National Dex | Built for expectiminimax/MCTS, with damage-roll branching by KO relevance. The author says it is "not a perfect engine". Python bindings are WIP. Foul Play recognizes the `nationaldex` format, but its README says Z-Moves aren't supported |
| [Haleclipse/PokemonBattleEngine](https://github.com/Haleclipse/PokemonBattleEngine) | Rust / GPL-3.0 | Gens 1–9, singles and doubles; Megas only in gens 6–7 and Z-Moves only in gen 7, so no NatDex | Frame-by-frame differential tests against `@pkmn/sim` (2,800+ battles, nightly random fuzzing, auto-minimizer). A good model for parity testing |
| [colefoster/vgc-engine](https://github.com/colefoster/vgc-engine) | Rust / MIT+Apache | Gen 9 doubles only | 2,042 commits. Published parity reports: 97.9% of 1,300 ladder battles fully clean, 99.76% of turns. Has `clone()`, `step_chance()` (outcomes with probabilities) and `position_from_replay` |

## Reusable code

Checked 2026-11-22.

| Repo | License | What to use | Caveats |
|---|---|---|---|
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) | MIT | `sim/tools/runner.ts` as the S1 harness base. `sim/tools/exhaustive-runner.ts`, which cycles every species, move, item and ability through random-AI games, for mask fuzzing. `sim/state.ts` (serialize and deserialize a `Battle`) for the Phase 5 synthesizer | The exhaustive runner targets custom-game formats by default |
| [poke-env](https://github.com/hsahovic/poke-env) | MIT | Python battle-state tracker that handles `-mega` and Z-Moves, and a Showdown websocket client (D7, spike S6) | Its gen 9 Python damage calc ignores Megas and Z-Moves (comment in `damage_calc_gen9.py`). Speed not measured |
| [Metamon](https://github.com/UT-Austin-RPL/metamon) | MIT | `backend/team_prediction` fills unrevealed sets by matching revealed teams to complete teams seen in replays (D4, Phase 3). `backend/replay_parser` rebuilds a player's view from spectator replays. `backend/team_construction` has a team-vs-team win model and an equilibrium solver (D4, Phase 4) | Built for gen 1–4 OU and gen 9 OU, and `ReplayPredictor` (the coherent set filler) supports gen 1–4 only. Its raw replay dataset (`metamon-raw-replays`, 2.7M battles) has no NatDex |
| [Foul Play](https://github.com/pmariglia/foul-play) | GPL-3.0 | Eval opponent, run as a separate process. Its set narrowing by speed and damage is the reference for that idea | Don't copy its code: GPL would bind this repo |
| [OpenSpiel](https://github.com/google-deepmind/open_spiel) | Apache-2.0 | Matrix games, regret matching and exploitability, for the Phase 2 toy checks and Phase 5 search | |

MissingNo.Zero's repo has only a README and a PDF, with no code and no license.

## Methods from other fields

- **SPRT** ([Stockfish fishtest](https://github.com/official-stockfish/fishtest)): run an A/B test until the result clears preset bounds, which stops early when the gap is large. Its pentanomial model scores games in pairs, which matches seat-swapped duplicate games. Used in plan.md, Evaluation.
- **Time-limit bootstrapping** ([Pardo et al. 2018](https://arxiv.org/abs/1712.00378)): treat a step cap as truncation and bootstrap from the value, not as a terminal state. Used in D10.
- **Surgery** ([OpenAI Five](https://arxiv.org/abs/1912.06680)): carry trained weights across changes to the inputs or architecture instead of retraining, with new inputs initialized so the old function is unchanged. Used in plan.md, Versioning.
- **Exploiter agents** ([AlphaStar](https://www.nature.com/articles/s41586-019-1724-z)): agents trained only to beat the frozen main agent, to expose its weaknesses. Planned for Phase 3+ (plan.md, League).
