# Decisions

Status is **open**, **proposed** (a recommendation not yet agreed), **deferred**, **partly decided** (some parts open or deferred, each marked) or **decided (YYYY-MM-DD)**. Until work is built on a decision, edit it in place. After that, when it changes, mark the old text superseded with the date instead of deleting it.

## D1. Format: decided (2026-11-22)

[Gen 9] National Dex OU (`gen9nationaldex`).

## D2. Training env and engine: decided (2026-11-22)

**Showdown's simulator through the first scale-up. Our own Rust engine (c) is a gated side track.**

- **Gate:** (c) moves onto the critical path if either:
  - the Phase 2 rented trial, run on the optimized env, measures more than ~$8 per million games; or
  - Phase 5 search on Showdown can't fit its budget in ≤5 s per move on the M4 Max.
- **Why not (c) first:** projected Showdown cost fits the D9 budget (plan.md, Compute). Building (c) first would delay the first ladder attempt by the length of the engine build. Showdown is also the oracle any engine is tested against.
- **No early start.** Engine work begins only if the gate trips, and its parity method and bar are written then.
- **Engine scope, if built:** whatever the D4 pool and set priors contain. The Oct 2026 chaos stats need 143 species, 155 moves, 51 items and 69 abilities for 90% of usage, and 392, 319, 114 and 141 for 99% (planning agent's count).

The options as weighed:

- **(a) Showdown sim in-process.**
  - For: exact, covers all NatDex mechanics, and zero engine work. MissingNo showed its throughput is enough to reach #1 (random battles).
  - Against: slow, and building a search state from a sampled belief "world" is awkward.
- **(b) Fork poke-engine** (Rust, MIT).
  - For: already has singles, gen 9 and Megas, plus search built in.
  - Against: needs Z-Moves, NatDex data and a parity harness, and it was built as an approximate search engine, not an exact sim.
- **(c) Own Rust engine**, scoped to the NatDex OU legal set and differential-tested against Showdown. This is the mikumiku and PokaiTrainer route.
  - For: fastest, and owns the state layout that search needs.
  - Against: the largest build (compare vgc-engine in prior-work.md, whose parity harness is a template along with Haleclipse's).
- **(d) Haleclipse/PokemonBattleEngine.** Rejected: GPL-3.0 and no NatDex.

## D3. Learning algorithm: decided (2026-11-22)

PPO self-play with no human data. Search runs only at play time. AlphaZero-style search during training is deferred.

Why:

- **Evidence:** this is the recipe behind the three 2026 #1 bots. It is one recipe reused, not three independent results, and none of them is a teambuilder singles format (prior-work.md, "The 2026 recipe").
- **Cost:** PokaiTrainer's search-in-training run produced ~83k games in ~265 GPU-hours. mikumiku's PPO run produced ~330M in 48. The engines differ, but the gap is about four orders of magnitude in games per GPU-hour.
- **Training targets:** AlphaZero trains the policy on MCTS visit counts. With simultaneous moves, those visit counts are only a sensible target if the search is regret-based (D8). So search has to work before it can teach.
- **Counter-evidence is weak:** PokaiTrainer is the only published search-in-training result. It landed below mikumiku, but the comparison is confounded. MissingNo also tried search in training and dropped it as a dead end (prior-work.md).

Revisit once play-time search works: distill search outputs back into the policy (expert iteration).

## D4. Teams: partly decided (2026-11-23)

Unlinked numbers are the research agent's own counts from the Oct 2026 stats and ~60 top 2026 replays.

**Decided (2026-11-23):**

- Both seats sample from the pool. The bot's own ladder team comes out of self-play, not a hand pick. Teambuilding is out of scope.
- **Resample sets every game.** On both teams, with probability ~0.5 per mon, replace its set with a complete set of that species drawn by weight from the set library (`species_sets.json`, below). It may draw the same set. Keep team structure: Mega/Z count, Stealth Rock setter, hazard removal.
  - The library holds the analysis sets plus every set on a training (not held-out) pool team. A set's weight is the product of its species' 1760 chaos-stat marginals for its item, ability and four moves, since sets themselves carry no usage. An attribute missing from the stats gives weight 0; if all of a species' sets weigh 0, draw uniformly.
  - Why: Team Preview shows all 6 species. With fixed sets, the preview identifies the pool team, so aux heads memorize sets and ladder beliefs come out overconfident.
- **Sources through Phase 2:** Smogon NatDex sample teams (25) and analysis sets (170), already machine-readable at pkmn.github.io/smogon, plus recent tour pastes via pokepast.es JSON.
- **Usage stats weight and check the pool; they don't generate it.** They are per-species marginals with no joint sets, so generated sets come out incoherent.
- **Validation:** `validate-team gen9nationaldex` at the pinned Showdown commit.
- **Through Phase 2:** sample pool teams uniformly, and hold out 10 of the ~50 teams.
- **Ladder:** play the single best team. Rotate among the finalists only if repeat opponents adapt to it. The repo is public, so any team committed there is visible to opponents.
- **Interface:** `data/pool/<ver>/teams.jsonl` and `data/priors/<ver>/species_sets.json`.

**Deferred to Phase 3 (pool growth):**

- **Size:** 50 → ~250 → 1–2k rosters, growing when snapshot ratings plateau.
- **Sources at scale:** rosters from high-ladder replays, with unrevealed details filled from complete teams seen in other replays. Port Metamon's `team_prediction` for this (prior-work.md, Reusable code). It is a port, not a drop-in: its coherent filler supports gen 1–4 only, and NatDex replays have to be scraped.
- **Sampling:** roster weights fitted so the pool's species usage matches the 1760 stats, then 0.8 by weight + 0.2 uniform. Weights stay fixed within a run. Add PFSP over team matchups (≤20% of games) only if some matchups stop improving.
- **Holdouts:** a group split (teams sharing ≥4 species are held out together), plus a monthly temporal holdout of the newest teams.
- **Refresh:** re-fit weights monthly, refresh rosters quarterly, and rebuild on a tier change or a NatDex ruling on content from Pokémon Champions. The 1760 meta drifts ~10% a month (total variation in species usage) even without bans.
- **Checks:**
  - pool vs 1760 usage distance;
  - the share of 1760 teams whose species are all in the pool;
  - aux-head calibration on real replays rated ≥1760, scored at the moment each attribute is revealed. This needs replays rebuilt into a player's view (plan.md, Phase 3).

**Deferred to Phase 4 (ladder team):**

- Self-play win rate alone predicts poorly against humans (PokaiTrainer, prior-work.md).
- So: freeze the policy and race the top 32 teams against usage-weighted opponents by successive halving down to 4. Re-measure the finalists on fresh seeds, to remove the winner's curse. Metamon's `team_construction` is a possible base (prior-work.md, Reusable code).
- Then fine-tune with the own seat on the chosen team for part of the games, with opponents still drawn from the pool and snapshots.

## D5. Human data: decided (2026-11-22)

No human data trains the policy for now. It is used only for:

- the team pool and set priors;
- measuring aux-head accuracy on real high-rated replays.

Revisit later. The likely first use is behavior-cloning initialization on NatDex replays, using Metamon's replay tooling (prior-work.md).

## D6. Framework: decided (2026-11-22)

PyTorch, because the same code runs on MPS (M4 Max) and CUDA (5090). JAX's Metal backend is experimental, and MLX is Mac-only.

## D7. Observation: partly decided (2026-11-23)

- **One builder:** a single observation builder over the per-player Showdown protocol, used for both training and online play. Training then sees exactly what the ladder client sees.
- **The builder is Python.**
  - Node workers send raw protocol lines and request JSON. Python parses them, tracks state and builds tensors.
  - It runs in Python env processes separate from the learner, so parsing doesn't compete with PPO for the GIL.
  - Damage calcs stay in @smogon/calc (JavaScript). Python sends one batched calc request per env step, covering every battle in the batch, to the Node workers.
  - Why: one language for features, model and training.
  - Cost: a second round trip per step, plus Python parsing load. Both are measured in Phase 0 (S3, S5). If transfer misses S5's target after batching, this choice reopens.
  - **Open until spike S6:** write our own battle-state tracker, fork poke-env's, or use @pkmn/client (prior-work.md, Reusable code). @pkmn/client is TypeScript, so choosing it moves tracking into the Node worker next to @smogon/calc, removes the second round trip, and reopens "the builder is Python". S6 ends with a recommendation for the user.
- **Damage calcs are in v0.**
  - Why: NatDex's species/item/ability diversity makes damage expensive to learn from embeddings alone. Jaxcalibur used them.
  - Calcs assume the species-level usage prior: the highest-weight library set (D4) consistent with what the protocol has explicitly revealed (moves, item, ability, forme). They don't use the aux-head belief, which would feed the net's output back into its input.
  - For a species with no library set, or none consistent with what has been revealed, the prior is its most common 1760 item, ability, spread and moves, with revealed attributes kept. That can be an incoherent set, but here it is only a calc input, never a training set. A species with no 1760 stats gets no calcs.
  - Implicit evidence (speed order, damage compared to the calc) enters as observation features instead (plan.md, Network v0). Narrowing the prior on that evidence, as Foul Play does, is a later option.
  - Cost per step is measured in Phase 0. If calcs take >30% of env time, restrict them to the active mons' moves (plan.md, Network v0).

## D8. Play-time search: deferred (2026-11-22)

Deferred to Phase 5. Candidates, both described in prior-work.md:

- mikumiku's 1-turn matrix game.
- Jaxcalibur's depth-4 regret-pUCT.

Either way:

- Sample worlds from the aux-head belief.
- Guard against leaking hidden information.
- Override the policy only when search wins by a margin (MissingNo).

## D9. Success bar and budget: partly decided (2026-11-23)

- **Target:** an Elo at or above #10 on the default `gen9nationaldex` board, shown on the bots-included board, held over ≥100 rated games. Then pivot toward the default board's #1 Elo.
  - Why not "top 10 on the board": since 2026-11-13 the default board hides registered bots, so a bot can't appear on it (prior-work.md, MissingNo ladder).
  - On 2026-11-23, #10 was 1856 and #1 was 1940 ([ladder JSON](https://pokemonshowdown.com/ladder/gen9nationaldex.json); add `?includebots` for the other board).
  - **Open:** does "held over ≥100 rated games" mean 100 games in total, or 100 played at or above the bar?
- **Budget:** up to $1k of rented compute for now. Spend only when measurements show the M4 Max isn't enough, apart from the ~$10 Phase 2 trial that measures the D2 gate.
  - **Open:** the threshold for "isn't enough". S4 proposes one (plan.md, Phase 0).
- **Reference:** MissingNo's gen 9 run cost ~$350 and its whole project ~$2.1k (prior-work.md).

## D10. Training details: decided (2026-11-23)

- **The turn cap is a truncation.** A game that hits the cap is cut off, and its last step bootstraps from V(s) (Pardo et al. 2018, prior-work.md). It is not scored with a tiebreak (HP or mons left).
  - Why: the ladder has no such rule. It auto-ties at turn 1000 (`sim/battle.ts`), and nothing on the server calls `RoomBattle.tiebreak()`. Scoring capped games would teach a win condition the ladder doesn't have. With bootstrapping, a losing side that stalls to the cap gets its own low value, so stalling gains nothing as long as V is accurate.
- **The KL term is KL(uniform‖π)** over legal actions, added to the entropy bonus.
  - Why: KL(π‖uniform) = log|A| − H(π), so that direction only duplicates the entropy bonus. KL(uniform‖π) grows without bound as any legal action's probability nears 0, which keeps situational moves like Encore alive. Jaxcalibur describes its term as zero-avoiding, which is this direction.
- **Collection is asynchronous.** Env workers keep playing during PPO updates, on a policy at most one update stale. Behavior log-probs are stored for the PPO ratio.
  - Why: with synchronous PPO the env cores sit idle during updates, and updates took ~70% of mikumiku's wall time.
  - Caveat: the clip is then centred on the stale behavior policy. Log the clip fraction on stale data, and if it runs high, switch to decoupled PPO ([Hilton et al. 2021](https://arxiv.org/abs/2110.00641)), which clips around a separate proximal policy and uses the behavior policy only for the off-policy correction.
