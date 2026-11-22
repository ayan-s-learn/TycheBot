# Plan

Draft, 2026-11-22. Choices tagged D1… are argued in [decisions.md](decisions.md). Background and sources are in [prior-work.md](prior-work.md).

## Goal

A self-play RL bot for [Gen 9] National Dex OU (`gen9nationaldex`) on Pokémon Showdown. The target is top 10 on the public board, then #1, with up to $1k of rented compute (D9).

## Format facts

From Showdown master and the Oct 2026 usage stats, verified 2026-11-22. Only the rules that change what the bot sees or does are listed; the sim validates the rest.

- **Rules:**
  - Tera is banned (`Terastal Clause`).
  - Megas and Z-Moves are legal: no clause bans them, and both are used. Oct 2026 had Diancie-Mega at 9.1% and ~0.5 Z-Crystals per team (research agent's count).
  - Team Preview, `+Past` and `+Unobtainable` content (past Pokémon, moves and items), Endless Battle Clause, Sleep Clause Mod.
  - Battles auto-tie at turn 1000 (`sim/battle.ts`).
- **Team Preview does not reveal everything:**
  - Some formes show as `Species-*`: Urshifu, Greninja, Gourgeist, Pumpkaboo, Xerneas, Silvally, Dudunsparce, and Zacian/Zamazenta unless Crowned. Urshifu-Rapid-Strike (8.0%) and Zamazenta (11.6%) are in the top 25.
  - Megas show as their base species.
  - Illusion can disguise a mon.
- **Usage stats:** published monthly at cutoffs 0, 1500, 1630 and 1760. 1760 is the highest; Oct 2026 had 419k battles.

What differs from the three #1 bots (random battles and VGC doubles):

- **Teams:** random-battle bots got teams from the generator. Here, as with mikumiku's VGC bot, self-play needs a team pool, and in singles the pool's set library is also the prior over hidden sets (D4).
- **Hidden information:** the opposing roster is mostly known from turn 0, apart from the forme cases above. Moves, item, ability, spread, which mon holds the Mega Stone, and who carries a Z-Crystal stay hidden.
- **Actions:** no Tera, but each move has Mega and Z variants.

## Approach

This follows the 2026 recipe (prior-work.md):

- PPO self-play over a pool of NatDex OU teams, with opponent sets resampled each game (D4).
- A small transformer with damage-calc inputs and auxiliary belief heads.
- Search added at play time only (D3).

Training runs on Showdown's simulator through the first scale-up. A Rust engine is a gated side track (D2).

## Components

1. **Env workers:** Node processes that drive Showdown's `Battle` directly. `BattleStream` is marked not finalized. Many battles run per process, batched to Python.
2. **Observation builder** (D7): Python, in env processes separate from the learner. Reads each player's protocol stream and request JSON, requests damage calcs from the Node workers in one batch per step, and emits tensors. Used for both training and online play.
3. **Network:** PyTorch (D6).
4. **Learner and actors:** PPO + GAE with asynchronous collection (D10), plus a snapshot store for the league.
5. **Team pool and set priors** (D4).
6. **Eval harness:** runs in-process with fixed baselines, snapshot ratings and held-out teams. A local Showdown server is used only for the online client and Foul Play.
7. **Online client:** a Showdown websocket feeding component 2.
8. **Later:** play-time search (D8), and the Rust engine if gated in (D2).

## Network v0

- **Tokens:**
  - Field: weather, terrain, per-side hazards and screens, Trick Room, turn.
  - 6 own mons: species, ability, item and move embeddings, plus stats, HP, status, boosts and volatiles.
  - 6 opposing mons: species from preview (with `-*` formes unresolved), revealed attributes, an "unknown" embedding otherwise.
    - Evidence that outlasts the event window: the speed order seen against each of our mons, and the largest damage seen relative to the calc.
  - Active moves.
  - The last ~16 events.
  - Damage calcs: own moves vs each opposing mon and theirs vs ours, against species-level priors (D7).
- **Static dex features:** species tokens also carry base stats and types, and move tokens carry base power, type, category, priority and flags. The ladder will show species the pool never trained, whose ID embeddings alone would be untrained (mikumiku used static dex data). Items and abilities rely on embeddings in v0.
- **Mega and Z flags:** whether a Mega or Z-Move is still available this battle, and whether this mon could use one.
- **Size:** 3–9M params, pre-RMSNorm, about 45–80 tokens.
- **Action head:**
  - 4 moves × {plain, Mega Evolve, as Z-Move}, plus a switch logit per team slot. Masked by the request.
  - Map moves by the request's current index: the move list shrinks for locked moves, Struggle and Recharge, and switching reorders `side.pokemon`.
  - When a choice is rejected as `[Unavailable choice]` (for example, trapping by a hidden ability), re-query the policy, both in training and online.
  - A mon can't Mega and Z in one game because both need its item slot.
- **Other heads:**
  - Team-preview lead, reusing the switch logits. In singles only the lead matters, except with Illusion, which copies the last party slot.
  - A value head (win probability).
  - Aux heads per opposing mon: moves, item, ability, spread bucket. Plus the opponent's next action (Jaxcalibur).

## Training v0

- **Reward:** +1 win, −1 loss, 0 tie.
  - Turn cap: start at 300 and tune from game-length data. Capped games are truncated and bootstrap from V(s) (D10). Log the cap-hit rate.
- **Regularization:** entropy plus KL(uniform‖π) over legal actions (Jaxcalibur, D10). Scale down the value gradient into the trunk, and log the value/policy gradient ratio (MissingNo).
- **Collection:** asynchronous, on a policy at most one update stale (D10).
- **League:** half of games vs the latest policy, half vs past snapshots, weighted toward the ones it loses to (mikumiku).
  - Later (Phase 3+): exploiter agents (prior-work.md, Methods), to find holes like mikumiku's Kingambit weakness before humans do.
- **Teams:** sampled and resampled per D4.

## Compute

These are estimates; Phase 0 spikes replace them.

- **Env:**
  - ~2.0 ms per median turn per Node process (PokaiTrainer, VGC doubles). No singles figure found.
  - MissingNo ran gen 9 on Showdown at ~64 games/s (~$7 per million games). After optimization it reached ~205/s (~$1.80 per million) on one rented GPU box (its README).
- **M4 Max:**
  - Assume 0.5–3M games/day until measured, probably limited by the learner.
  - A 5M-param net over ~80 tokens costs ~2.4 GFLOP per decision step per PPO epoch.
  - MPS has no autocast, so plan on fp32.
- **Games needed:** MissingNo reached #1 in gens 6 and 7 at ~16M games and in gen 9 at ~49.5M. For NatDex top 10, guess 15–50M.
- **Rented:**
  - While Showdown is the env, the CPU count is probably the cap. RunPod 5090 pods have only 9 vCPUs, so filter vast.ai for many vCPUs (≥48 is a guess until S1). The GPU class matters less.
  - At 3–5× MissingNo's optimized cost for longer NatDex games with calcs, 50M games is ~$300–450.
  - MissingNo spent about half its total on dead ends (prior-work.md). At that ratio, $1k leaves ~$500 for a final run: ~60M games at the D2 gate's $8 per million.

## Phases

Each phase ends at its exit criteria. Durations are a planning agent's estimates for a solo developer with Claude Code.

0. **Decisions and spikes (1.5–2 weeks).**
   - Spikes. S1, S3 and S4 record numbers that replace the Compute estimates, and S3 applies D7's 30% calc rule. S2 passes when every difference is documented.
     - S1: sim harness, `Battle` direct vs `BattleStream`, starting from Showdown's `sim/tools/runner.ts`. games/s per core and turns per game.
     - S2: diff a game's server streams against the in-process streams (`rqid`, room lines, `|split|` handling).
     - S3: µs per damage calc and calcs per decision, with a cache.
     - S4: MPS training and inference samples/s for 3M/5M/9M nets, with CPU fallback disabled.
     - S5: transfer overhead for Python↔Node (including the batched calc round trip) and for the env→inference hop, with Python parsing measured separately. Target: <10% of step time for transfer.
     - S6: poke-env's battle tracker vs our own (D7). Time it on recorded streams and check its Mega, Z-Move and Illusion handling. Ends with a fork-or-write recommendation for the user.
   - A 20-team validated stub pool.
1. **Env and plumbing (M4 Max, 5–7 weeks).**
   - Build: env workers, observation builder, action masks, damage-calc tokens, the Python batch env, the ~50-team pool, baselines (random, max-damage), the eval runner, and the online client.
   - The observation builder is the long pole (2–3 weeks).
   - Exit, all passing:
     - **Ground truth:** across ≥10k games, the tracked state matches the sim at every decision, for every field the observation uses.
       - This includes sleep and toxic counters, which the builder must track itself.
       - Fields the player can't see are covered by the leak tests below.
     - **Leak tests:**
       - Two opposing teams that differ only in content never revealed must produce bit-identical tensors.
       - Opponent features built from the player stream must match those built from the spectator stream.
     - **Action masks:** fuzzed over 1M requests with `strictChoices`, from policy games and from Showdown's `exhaustive-runner.ts` (adapted to NatDex), which cycles every species, move, item and ability. No legal action masked, no illegal one unmasked.
     - **Robustness:** ≥1,000 public replays parse without error. This covers the protocol parser only, since replays carry no request JSON.
     - **Online parity:** live tensors equal an offline re-parse of the same game.
2. **PPO v0 (M4 Max, 5–8 weeks).**
   - Build:
     - Toy checks first: rock-paper-scissors ends near uniform, small endgames have known answers. OpenSpiel's matrix games and solvers supply the reference answers.
     - Then the full v0 net and training on the ~50-team pool, with 10 teams held out.
   - Exit:
     - >90% vs max-damage.
     - Snapshot ratings still rising at the end of the run.
     - Held-out-team win rate reported.
     - A read-through of sample games shows sane switching, hazard play, and Mega/Z use.
   - Then:
     - ~50 low-stakes rated games with this policy, on its best self-play pool team. They test the online client against the live server and give a first rating against opted-in players and other bots (prior-work.md, MissingNo ladder).
     - After profiling and optimizing the env, a 2-hour rented trial measures $ per million games. This is the D2 gate.
3. **Scale on Showdown (rented, 2–3 weeks).**
   - Build:
     - A Docker image, checkpoint sync, and a watchdog. A run must survive `kill -9`.
     - Replays rebuilt into a player's view, for aux-head calibration (D4 checks), starting from Metamon's `replay_parser`.
     - The pool grows per D4.
   - Run: 30–50M games.
   - Exit: beats the strongest snapshots and Foul Play, each by SPRT (Evaluation). Foul Play only on Z-free teams, since it doesn't support Z-Moves.
4. **Ladder (2–4 weeks).**
   - Build: harden the online client (reconnects, timer, `rqid`, team validation on the live server). Exit: 50 local games with no forfeits.
   - Pick the ladder team per D4, then fine-tune on it. Exit: the fine-tuned policy beats the untuned one on that team.
   - Play rated games. Exit: the D9 target, held over ≥100 rated games (what "held" means is open in D9).
5. **Play-time search (D8, 4–6 weeks).**
   - Build:
     - A synthesizer that builds a Showdown state from the bot's view plus a sampled world, starting from `sim/state.ts`. Exit: given the true world, it reproduces the true next turn.
     - The search itself, timed per move (D2's search gate is ≤5 s).
   - Exit: search beats no-search at matched teams, by SPRT.
   - Eval cost: MissingNo's gain was only +1.6 pp, and detecting that with 80% power takes ~7.7k games. At ≤5 s per move and ~40 searched moves a game, 4k games played one at a time take ~9 days, so run games in parallel and budget for it.

**Gated side track: the Rust engine (D2).** Nothing is built unless the gate trips. Its scope then comes from the pool, and vgc-engine and Haleclipse (prior-work.md) are the templates for its parity tests.

**Not planned:** teambuilding (D4).

## Evaluation

- **Opponents:** random, max-damage, earlier snapshots, and Foul Play on Z-free teams.
- **Pairings:** duplicate games, with the same teams and seed and the seats swapped.
- **Ratings:** fit Bradley-Terry over all internal games, as the PokéAgent paper does. Use ladder Elo and GXE for public results, recording the team used.
- **Tests:** comparisons that drive a decision use SPRT (prior-work.md, Methods), with duplicate games scored as pairs. Each test states its null and alternative win-rate gaps before it starts, uses α = β = 0.05, and records both with the result. For scale: near 50%, a fixed 1,000 games gives ±3.1 pp (95% CI).
- **Versioning:** pin the Showdown commit (git dependency, re-pinned monthly). Every checkpoint records the commit, the obs version, the vocab hash and the pool version.
  - When the observation, vocab or action space changes, carry trained weights across the change instead of retraining (prior-work.md, Methods).
