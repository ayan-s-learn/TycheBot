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
  - The timing commands in Outputs rerun from a clean checkout, and each rerun median ms/decision lies within 10% of the reported median (amended 2026-11-25 with the user's OK; it was "land within the reported spread").
  - The recorder reproduces the committed sample byte for byte from its seeds.
- **May change:** `tasks/T02-sim-throughput/` only.
- **Limits:** one or two sessions, no paid services. Take timings as in AGENTS.md, Conventions (Timed runs), on Node 24.
- **Stop and report if:** either driver needs a Showdown patch to give per-player streams and requests, or the same seed and choices give different games.

## Progress

```text
2026-11-25 (5)
State: done
Verified: at the user's request, this branch applies the For integration edits a planning session
  would: plan.md (Components 1, Action head, Compute env bullet, Action masks exit criterion),
  AGENTS.md (Timed runs), checklist.md (T02, S6 and Next replan lines) and this brief's timing check.
  T05's stricter validator (scripts/validate-pool.ts on its branch) passes teams/pool.jsonl (25) and
  teams/illusion.txt.
Pending: For integration's one item waits for T05's area notes to merge.
Next: merge this PR; S6's brief builds on the recorder and sample as of d0ab75e.
```

```text
2026-11-25 (4)
State: done
Verified: the user accepted item 5's tolerance on 2026-11-25: each rerun median within 10% of the
  reported median. By it acceptance check 2 passes: `node compare.ts results/sweep-1.json results/sweep-2.json`
  and `node compare.ts results/sweep-1.json,results/sweep-2.json results/sweep-3.json` exit 0 (farthest
  6.1% and 5.0%), and a 4-second smoke sweep (not kept) exits 1. The other two checks passed (entry (3)).
Pending: none. The brief's wording of check 2 still says "within the reported spread": item 5.
Next: a planning session reviews the PR, applies For integration, and edits the brief per item 5.
```

```text
2026-11-25 (3)
State: blocked (acceptance check 2 as written fails twice; passing it needs a tolerance, For
  integration item 5)
Verified: three sweeps on 2026-11-25 (Result, Timing), two from fresh clones (be58e92, cf61f48), with
  other load 0.1-2.8 cores. Every sweep's median ms/decision is within about 5% of the pooled median; the
  min-max check failed for sweep 2 (9 of 14) and sweep 3 (4 of 14). check.ts (pool games 0-499,
  recorder games 0-51, games 1070330-1070349) and the sample's byte-for-byte reproduction pass here and
  in the clone of cf61f48. Node 24.22.3, Showdown 29f2d99.
Pending: the decision on item 5.
Next: if item 5 is accepted, record acceptance check 2 as passed under it and set State to done.
```

```text
2026-11-25 (2)
State: active
Verified: sweep 1 (worktree, d0ab75e) and sweep 2 (fresh clone of be58e92), 3 runs each, other load
  0.2-1.9 cores. Sweep 2 failed the pre-set clean-checkout rule against sweep 1 (9 of 14 medians
  outside, all slower, by up to 6%), so Result now pools both sweeps (compare.ts). The sample reproduces
  in the fresh clone.
Pending: sweep 3 from another fresh clone, checked against the pooled figures by the same rule.
Next: run sweep 3 under the shared lock; then `node compare.ts results/sweep-1.json,results/sweep-2.json
  results/sweep-3.json` decides the acceptance check.
```

```text
2026-11-25
State: active
Verified: an adversarial review of PR #4 found the 2026-11-24 timings inflated by other load: a 1-process
  rerun on 2026-11-25 gave 0.180 ms/decision (direct, 32 battles), below the reported 0.209-0.219. The
  harness now records other load and CPU time, and waits for a quiet machine (sweep.ts); check.ts
  covers the recorder's games (recorder games 0-51 match); the sample is games 0-10 and 15, adding an
  Urshifu-* game, and reproduces byte for byte (sha256 bd0ece9a...). Result below still has the old
  timings.
Pending: the new sweep, its clean-checkout rerun (compare.ts), and Result.
Next: run the sweep under the lock, then the same command from a clean clone, then rewrite Result.
```

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

**Recommendation: drive `Battle` directly.** At 14 processes it cost 0.280 ms per decision against BattleStream's 0.289 (medians of 6 runs), within plan.md's 10% rule (Timing, Drivers). Neither driver needed a Showdown patch, and the same seeds and choices gave the same games in every game checked, so no stop condition was hit. All timings: 2026-11-25, Showdown 29f2d99, Node 24.22.3, M4 Max.

### Drivers

Both drivers run the same `Battle` code (`sim.ts`). They differ only in how the env reaches it:

- **Battle direct:** `new Battle({ formatid, seed, send })` and two `setPlayer` calls. Each choice is `battle.choose(side, choice)` followed by `battle.sendUpdates()`, as `BattleStream` does after each write. The `send` callback receives the same `update`, `sideupdate` and `end` messages that `BattleStream` pushes.
- **BattleStream:** `>start`, `>player` and `>p1 <choice>` lines are written to a `BattleStream`, and an async loop per battle reads its chunks. After sending a step's choices, the env yields once (`setImmediate`) so every loop has drained.

Both feed one collector, which splits the output per player as `getPlayerStreams` does. Each process runs 32 battles interleaved: each step answers every open request with Showdown's `RandomPlayerAI` (`Runner.AI_OPTIONS`), then sends every choice. `strictChoices` is off, as the training env needs.

The driver check (Outputs) found no difference across the pool's games 0–499 (23,531 turns, 54,160 decisions, 401 Mega Evolutions, 446 Z-Moves), the recorder's games 0–51, which include the Illusion team, or games 1070330–1070349, which include an `[Invalid choice]` (Gotchas).

### Timing

Two sweeps of 3 runs each, the second from a fresh clone (Acceptance checks): `results/sweep-1.log` and `results/sweep-2.log`. The table gives the median (min–max) over all 6 runs (`node compare.ts results/sweep-1.json,results/sweep-2.json`). Each run is a 20 s window, after a 5 s warm-up, with every process busy for the whole window. ms per decision and per turn are the cost to one process sharing the machine with the others: all processes' driver time (sending choices, collecting both players' output, starting and ending games) over all their decisions or turns. Decisions/s is for all processes together, including the players' time.

| Processes | ms/decision, direct | ms/decision, stream | ms/turn, direct | ms/turn, stream | decisions/s, direct | decisions/s, stream |
|---|---|---|---|---|---|---|
| 1 | 0.184 (0.180–0.201) | 0.186 (0.181–0.209) | 0.421 (0.412–0.462) | 0.426 (0.415–0.480) | 5,181 (4,712–5,293) | 5,128 (4,542–5,257) |
| 2 | 0.189 (0.186–0.205) | 0.194 (0.191–0.197) | 0.434 (0.426–0.470) | 0.445 (0.438–0.451) | 10,039 (9,254–10,221) | 9,796 (9,664–9,955) |
| 4 | 0.197 (0.194–0.205) | 0.199 (0.197–0.201) | 0.450 (0.444–0.469) | 0.457 (0.452–0.461) | 19,317 (18,544–19,612) | 19,074 (18,914–19,276) |
| 8 | 0.205 (0.202–0.208) | 0.209 (0.207–0.214) | 0.470 (0.463–0.477) | 0.479 (0.474–0.490) | 37,024 (36,460–37,607) | 36,232 (35,458–36,636) |
| 10 | 0.211 (0.207–0.215) | 0.219 (0.214–0.222) | 0.484 (0.473–0.494) | 0.501 (0.491–0.509) | 44,955 (44,039–45,908) | 42,988 (42,346–43,834) |
| 12 | 0.237 (0.235–0.247) | 0.250 (0.242–0.258) | 0.543 (0.539–0.566) | 0.573 (0.555–0.591) | 48,068 (46,166–48,429) | 44,165 (42,979–45,802) |
| 14 | 0.280 (0.271–0.293) | 0.289 (0.278–0.326) | 0.642 (0.621–0.673) | 0.662 (0.637–0.747) | 47,531 (45,366–49,153) | 44,744 (40,170–46,719) |

- **Drivers:** direct's ms/decision median is the lower at every process count, by 1–6%. At 14 processes direct was faster in 5 of the 6 runs (stream up to 11% slower, in sweep 2's run 3) and stream 2% faster in the other. In the check sweep (sweep 3) stream was faster in 2 of 3 runs and its median 2% ahead, so at 14 processes the order is within noise. Counting the players' time as well, direct did 6% more decisions/s at 14 processes.
- **Scaling:** throughput grows 21% from 8 to 10 processes, the performance-core count, then levels off: 12 and 14 processes give 48k and 47.5k decisions/s, and their ranges overlap (direct). Each process's cost per decision rises from 0.18 ms alone to 0.21 ms at 10 and 0.28 ms at 14.
- **Choice time** (`RandomPlayerAI`, reported apart): 0.009 ms per decision in one process, and 0.015 (direct) or 0.023 (stream) at 14. The players are the same in both, so some of stream's cost lands in the choice phase (GC is a likely cause, not measured). That is why the decisions/s comparison counts both.
- **Battles per process:** with one battle per process instead of 32, one process took 0.159 ms per decision direct and 0.172 stream (`results/battles-1.log`, 3 runs): 14% and 7% below the 32-battle medians, which came from other sessions (they drift ~5% between sessions). With one battle, stream's yield to the event loop at every step has nothing to spread over, so it is 8% slower than direct.
- **Games:** across the sweeps' 443k random games, a game averaged 48.9 turns and a turn 2.29 decisions. So ~47.5k decisions/s is ~21k turns/s, or ~420 random games/s (~37M a day) for the sim alone. Games per day for real games follow from T04's turns per game; random players switch 30% of the time (`Runner.AI_OPTIONS` move 0.7), so their decisions per turn may not carry over.
- **Load:** each configuration started once the rest of the machine used under 2.5 cores (two waited 35 s), and during the windows it used 0.2–1.9 cores. Sweep 2 ran straight after sweep 1, and at 14 processes its processes got 0.89–0.97 of a core each, against 0.91–1.00 in sweep 1. The first sweep, on 2026-11-24 without these checks, read 10–37% higher per decision than the pooled figures, most likely because of other sessions' load. Its results are in this branch's history (304aa5b).

### Gotchas

- **A request can allow a choice the sim rejects as `[Invalid choice]`, with no updated request.** In game 1070337 both players switched on turn 3, and p1's Landorus-T came in first, so its Intimidate set off Great Tusk's Eject Pack. p2's forced-switch request still listed Diancie, already queued to switch in, and choosing it gave `[Invalid choice] Can't switch: The Pokémon in slot 3 can only switch in once` (`Side.clearChoice` seeds `switchIns` from queued switches). `RandomPlayerAI`, and so `Runner`, throws here. The env now answers the same request again (`Collector` in `sim.ts`), which happened 32 times across the two sweeps. Phase 1's action mask has to exclude that Pokémon from the player's own queued choice (now in plan.md, Network v0: Action head, and Phase 1's Action masks).
- `Teams.import` on the JSON sample teams cuts species names to 18 characters (`Urshifu-Rapid-Stri`), so `teams.ts` packs the sets directly (For integration).
- In this worktree the sandbox refused `source ~/.nvm/nvm.sh` and the inline timing-lock command, and `timed.sh` takes the lock of whichever repository the current directory is in (now in AGENTS.md, Conventions: Timed runs).

### Acceptance checks

- **Same games:** passed (the driver check, above), here and in the fresh clone of cf61f48.
- **Timing rerun from a clean checkout:** sweep 2 reran sweep 1's Outputs command from a fresh clone of be58e92. By the rule fixed beforehand (`compare.ts`: each rerun median within the reported min–max), **it failed: 9 of 14 medians fell outside sweep 1's ranges**, all on the slow side, by up to 6% (median 2%). The figures above therefore pool both sessions, and sweep 3, from another fresh clone of cf61f48, checks them by the same rule. **It failed too: 4 of 14 medians fell outside the pooled ranges**, each above the maximum by 0.3–1.5%. Its medians are all within about 5% of the pooled ones (`compare.ts` prints each). A configuration's three runs typically spanned 2–5% within one sweep, with single runs up to 16% off, and sessions drifted a few percent on top of that, so a rerun's median often lands just outside a min–max. So the user accepted a tolerance instead on 2026-11-25, and the brief's check now says so: each rerun median within 10% of the reported median. **By that rule check 2 passes:** `compare.ts` exits 0 for sweep 2 against sweep 1 (farthest 6.1%) and for sweep 3 against the pooled figures (farthest 5.0%).
- **Recorder:** `node record.ts sample.jsonl 0-10,15` reproduces the committed sample byte for byte, here and in fresh clones of be58e92 and cf61f48.

### Not checked

- `[Unavailable choice]`: no pool team has a hidden trapping ability, and none occurred.
- Battles per process other than 1 and 32 (1 only in one process), and Node versions other than 24.
- Sending output to Python (S5), damage calcs (S3) and observation building. Choice time is `RandomPlayerAI`'s, not a network's.

## Outputs

Setup as in AGENTS.md (Conventions), then run from this folder on Node 24.

### Recorder

```bash
node record.ts sample.jsonl 0-10,15    # reproduces the committed sample byte for byte
```

`node record.ts <out.jsonl> [ids=0-9]` plays the given games (comma-separated ids and ranges) between Showdown's `RandomPlayerAI`s with `Runner.AI_OPTIONS` (move 0.7, mega 0.6), driving `Battle` directly. Game g's p1 plays team g mod 26 of [`teams/illusion.txt`, then `teams/pool.jsonl` in order], and p2 a draw from the same list seeded by g. Game 0 is the Illusion team's. Every seed derives from g (`recorderGame` in `sim.ts`), and the recorder freezes `Date.now()` at 0, since the sim stamps `|t:|` lines with it.

One JSON line per game:

| Field | Content |
|---|---|
| `game`, `format`, `pin` | Game id, `gen9nationaldex`, the Showdown commit |
| `seed`, `aiSeeds` | The battle's PRNG seed, and p1's and p2's `RandomPlayerAI` seeds |
| `winner`, `turns` | `Battle.winner` (`Bot 1`, `Bot 2`, or empty for a tie) and `Battle.turn` at the end |
| `p1`, `p2` | That player's chunks, in the order it receives them. A chunk is the player's view of one sim update (protocol lines joined by `\n`, `\|split\|` resolved for that player), or a `\|request\|<JSON>` or `\|error\|…` line. These are the chunks Showdown's `getPlayerStreams` gives that player (`check.ts`) |
| `inputLog` | Showdown's input log (`>start`, `>player` with the packed team, then each choice), which replays the game exactly |

`sample.jsonl` (3.92 MB, sha256 `bd0ece9a…320be30e`) holds games 0–10 and 15: 445 turns, 13 Mega Evolutions, 9 Z-Moves, 6 Illusions broken (Zoroark-Hisui leads as Zamazenta in game 0), and 15 `|poke|` lines with a `-*` forme, counted in p1's view. Most are Zamazenta's. In game 15, p1's `Urshifu-*` switches in as Urshifu-Rapid-Strike. Before d0ab75e the sample was games 0–11, without the Urshifu game.

### Teams

`teams/pool.jsonl` holds Smogon's 25 NatDex sample teams, packed, with source, index, name and author. All 25 pass `validate-team gen9nationaldex` at the pin. `teams/illusion.txt` is sample team 0 with Ceruledge replaced by a Zoroark-Hisui lead, and it validates too. To rebuild the pool from a fresh download:

```bash
curl -sS -o /tmp/gen9nationaldex.json https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json
node teams.ts /tmp/gen9nationaldex.json
```

### Driver check

```bash
node check.ts 500              # the pool's games 0–499, as the timing runs play them
node check.ts 52 0 recorder    # the recorder's games 0–51: each of its 26 teams twice as p1
node check.ts 20 1070330       # includes an [Invalid choice]
```

Each exits non-zero if any game differs. It compares each game's per-player chunks, winner, turn count and input log across Battle direct and BattleStream, each with 16 battles interleaved and with one at a time, and against Showdown's `getPlayerStreams`. It freezes the clock as the recorder does.

### Timing

```bash
./timed.sh node sweep.ts results/sweep-1.json > results/sweep-1.log    # about 22 minutes
node compare.ts results/sweep-1.json,results/sweep-2.json                # the pooled table
node compare.ts results/sweep-1.json,results/sweep-2.json <rerun.json>   # checks a rerun: exit 0 if every median is within 10%
```

`timed.sh` takes the timing lock (AGENTS.md, Conventions) of the repository the current directory is in, and prints the load averages before and after. To time a separate clone under the shared lock, run this folder's `timed.sh` from here with the clone's paths: `./timed.sh node <clone>/tasks/T02-sim-throughput/sweep.ts <clone>/tasks/T02-sim-throughput/results/sweep.json`.

`node sweep.ts <out.json> [procs=1,2,4,8,10,12,14] [runs=3] [seconds=20] [warmup=5] [concurrency=32]` runs, for each run, process count and driver, that many `bench.ts` processes on one shared window: they warm up until it opens, count until it closes, and stop at the next step. Each process plays the pool's games with 32 battles interleaved, and both drivers play the same game ids. Before each configuration the sweep waits, for up to 3 minutes, until the rest of the machine uses under 2.5 cores, and it records that load during the window and each process's CPU time (`sweep.ts`'s header). `node bench.ts <direct|stream> [first] [startMs] [endMs] [concurrency]` is one process on its own.

| File | What it is |
|---|---|
| `sim.ts` | Showdown at the pin, the pool, seeds, the output collector, both drivers and the step loop (`play`), shared by every script |
| `results/` | For each sweep, `.json` has every process's counts and `.log` each configuration and that sweep's median table. Sweeps 1 and 2 are the reported ones (sweep 2 from a fresh clone of be58e92); sweep 3, from a fresh clone of cf61f48, is the check. `battles-1` is one process with one battle |
| `tsconfig.json` | `node ../../vendor/pokemon-showdown/node_modules/typescript/bin/tsc -p tsconfig.json` type-checks every script |

## For integration

Applied on this branch at the user's request, 2026-11-25, apart from this item, which waits for T05's PR because the file is new there:

- **docs/areas/team-pool.md**, Gotchas: "`Teams.import` on pkmn.github.io's JSON teams passes species through `Dex.getName`, which cuts names to 18 characters, so Urshifu-Rapid-Strike fails validation (sample teams 14, 17 and 18). Pack the sets directly, as T02's `teams.ts` and T05's `build-pool.ts` do."
