# T13: Ladder-pool monitor

## Brief

- **Objective:** measure who a registered bot meets on the `gen9nationaldex` ladder, and how often. Then check D9's estimate of the win rate the target takes. A bot is matched only with opted-in players and other bots (D9, What the bar takes), and that estimate rests on 11 replays. The answer shows whether the target is reachable and what it rewards, long before the online gate.
- **Inputs:**
  - D9 (Target, What the bar takes), and prior-work.md (MissingNo, Ladder: the bot registry and opt-in policy).
  - Public endpoints, read-only: the ladder JSON `https://pokemonshowdown.com/ladder/gen9nationaldex.json`, with `?includebots` for the bots-included board; replay search `https://replay.pokemonshowdown.com/search.json?user=<name>&format=gen9nationaldex`; and replay logs `https://replay.pokemonshowdown.com/<id>.log`. A registered bot is an account that shows on the bots-included board but not the default one.
- **Deliverables,** in this folder:
  - A fetcher. Every hour it snapshots both boards, and every day it collects the new replays of each registered bot in the bots-included top 500. It runs as a scheduled job on this Mac for at least 14 days.
  - A summary script, which builds Result's tables from the snapshots and replays:
    - #10 and #1 over time. Ratings mean the ladder's `elo` field throughout;
    - each registered bot's rating over time and its rated games per day, from the win, loss and tie counts (`w`, `l`, `t`) that change between snapshots while it is in the top 500;
    - the ratings of the opponents it met (each replay log's `|player|` lines carry both players' ratings), and its win rate by rating gap, both by the bot's own rating at the time;
    - how many distinct opponents the bots met per week.
  - Result: those tables, and whether the bots' opponents and win rates by rating gap fit what D9's estimate assumes: opponents around 1550–1650, and win rates near the Elo expectation (~77–86% to hold #10, ~85–91% to hold #1). Proposed D9 text goes under For integration.
- **Acceptance checks:**
  - ≥14 days of hourly snapshots, with any gaps listed.
  - All the replays the search returns for every registered bot in the top 500 over those days. The search lists only saved replays, so Result gives their count next to the games the snapshots show, and compares the replays' win rate with the snapshots'.
  - The summary script rebuilds Result's tables from the raw data.
- **May change:** `tasks/T13-ladder-monitor/` only.
- **Limits:**
  - Two sessions: one to set up and start the job, one after ≥14 days to write up. No accounts, no posting, no paid services.
  - At most one request per second. Use a generic User-Agent with no personal details.
  - The scheduled job is persistent configuration, so get the user's OK before installing it, and remove it at the end.
  - The repo is public. Commit only aggregates and registered bots' names. Raw fetches, which hold other players' names, stay out of git under a `.gitignore` in this folder.
- **Stop and report if:**
  - an endpoint needs a login or blocks automated requests;
  - fewer than two registered bots play rated games in the first week.

## Progress

```text
2026-11-27
State: done (the setup half; the user agreed on 2026-11-27 to split the write-up into its own
  task, proposed under For integration, so the acceptance checks move there)
Verified: the launchd agent runs a copy of fetch.py in the data dir, so no checkout has to stay.
  Reinstalled 2026-11-27 04:39 UTC; its run exited 0. Three snapshots and 646 replay logs in the
  data dir. The 3 tests pass, run without the project since this folder is outside `tyche/`
  (`uv run --no-project --with pytest==9.2.0 pytest -p no:cacheprovider tasks/T13-ladder-monitor`).
Pending: none here. The brief's acceptance checks move to the write-up task (For integration).
Next: user review and two review passes on the PR; then a planning session merges it and
  briefs the write-up task.
```

```text
2026-11-26 (2)
State: waiting_for_job (`tasks/T13-ladder-monitor/job.sh status`; runs.jsonl in the data dir)
Verified: both boards, the replay search and replay logs answer without a login (2026-11-26).
  fetch.py's first run snapshotted both boards and backfilled 646 saved replays of the two
  registered bots, guoguo10000 and imjustpixel2, in 14 minutes. The user approved the launchd
  agent on 2026-11-26; it is installed and its first run exited 0.
Pending: >=14 days of snapshots; the rest of the acceptance checks; Result.
Next: after 2026-12-10, write up.
Handoff: open
```

```text
2026-11-26
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: probe the ladder and replay search endpoints, then write the fetcher and the summary script.
  Installing the scheduled job needs the user's OK.
```

## Result

Setup only; the tables and the D9 check are the write-up task's. What the first runs showed
(2026-11-26):

- **Endpoints:** both boards, the replay search and replay logs answer to a generic User-Agent
  with no login or challenge. Each board lists 500 entries. A missing replay log returns 404.
- **Registered bots:** two in the bots-included top 500, guoguo10000 (#117, 1717) and imjustpixel2
  (#249, 1672). A bot rated below the default board's lowest `elo` can't be told from a human
  pushed off that board, so it is missed (`fetch.registered_bots`).
- **Saved replays are a small sample.** The search returned 646 replays for the two, back to
  2026-09-21, but only 29 were uploaded since opt-in matching began on 2026-10-20 (guoguo10000 6
  of 42, imjustpixel2 23 of 604), all rated ladder games. `summary.py` leaves games before
  2026-10-20 out of its history tables. In those 29 games the opponents' median was 1571 (range
  1393–1752). The boards' lifetime `w`+`l` totals, 337 for guoguo10000 and 4,222 for
  imjustpixel2, suggest far more games than replays; the write-up measures the share over the
  monitored days.
- **Sleep gaps:** launchd runs a missed interval once on wake, and this Mac slept ~60 of the 161
  hours before 2026-11-26 (`pmset -g log`). The user accepted the gaps. Games per day still add
  up across a gap, since they come from `w`/`l`/`t` deltas.

## Outputs

- Data dir, outside the repo since it holds other players' names: `~/.tychebot/t13-ladder-monitor/`.
  Layout in `fetch.py`'s docstring. Stdlib only, Python 3.14.
- Job: `tasks/T13-ladder-monitor/job.sh install | status | uninstall`, the launchd agent
  `local.tychebot.t13-ladder-monitor`. It runs hourly, from the copy of `fetch.py` that
  `install` puts in `<data dir>/bin/`, so it doesn't depend on any checkout. Rerun `install` to
  pick up an edit to `fetch.py`. Its output goes to `<data dir>/job.log`, and one line per run to
  `<data dir>/runs.jsonl`, with `"blocked": true` on a login wall or a block.
- One fetch by hand: `uv run --no-project tasks/T13-ladder-monitor/fetch.py <data dir>`.
- Tables, from whatever has been collected so far:
  `uv run --no-project tasks/T13-ladder-monitor/summary.py <data dir>`.

## For integration

1. **docs/checklist.md:** move T13 to Done, and add the write-up task to Ready once its date
   comes (Active until then is also fine). Proposed lines:

   > - T13: ladder-pool monitor, setup. Merged <date> ([PR](<url>)). The hourly job has run since
   >   2026-11-26; the write-up is T<NN>.

   > - T<NN>: ladder-pool write-up. [Brief](../tasks/T<NN>-ladder-writeup/README.md). Starts on or
   >   after 2026-12-10 22:52 UTC. Any session can check the job meanwhile with
   >   `tasks/T13-ladder-monitor/job.sh status`.

2. **New brief,** `tasks/T<NN>-ladder-writeup/README.md`:

   ```markdown
   # T<NN>: Ladder-pool write-up

   ## Brief

   - **Objective:** T13's objective, from the data its job collects.
   - **Inputs:** T13's fetcher, summary script and job (`tasks/T13-ladder-monitor/`, Outputs), its
     data dir `~/.tychebot/t13-ladder-monitor/` on this Mac, and D9 (What the bar takes).
   - **Deliverables and acceptance checks:** T13's, minus the fetcher and job. Result's tables
     are built by `tasks/T13-ladder-monitor/summary.py`, and proposed D9 text goes under For
     integration.
   - **May change:** `tasks/T<NN>-ladder-writeup/`. Fixes to T13's scripts are proposed under For
     integration, or made in this folder as copies.
   - **Limits:** one session, from 2026-12-10 22:52 UTC. Commit only aggregates and registered
     bots' names. Remove the job at the end (`tasks/T13-ladder-monitor/job.sh uninstall`), which
     is persistent configuration, after the snapshots it needs are in.
   - **Stop and report if,** checked first at session start:
     - `runs.jsonl` shows `"blocked": true`, or an endpoint needs a login;
     - fewer than two registered bots played rated games in the first week (to 2026-12-03).
   ```
