# T02: S1 sim throughput

## Brief

- **Objective:** measure Showdown's sim cost on the M4 Max for `Battle` driven directly and for `BattleStream`, and pick one by plan.md's rule: the faster, or `Battle` direct if they're within 10%. The numbers replace plan.md's env estimate (Compute). The harness also records the per-player streams that S6 (tracker comparison) times next. S1 → S6 → S5 is Phase 0's longest chain, so this task goes first, and the recorder comes before the timing work.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - plan.md (Components 1; Phase 0: S1 and S6; Compute), D2, D7. T01's `battle.ts` drives both paths at the pin and is a starting point.
  - T01's gotchas: `Runner`'s `dual` option throws, so don't use it. `RandomPlayerAI` never Mega Evolves unless given a `mega` probability; set it as `Runner.AI_OPTIONS` does (0.6) so games include Megas.
  - Teams: Smogon's NatDex sample teams (`https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json`) that pass `validate-team gen9nationaldex` at the pin. None has an Illusion user (checked 2026-11-24), so also build one validated test team with Zoroark or Zoroark-Hisui and keep it in this folder. T05 builds the stub pool from the same source at the same time; don't wait for it.
  - Turns per game come from T04 (replay corpus), not from random-AI games. The planning session combines the two.
- **Deliverables,** in this folder:
  - First, the recorder: a script that writes both players' protocol lines and request JSON for N seeded games, and a committed sample of its output (≤5 MB). Between them the sample's games include a Mega Evolution, a Z-Move, an Illusion user and a forme that Team Preview hides (plan.md, Format facts), since S6 checks those. Push it as an early checkpoint whose `Verified:` line starts `Recorder ready: <commit>`, and tell the user, who starts the replan that writes S6's brief while the timing work goes on.
  - The harness for both drivers. Each gives what the training env needs at each decision: both players' protocol lines and request JSON, with `strictChoices` off (plan.md, Action head). Run many battles interleaved per process, as Components 1 does.
  - Result: ms per turn and per decision (a request a player must answer) for each driver, in one process and with several processes at once, up to all 14 cores (10 performance, 4 efficiency). Exclude the players' choice time, or report it separately. Median and spread over ≥3 runs, with load averages and the Node and pin versions.
  - The recommendation, by plan.md's 10% rule applied to ms per decision with all cores busy, the figure that matters for training.
  - Under For integration: replacement text for plan.md's Compute env bullet.
- **Acceptance checks:**
  - For the same seeds, both drivers play the same games, with matching per-player streams and requests, or Result lists every difference.
  - The timing commands in Outputs rerun from a clean checkout and land within the reported spread.
  - The recorder reproduces the committed sample byte for byte from its seeds.
- **May change:** `tasks/T02-sim-throughput/` only.
- **Limits:** one or two sessions, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs), on Node 24.
- **Stop and report if:** either driver needs a Showdown patch to give per-player streams and requests, or the same seed and choices give different games.

## Progress

```text
2026-11-24
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: set up the worktree, then build the recorder and its sample (Megas, Z-Moves, Illusion, hidden formes)
```

## Result

## Outputs

Setup as in AGENTS.md (Conventions), then run from this folder on Node 24.

### Recorder

```bash
node record.ts sample.jsonl 12    # reproduces the committed sample byte for byte
```

`node record.ts <out.jsonl> [games=10] [first=0]` plays games `first`… between Showdown's `RandomPlayerAI`s with `Runner.AI_OPTIONS` (move 0.7, mega 0.6), driving `Battle` directly. Game g's p1 plays team g mod 26 of [`teams/illusion.txt`, then `teams/pool.jsonl` in order], and p2 a draw from the same list seeded by g. Game 0 is the Illusion team's. Every seed derives from g (`makeGame` in `sim.ts`), and the recorder freezes `Date.now()` at 0, since the sim stamps `|t:|` lines with it.

One JSON line per game:

| Field | Content |
|---|---|
| `game`, `format`, `pin` | Game id, `gen9nationaldex`, the Showdown commit |
| `seed`, `aiSeeds` | The battle's PRNG seed, and p1's and p2's `RandomPlayerAI` seeds |
| `winner`, `turns` | `Battle.winner` (`Bot 1`, `Bot 2`, or empty for a tie) and `Battle.turn` at the end |
| `p1`, `p2` | That player's chunks, in the order it receives them. A chunk is the player's view of one sim update (protocol lines joined by `\n`, `\|split\|` resolved for that player), or a `\|request\|<JSON>` or `\|error\|…` line. These are the chunks Showdown's `getPlayerStreams` gives that player (`check.ts`) |
| `inputLog` | Showdown's input log (`>start`, `>player` with the packed team, then each choice), which replays the game exactly |

`sample.jsonl` (4.35 MB, sha256 `0241e7a3…403c4b`) holds games 0–11: 499 turns, 14 Mega Evolutions, 10 Z-Moves, 6 Illusions broken (Zoroark-Hisui leads as Zamazenta in game 0), and 16 `|poke|` lines with a `-*` forme (Zamazenta), counted in p1's view.

### Teams

`teams/pool.jsonl` holds Smogon's 25 NatDex sample teams, packed, with source, index, name and author. All 25 pass `validate-team gen9nationaldex` at the pin. `teams/illusion.txt` is sample team 0 with Ceruledge replaced by a Zoroark-Hisui lead, and it validates too. To rebuild the pool from a fresh download:

```bash
curl -sS -o /tmp/gen9nationaldex.json https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json
node teams.ts /tmp/gen9nationaldex.json
```

## For integration
