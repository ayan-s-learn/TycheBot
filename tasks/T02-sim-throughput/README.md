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
2026-11-24 (3)
State: done
Verified: all three acceptance checks ran (Result, Acceptance checks). check.ts: no differences on games
  0-499 and 1070330-1070349. The sample reproduces byte for byte, here and in a clean clone of
  31fb536. Timing: the 3-run sweep (results/sweep.log); the clean-checkout rerun lands within its spread
  for 3 of 4 ms/decision figures, and stream at 1 process 0.4% above. Node 24.22.3, Showdown 29f2d99.
Pending: none
Next: a planning session reviews the PR and applies For integration.
```

```text
2026-11-24 (2)
State: active
Verified: Recorder ready: 8e01572. record.ts and sample.jsonl (Outputs, Recorder): 12 games, 4.35 MB,
  with Mega Evolutions, Z-Moves, Zoroark-Hisui's Illusion and Zamazenta-* in Team Preview.
  `node record.ts sample.jsonl 12` reproduces it byte for byte. check.ts: Battle direct, BattleStream
  and getPlayerStreams give the same chunks, results and input logs on games 0-49. Node 24.22.3,
  Showdown 29f2d99.
Pending: the timing harness and runs; the acceptance checks on more games.
Next: write bench.ts and sweep.ts, then the timed sweep (1 to 14 processes, 3 runs) under the lock.
```

```text
2026-11-24
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: set up the worktree, then build the recorder and its sample (Megas, Z-Moves, Illusion, hidden formes)
```

## Result

**Recommendation: drive `Battle` directly.** At 14 processes the drivers' medians differ by 1% (0.380 vs 0.384 ms per decision), well inside plan.md's 10% rule. Neither driver needed a Showdown patch, and the same seeds and choices gave the same games in every game checked, so no stop condition was hit. All runs: Showdown 29f2d99, Node 24.22.3, M4 Max, 2026-11-24.

### Drivers

Both drivers run the same `Battle` code (`sim.ts`). They differ only in how the env reaches it:

- **Battle direct:** `new Battle({ formatid, seed, send })` and two `setPlayer` calls. Each choice is `battle.choose(side, choice)` followed by `battle.sendUpdates()`, as `BattleStream` does after each write. The `send` callback receives the same `update`, `sideupdate` and `end` messages that `BattleStream` pushes.
- **BattleStream:** `>start`, `>player` and `>p1 <choice>` lines are written to a `BattleStream`, and an async loop per battle reads its chunks. After sending a step's choices, the env yields once (`setImmediate`) so every loop has drained.

Both feed one collector, which splits the output per player as `getPlayerStreams` does. Each process runs 32 battles interleaved: each step answers every open request with Showdown's `RandomPlayerAI` (`Runner.AI_OPTIONS`), then sends every choice. `strictChoices` is off, as the training env needs.

The driver check (Outputs) found no difference across games 0–499 (23,531 turns, 54,160 decisions, 401 Mega Evolutions, 446 Z-Moves), nor across games 1070330–1070349, which include an `[Invalid choice]` (Gotchas).

### Timing

From `results/sweep.log`: the median (min–max) over 3 runs of a 20 s window each, after a 5 s warm-up, with every process busy for the whole window. ms per decision and per turn are the cost to one process sharing the machine with the others: all processes' driver time (sending choices, collecting both players' output, starting and ending games) over all their decisions or turns. Decisions/s is for all processes together, including the players' time.

| Processes | ms/decision, direct | ms/decision, stream | ms/turn, direct | ms/turn, stream | decisions/s, direct | decisions/s, stream |
|---|---|---|---|---|---|---|
| 1 | 0.213 (0.209–0.219) | 0.215 (0.213–0.223) | 0.487 (0.479–0.502) | 0.493 (0.487–0.511) | 4,468 (4,350–4,550) | 4,417 (4,252–4,467) |
| 2 | 0.213 (0.210–0.216) | 0.214 (0.212–0.217) | 0.487 (0.482–0.494) | 0.490 (0.486–0.497) | 8,946 (8,801–9,035) | 8,885 (8,748–8,955) |
| 4 | 0.219 (0.216–0.237) | 0.222 (0.221–0.226) | 0.502 (0.494–0.542) | 0.508 (0.506–0.518) | 17,334 (16,070–17,606) | 17,134 (16,786–17,187) |
| 8 | 0.243 (0.238–0.244) | 0.246 (0.243–0.270) | 0.556 (0.545–0.559) | 0.564 (0.556–0.620) | 31,321 (31,167–31,980) | 30,788 (27,902–31,259) |
| 10 | 0.277 (0.267–0.351) | 0.282 (0.276–0.451) | 0.635 (0.612–0.805) | 0.646 (0.633–1.033) | 34,409 (27,160–35,629) | 33,402 (20,553–34,060) |
| 12 | 0.324 (0.312–0.444) | 0.335 (0.298–0.408) | 0.742 (0.715–1.017) | 0.769 (0.683–0.935) | 35,364 (25,835–36,665) | 33,479 (27,572–37,381) |
| 14 | 0.380 (0.374–0.500) | 0.384 (0.372–0.469) | 0.871 (0.858–1.146) | 0.881 (0.854–1.075) | 35,187 (26,712–35,727) | 34,064 (27,886–35,066) |

- **Drivers:** at every process count the ms/decision medians are within 4% of each other. At 14 processes stream was 2–7% faster in three of four runs (counting the clean-checkout rerun below) and direct 3% faster in the other, so the gap is noise next to the 10% rule. Counting the players' time as well, stream was 3% slower at 14 processes (decisions/s).
- **Scaling:** throughput flattens past 8 processes: 10 processes (the performance-core count) add 10% over 8, and 14 add 2% over 10 (direct). Meanwhile each process's cost per decision rises from 0.21 ms alone to 0.38 ms.
- **Choice time** (`RandomPlayerAI`, reported apart): 0.011 ms per decision in one process, and 0.018 (direct) or 0.027 (stream) at 14. The players are the same in both, so some of stream's cost lands in the choice phase (GC is a likely cause, not measured). That is why the decisions/s comparison above counts both.
- **Games:** across the sweep's 168k random games, a game averaged 48.9 turns and a turn 2.29 decisions. So ~35k decisions/s is ~15k turns/s, or ~310 random games/s (~27M a day) for the sim alone. Games per day for real games follow from T04's turns per game; random players switch 30% of the time (`Runner.AI_OPTIONS` move 0.7), so their decisions per turn may not carry over.
- **Load:** run 1 was 22–63% slower than runs 2 and 3 at 10–14 processes, for both drivers, so the spread there is wide. The cause is unknown. Run 1's 1-minute load averages (5–26) were lower than runs 2 and 3's (10–36), and they mostly reflect the sweep's own previous configuration, so they can't separate other sessions' load.

### Gotchas

- **A request can allow a choice the sim rejects as `[Invalid choice]`, with no updated request.** In game 1070337 both players switched on turn 3, and p1's Landorus-T came in first, so its Intimidate set off Great Tusk's Eject Pack. p2's forced-switch request still listed Diancie, already queued to switch in, and choosing it gave `[Invalid choice] Can't switch: The Pokémon in slot 3 can only switch in once` (`Side.clearChoice` seeds `switchIns` from queued switches). `RandomPlayerAI`, and so `Runner`, throws here. The env now answers the same request again (`Collector` in `sim.ts`), which happened 10 times in the sweep. Phase 1's action mask has to exclude that Pokémon from the player's own queued choice (For integration).
- `Teams.import` on the JSON sample teams cuts species names to 18 characters (`Urshifu-Rapid-Stri`), so `teams.ts` packs the sets directly (For integration, item 3).
- In this worktree the sandbox refused `source ~/.nvm/nvm.sh` and the inline timing-lock command (For integration, item 4).

### Acceptance checks

- **Same games:** passed (the driver check, above).
- **Timing rerun from a clean checkout:** a fresh clone of 31fb536, set up as in AGENTS.md, ran `node sweep.ts <out> 1,14 1` under this worktree's `timed.sh`. A clone's own `timed.sh` would lock that clone's `.git` instead of the shared lock. Three of the four ms/decision figures land within the sweep's min–max: direct 0.218 at 1 process and 0.427 at 14, and stream 0.400 at 14. **Stream at 1 process came out at 0.224, 0.4% above its range (0.213–0.223).** Its ms/turn and decisions/s at 1 process are just outside their ranges too, by under 1%, as is direct's decisions/s (4,347 against a minimum of 4,350). See `results/rerun-clean.log`. A min–max over three runs is narrow: a fourth run of the same distribution lands outside it half the time.
- **Recorder:** `node record.ts sample.jsonl 12` reproduces the committed sample byte for byte, here and in the clean clone.

### Not checked

- `[Unavailable choice]`: no pool team has a hidden trapping ability, and none occurred.
- Battles per process other than 32, and Node versions other than 24.
- Sending output to Python (S5), damage calcs (S3) and observation building. Choice time is `RandomPlayerAI`'s, not a network's.

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

### Driver check

```bash
node check.ts 500    # exits non-zero if any game differs
```

For games 0–499 of the pool (`makeGame` in `sim.ts`), it compares each game's per-player chunks, winner, turn count and input log across Battle direct and BattleStream, each with 16 battles interleaved and with one at a time, and against Showdown's `getPlayerStreams`. It freezes the clock as the recorder does.

### Timing

```bash
./timed.sh node sweep.ts results/sweep.json > results/sweep.log    # about 18 minutes
```

`timed.sh` takes the timing lock (AGENTS.md, Conventions) and prints the load averages before and after. `node sweep.ts <out.json> [procs=1,2,4,8,10,12,14] [runs=3] [seconds=20] [warmup=5] [concurrency=32]` runs, for each run, process count and driver, that many `bench.ts` processes on one shared window: they warm up until it opens, count until it closes, and stop at the next step. Each process plays the pool's games with 32 battles interleaved, and both drivers play the same game ids. `node bench.ts <direct|stream> [first] [startMs] [endMs] [concurrency]` is one process on its own.

| File | What it is |
|---|---|
| `sim.ts` | Showdown at the pin, the pool, seeds, the output collector, both drivers and the step loop (`play`), shared by every script |
| `results/` | `sweep.json`, every process's counts; `sweep.log`, each configuration and the median table. `rerun-clean.*` is the clean-checkout rerun |
| `tsconfig.json` | `node ../../vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tsconfig.json` type-checks every script |

## For integration

1. **plan.md, Compute:** replace the Env bullet's first sub-bullet (`~2.0 ms per median turn per Node process (PokaiTrainer, VGC doubles). No singles figure found.`) with:

   ```markdown
     - Measured by S1 (T02, 2026-11-24, Showdown 29f2d99, Node 24, M4 Max), driving `Battle` directly between random players, with 32 battles per process: 0.21 ms per decision (0.49 ms per turn) in one process. With 10–14 processes the machine does ~35k decisions/s, and 14 processes add 2% over 10. This covers the sim and the per-player split only: no transfer to Python (S5), calcs (S3) or observation building. Random games averaged 2.3 decisions per turn; games per day follow from T04's turns per game. PokaiTrainer's VGC doubles figure was ~2.0 ms per median turn.
   ```

2. **plan.md, Network v0, Action head:** after the `[Unavailable choice]` bullet, add:

   ```markdown
     - A request can also allow a choice the sim rejects as `[Invalid choice]`, with no updated request. When a forced switch comes mid-turn (for example Eject Pack, set off by Intimidate) while the side's own switch is still queued, the request still lists the Pokémon being switched in, but choosing it is rejected (`Side.clearChoice` seeds `switchIns` from the queue). The mask excludes it, using the player's own queued choice (T02).
   ```

   And in Phase 1's Action masks exit criterion, after "`[Unavailable choice]` rejections (hidden trapping or disabling) count as expected.", add: "The mid-turn switch case above is masked from the player's own queued choice, since the request doesn't show it."

3. **docs/areas/team-pool.md** (T05's notes), if they don't already say it, under gotchas: "`Teams.import` on pkmn.github.io's JSON teams passes species through `Dex.getName`, which cuts names to 18 characters, so Urshifu-Rapid-Strike fails validation (sample teams 14, 17 and 18). Pack the sets directly, as T02's `teams.ts` does."

4. **AGENTS.md, Conventions, Timed runs:** add: "In an agent session isolated in a worktree, the sandbox can refuse the inline lock command and `source ~/.nvm/nvm.sh`. T02's `timed.sh` holds the same lock command, and prefixing `PATH` with `~/.nvm/versions/node/v24.<x>/bin` stands in for `nvm use`."
