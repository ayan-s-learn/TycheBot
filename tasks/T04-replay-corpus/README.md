# T04: replay corpus

## Brief

- **Objective:** collect at least 1,000 public `gen9nationaldex` replays. They give turns per game for the Compute estimates (S1 measures ms per turn; plan.md, Phase 0) and game lengths for the turn cap (Training v0). Phase 1's robustness test reuses them (≥1,000 replays parse without error).
- **Inputs:**
  - plan.md (Phase 0: S1; Training v0: turn cap; Phase 1 exit: Robustness), D10 (the cap is a truncation).
  - Showdown's replay server. On 2026-11-24, `https://replay.pokemonshowdown.com/search.json?format=gen9nationaldex` returned 51 replays per page, newest first, about 6 hours of uploads, each with a `rating`. `https://replay.pokemonshowdown.com/<id>.json` returns one replay with its log. Check paging, filters and fields before relying on them.
  - No Showdown build is needed.
- **Deliverables:**
  - `data/replays/v0/replays.jsonl.gz`: one replay per line with at least its id, upload time, rating and log. Drop the chat lines (`|c|`, `|c:|`) before committing: the repo is public, and the parser test doesn't need other players' chat. Keep the rest, usernames included, as the replay server shows them. Outputs documents the format.
  - The fetch and stats scripts, in this folder.
  - Result: turns per game (median, mean, p90, max) over all games, over games not ended by forfeit or inactivity, and by rating band. Also collect a separate sample of up to 100 games rated ≥1500, in `data/replays/v0/high-rated.jsonl.gz` in the same format, kept out of the 1,000 and the figures above and reported on its own with its dates: the newest uploads rarely reach 1500, and `&sort=rating` returns the highest-rated, which on 2026-11-24 went back to 2023. Fewer than 100 is a finding, not a stop. Also the forfeit share, the date range and the rating distribution.
  - Under For integration: the turns-per-game figures for plan.md (Compute), and whether game lengths support Training v0's starting cap of 300.
- **Acceptance checks:**
  - At least 1,000 distinct replays, each with format id exactly `gen9nationaldex` (not another NatDex format), and each log containing exactly one `|win|` or `|tie` line. In rated games, `|raw|` rating lines follow `|win|`.
  - The stats script reproduces Result's numbers from the committed files alone.
- **May change:** `tasks/T04-replay-corpus/`, `data/replays/v0/`.
- **Limits:** one session. Requests one at a time with a pause between them, and a generic User-Agent with no personal details.
- **Stop and report if:** fewer than 1,000 public replays are reachable, or the compressed corpus would exceed 20 MB.

## Progress

```text
2026-11-24 (3)
State: done
Verified: all acceptance checks, with the exception the user accepted on 2026-11-24 (Result):
  `uv run tasks/T04-replay-corpus/stats.py` exits 0 on the data committed at 79f37d0, Python 3.14.
Pending: nothing.
Next: planning session review.
```

```text
2026-11-24 (2)
State: blocked (a ruling on 20 ladder games without rating lines)
Verified: every other acceptance check, `uv run tasks/T04-replay-corpus/stats.py` on the data
  committed at 79f37d0, Python 3.14.
Pending: "In rated games, `|raw|` rating lines follow `|win|`" fails for 20 of 794 ladder games
  (Result), so stats.py exits 1.
Next: the user or planning session rules. Accept them: make stats.py report them as known and set
  State done. Replace them: drop such games in fetch.py and rerun it with a cache directory.
```

```text
2026-11-24
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: probe search.json paging, filters and fields, then write the fetch script
```

## Result

1,000 public `gen9nationaldex` replays uploaded 2026-11-22 07:04 to 11-25 01:30 UTC, the newest at
fetch time, and a separate 100 rated ≥1500. Figures come from `stats.py`.

All acceptance checks pass, with one exception the user accepted on 2026-11-24: 20 of the 794 ladder
games have a result but no rating lines and a null rating, so "In rated games, `|raw|` rating lines
follow `|win|`" holds only for games with a rating. The likely cause, from Showdown's code at the
pin: a replay saved during a battle is uploaded again when it ends, before the ladder update has
added the rating (`server/room-battle.ts`). 17 of the 20 were uploaded before their log's last
timestamp. They are finished games and stay in the corpus: replacing them would drop ladder games
because of how they were saved, and these run longer (mean 32.5 turns).

- **Turns** are the number on the log's last `|turn|` line. p90 interpolates linearly.
- **Rating** is the lower of the two players' ratings after the game (`server/ladders-remote.ts` and
  `server/rooms.ts` at the pin). It matches the rating lines in all 874 logs that have a rating.
- A **ladder** game has an empty `|rated|` line. Tournament games have `|rated|Tournament battle`.

| games (corpus) | n | median | mean | p90 | max | forfeit or inactivity |
|---|---|---|---|---|---|---|
| all | 1000 | 22 | 24.6 | 38 | 263 | 42.4% |
| not ended by forfeit or inactivity | 576 | 24 | 26.2 | 39 | 137 | 0% |
| ladder | 794 | 21.5 | 23.5 | 38 | 148 | 49.2% |
| ladder, not ended by forfeit or inactivity | 403 | 23 | 25.7 | 38 | 111 | 0% |
| rating <1100 | 247 | 19 | 20.9 | 34 | 100 | 43.7% |
| rating 1100-1199 | 201 | 21 | 22.7 | 35 | 72 | 43.8% |
| rating 1200-1299 | 108 | 22 | 26.4 | 40.2 | 148 | 48.1% |
| rating 1300-1499 | 150 | 24 | 24.1 | 38 | 75 | 52.7% |
| rating 1500+ | 68 | 23.5 | 26.2 | 38.9 | 95 | 72.1% |
| no rating: ladder | 20 | 26.5 | 32.5 | 49 | 132 | 75.0% |
| no rating: tournament | 39 | 18 | 34.3 | 75.4 | 263 | 20.5% |
| no rating: not rated | 167 | 25 | 27.4 | 43.4 | 96 | 15.0% |

- **Endings:** forfeit 39.9%, inactivity 2.5%, other 57.6%. No ties. 8 games ended before turn 1.
- **Long games:** p99 88. Over 100 turns: 6 games (0.6%). The longest, 263, ended in a tournament
  disqualification (counted as forfeit).
- **Ratings** (games with one): min 1000, median 1168, p90 1487, max 1768.
- **Custom rules:** 35 games (3.5%), none with a rating (23 are tournament games), keep the format id
  but change the rules (for example added or banned species, dropped clauses, forced monotype). They
  are in the figures above, and their median is 14 turns.

**High-rated sample:** the first 100 games rated ≥1500 going back from the corpus's oldest upload,
uploaded 2026-11-19 15:58 to 11-22 06:01 UTC. Ratings 1502 to 1744, median 1574. Forfeit 65%,
inactivity 2%.

| games (high-rated) | n | median | mean | p90 | max |
|---|---|---|---|---|---|
| all | 100 | 23 | 27.6 | 48.2 | 129 |
| not ended by forfeit or inactivity | 33 | 29 | 30.8 | 43 | 90 |

Limits:

- Public replays are only some of the games played, not a random sample. How they differ from the
  rest wasn't measured.
- Under three days of uploads. The most frequent player is in 7.2% of the corpus's games and 11.0%
  of the high-rated sample's, where the top 10 fill 30.0% of seats.
- Neither "all" nor the subset without forfeit or inactivity is the length of games played to the
  end: the first includes the 42% cut short, and the second drops them. Self-play has no forfeits,
  and its lengths aren't measured here.
- The forfeit and inactivity label comes from server messages. In the 1,092 games that started, it
  agrees with whether the loser's whole team fainted, except one loss the sim ruled for restorative
  berry-cycling (counted as not forfeit).

## Outputs

- `data/replays/v0/replays.jsonl.gz` (1,000 games, 1.3 MB) and `high-rated.jsonl.gz` (100 games,
  0.14 MB). Gzipped UTF-8, one JSON object per line, newest upload first:
  - `id` (string), `uploadtime` (Unix seconds), `rating` (integer or null), `formatid`,
    `players` (two names);
  - `log`: protocol lines joined by `\n`, as served except that `|c|` and `|c:|` lines are removed.
- Figures and acceptance checks, from the committed files: `uv run tasks/T04-replay-corpus/stats.py`
- Fetch: `uv run tasks/T04-replay-corpus/fetch.py <cache dir outside the repo>`, about 22 minutes at
  one request per second or slower. A rerun takes the newest uploads at that time and overwrites both
  data files and fetch-log.json. The committed files are the record. The cache holds replays with chat.
- [fetch-log.json](fetch-log.json): this run's times, search pages, rejected replays (none), and the
  search entries scanned for the high-rated sample (100 of 1,049 were rated ≥1500).

## For integration

1. plan.md, Compute: add this bullet before **M4 Max:**.

   > - **Turns per game** (T04: 1,000 public replays uploaded 2026-11-22 to 11-25 UTC): mean 24.6, median 22, p90 38. Without the 42% ended by forfeit or inactivity: mean 26.2, median 24, p90 39. Ladder games only, also without those (403 games): mean 25.7, median 23, p90 38. These are human games, and none of these figures measures games played to the end. Self-play lengths are unmeasured.

2. plan.md, Training v0: nothing in T04's lengths argues against the starting cap of 300. Replace the "Turn cap" line, keeping its indent under **Reward:**, with:

   > - Turn cap: start at 300 and tune from game-length data. None of T04's 1,100 public replays passed 300 turns (max 263; p99 88 in the 1,000-game corpus). These are human games, and self-play lengths are unmeasured. Capped games are truncated and bootstrap from V(s) (D10). Log the cap-hit rate.

3. AGENTS.md, Current state: replace the line (dated at merge, and combined with other tasks' changes to it) with:

   > - 2026-11-24: Phase 0 (plan.md, Phases). The toolchain is set (Conventions). There is no project code yet. `data/replays/v0/` holds the public replay corpus ([T04](tasks/T04-replay-corpus/README.md), Outputs).
