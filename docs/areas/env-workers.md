# Env workers

Components 1 and 2 of plan.md as the walking skeleton built them (T09): Node processes that run battles, track each player's view, run the damage calcs and write a numeric record per decision, and the Python end that receives the records and sends actions back. D7 owns the design.

## Status (2026-11-26)

- Works end to end: 12 workers at ~11k decisions/s on the M4 Max with Python answering at random, and a PPO policy trained through it beats random ([T09](../../tasks/T09-skeleton/README.md), Result).
- The record is a minimal stand-in for the observation: no events, items, abilities, field or side conditions, and no evidence features.
- Calcs use both sides' true sets, which leaks hidden information.
- Tracking is @pkmn/client 0.7.4 as is, constructed in one place: `Client` in `worker/skeleton/env.ts`.
- An opposing Transform or Illusion stops the worker: the calcs check each tracked opposing species against its set's (`calcs.ts`) and throw. Review pass 2 hit it with a scripted Ditto game. The v0 pool has neither.

## Code

| Path | What it is |
|---|---|
| `worker/sim/showdown.ts` | Showdown's `dist/` at the pin, loaded with `require` |
| `worker/sim/battles.ts` | `Game`: one `Battle` driven directly, each player's chunks and requests kept until taken, `[Invalid choice]` counted and the request posed again. `drawGame`: seeds and teams from (run seed, worker, game). `loadPool`: a pool's training teams, leaving out those its `holdout.txt` lists |
| `worker/calc/calcs.ts` | `Calcs`: the 288 calcs for one player over one game, cached. `compute` takes plain `MonState`s, so the sim's state can be calced the same way (`calcs.test.ts`) |
| `worker/skeleton/env.ts` | `Env`: many games, a client `Battle` per player, `collect` / `encode` / `apply` per step |
| `worker/skeleton/mask.ts` | The 18 actions, the mask from a request, and the choice string for an action |
| `worker/skeleton/record.ts`, `vocab.ts` | The record layout and the species and move ids |
| `worker/skeleton/frames.ts`, `main.ts` | The Node end of the transport, and the worker process |
| `worker/skeleton/drive.ts` | Steps an `Env` in-process (tests, `tasks/T09-skeleton/inproc.ts`) |
| `tyche/transport/record.py`, `workers.py` | The Python end: the same layout as a numpy dtype, and `Workers` |
| `tyche/skeleton/` | The skeleton's net, PPO, eval and env benchmark |

## Transport

Python starts each worker as `node worker/skeleton/main.ts '<config JSON>'` with two pipes from `os.pipe()`, whose fd numbers the config names (`fds`: the worker's read end, then its write end). Both ends read and write them with blocking calls. stdout is unused; stderr carries the worker's errors and `[Invalid choice]` lines.

Frames are a 12-byte header, magic `0x54594348` (u32), record version (u16), type (u16), payload length (u32), then the payload, all little-endian:

| Type | Direction | Payload |
|---|---|---|
| 1 hello | worker → Python | JSON: `layout` (as below), `vocab` (`species`, `moves` sizes and a `hash`), `pin`, `node`, `config` |
| 2 batch | worker → Python | records (u32), ended games (u32), each ended game as 4 i32 (`game`, `winner` 0/1 or -1 for a tie or a cutoff, `truncated` 0/1, `turns`), then the records |
| 3 stats | worker → Python | JSON: counts and ms by phase since the last reset |
| 16 actions | Python → worker | flags (u32; 1 = reset the counters), count (u32), one i32 action per record of the last batch, in order |
| 17 stop | Python → worker | empty. The worker answers with stats and exits |

After the hello the two alternate: a batch, then its actions (or a stop). A batch holds every open decision across the worker's games and the games that ended in its previous step. The worker checks each action against the mask it sent and throws on a masked one.

**Versions:** every frame carries the record version. The worker refuses a frame with another version, and Python refuses a hello whose version or layout differs from `tyche/transport/record.py`, or a frame with another version. Bump `VERSION` on both ends whenever a field or the meaning of its values changes (codes, action indices, axis order). The layout check catches only the first.

`Workers(n, battles=32, seed=..., pool=..., turn_cap=300)` starts n workers. `pool` defaults to v0's stub pool, so pass v1's `teams.jsonl` for its training teams. `recv()` returns the batches ready now, `gather()` one from every worker, `send(worker, actions)` answers one, and `stop()` returns every worker's stats. It refuses workers on a Node major other than `.nvmrc`'s.

## Record, version 1

One per decision: a request that isn't a wait. Every field is 4 bytes, so a record is 478 words (1,912 bytes). Mons are 0–5 own, in the request's order (the active first once the battle starts), and 6–11 opposing, in Team Preview order, which is their team order.

| Field | Type, shape | Holds |
|---|---|---|
| `game` | i4 | The worker's game counter. A game is (worker, game) |
| `side` | i4 | 0 = p1, 1 = p2 |
| `turn` | i4 | `Battle.turn` |
| `kind` | i4 | 0 Team Preview, 1 move, 2 forced switch |
| `species` | i4 [12] | Species ids, as shown: a hidden forme (`Zamazenta-*`) is its base id until it switches in |
| `moves` | i4 [6, 4] | Own mons' move ids, in their request order. Hidden Power's type and Return's power are dropped |
| `status` | i4 [12] | 0 none, 1 brn, 2 par, 3 slp, 4 frz, 5 psn, 6 tox |
| `mask` | i4 [18] | 1 = legal (Actions, below) |
| `hp` | f4 [12] | Fraction of max HP. Opposing: as the protocol rounds it; 1 for a mon not yet seen |
| `fainted`, `active` | f4 [12] | 0/1. No mon is active at Team Preview |
| `boosts` | f4 [12, 7] | Stages: atk, def, spa, spd, spe, accuracy, evasion |
| `calcs` | f4 [2, 6, 4, 6] | [0][i][j][k]: own mon i's move j against opposing mon k. [1][k][j][i]: opposing k's move j against own mon i. Mean damage over the rolls as a fraction of the defender's max HP, capped at 2. 0 for a status move, a fainted mon or an empty slot |

**Ids** (`vocab.ts`): every species and move id in Showdown's Dex at the pin, sorted, from 2; 0 is an empty slot and 1 an id outside the vocab. The hello's `vocab.hash` names the list.

**Calcs** (`worker/calc/calcs.ts`): own mons from the request and the tracker (boosts, volatiles), with nature, EVs and IVs from the true sets. Opposing mons from the tracker (species, HP, status, boosts, volatiles), and from their true sets:
- nature, EVs, IVs and Hidden Power's type;
- the item, unless the tracker saw it or saw it go;
- the ability, unless the tracker saw it or the mon changed forme (a Mega takes the calc's default for the new forme);
- all four moves;
- a forme Team Preview hides, until the mon switches in: the pool's `Urshifu-*` is calced as Urshifu-Rapid-Strike from Team Preview on.

These are what the skeleton's calcs leak. The record's other fields hold only what the player is shown. The field comes from the tracker. Each player has a cache per game, keyed on every input. Fainted mons and status moves get no calcs, as in T06.

**Actions** (`mask.ts`): action 3i + v is move i (the request's current index) plain, Mega Evolving (v = 1) or as a Z-Move (v = 2); action 12 + j switches to own mon j. At Team Preview, 12 + j leads with mon j (`team j+1`). A Z-Move is legal when the request lists one for that slot, even if the base move is disabled. Switches are masked when the request says `trapped`, and offered when it says `maybeTrapped`. At a forced switch mid-turn, the mon the player chose to switch to this turn is masked (Gotchas). When the request's move list shrinks (a locked move, Recharge, Struggle), action 0 is that one move, while `moves` and `calcs` slot 0 still describe the mon's first move: review pass 2 counted 48 such decisions in 17,506 move decisions. Action 0 is then the only legal one. There is no Ultra Burst action; no pool team has one.

## Commands

From the root, after setup (AGENTS.md, Conventions), with `nvm use` in the same command:

```bash
node --test 'worker/**/*.test.ts'
uv run pytest
uv run python -m tyche.skeleton.bench --out <file.jsonl> --workers 12 --runs 3 [--pool data/pool/v1/teams.jsonl]
uv run python -m tyche.skeleton.train --out <dir> --minutes 10
uv run python -m tyche.skeleton.eval <dir>/net.pt --games 1000
```

The flags T09 ran are in its Outputs. Take timings under the timing lock (AGENTS.md, Conventions); `bench.py` flags a run at background priority or with workers under 0.9 of a core (Gotchas). Python scripts under `tyche/` run as modules from the root: run by path, the root isn't on `sys.path`.

What the tests cover:

- `worker/skeleton/mask.test.ts`: hand-made requests; the queued-switch case played out; and on every decision of 6 random games, each of the 18 actions tried on a copy of the battle (`sim/state.ts`), where the mask must allow exactly the actions the sim carries out.
- `worker/calc/calcs.test.ts`: the record's calcs against the same calcs on the sim's state, on 8 random games: 0 of 141,321 nonzero calcs differed (2026-11-26).
- `worker/skeleton/record.test.ts`: the layout, and records against the request and the sim.
- `tyche/transport/test_transport.py`: the round trip, stacking, echo, both ends refusing another version, and a refused worker being stopped.
- `tyche/skeleton/test_skeleton.py`: GAE, and the net's mask and a PPO update on real records.

## Gotchas

- **A forced switch mid-turn lists a mon the sim rejects.** When Eject Pack forces a switch while the side's own switch is queued, the request lists the queued mon, but choosing it is `[Invalid choice]` (T02; `Side.clearChoice` seeds `switchIns` from the queue). Forcing out the mon that switch was for cancels it (`queue.cancelAction` in `sim/battle-actions.ts`), so the queued mon is legal again afterwards. The env tracks the queued mon per player from its own choice, and clears it after the forced switch, when the mon comes in, or at `|upkeep|`. `mask.test.ts` plays the case out.
- **A locked move accepts `mega` and `zmove` and ignores them** (`Side.chooseMove` returns at the locked move before checking Mega Evolution). The mask leaves them out, so a probe has to compare what the sim does, not whether it accepts the choice.
- **@pkmn/client names weather and terrain as @smogon/calc does** (`field.weather` is `Sand`, `field.terrain` is `Psychic`), and `weatherState.id` is the id of that name (`sand`), not Showdown's. Looked up by Showdown ids, both came out empty and 2.8% of calcs differed from the sim's.
- **@pkmn/client holds 0/0 HP for an opposing mon it hasn't seen,** so `hp / maxhp` is NaN: `test_transport.py` found NaN opposing HP at Team Preview. The record and the calcs take such a mon as full HP (`hpOf` in `calcs.ts`).
- **The request marks slot 1 active at Team Preview,** before any mon is in battle (`getSwitchRequestData`: `active` is `position < active.length`). `record.test.ts` caught it against the sim's `isActive`; the record shows no active mon there.
- **`Teams.unpack` leaves unset EVs and IVs undefined,** and the calc then threw reading `evs.hp`. The sim fills in defaults on its own copy, so true sets come from `battle.sides[i].pokemon[j].set` right after `setPlayer`, when the order is still team order.
- `[Invalid choice]` is counted, logged to stderr and answered by asking again, up to 100 per game. With the queued-switch mask, each one is a mask bug. None occurred in T09's runs (2026-11-26). `train.py` writes the workers' counts to `workers.json`, and `eval.py` reports them.
- **An agent shell can run at background priority** (`ps -o pri= -p $$` prints 4, against 31 normally). There the same in-process run took ~5× as long (3.58 ms per decision against 0.72, 2026-11-26), while one process still showed more than a full core of CPU. So CPU share doesn't reveal it at one process; `bench.py` records the priority and flags such runs. T09's committed timings ran at full speed (CPU share ~1.0 per worker at 12, and the 1-process figure matched in-process runs from before).
