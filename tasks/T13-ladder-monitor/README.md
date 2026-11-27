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
2026-11-27 (3)
State: done (the setup half; the write-up is proposed as its own task under For integration)
Verified: review pass 2 (Sonnet, high) fixes are in: a failed profile no longer costs the board
  snapshot; a replay log that 404s is retried at the next collection; a cut-short index line is
  skipped; summary rating ranges use every snapshot; the write-up brief removes the job before
  its last collection. 5 tests pass. The job was reinstalled with this fetch.py and its run
  exited 0.
Pending: nothing here.
Next: a planning session merges and briefs the write-up task.
Reviewed: user, passes 1 and 2 (2026-11-27), fixes in cd3efbd, 5831cbb and the commit adding
  this entry
```

```text
2026-11-27 (2)
State: done (the setup half, as in the entry below)
Verified: review pass 1 (Sonnet, high) fixes are in at cd3efbd. fetch.py also snapshots each
  bot's public profile, so a bot that drops out of the top 500 is still tracked (imjustpixel2 was
  17 points above the cutoff); an account counts as a bot only after two flags in a row; a
  persistent 429 counts as blocked; one failed log no longer aborts a collection; state.json is
  written atomically; `--collect` forces a collection. summary.py gains the D9 table, games/day
  over covered time, and games credited across gaps. 5 tests pass. The job was reinstalled
  2026-11-27 04:49 UTC; its run fetched both profiles and exited 0, and the installed copy
  matches the committed fetch.py.
Pending: review pass 2.
Next: review pass 2, then the planning session merges.
```

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
  (#248, 1672). By 2026-11-27 imjustpixel2 was at 1639, 17 points above the board's 500th, so
  `fetch.py` also reads each bot's profile (`pokemonshowdown.com/users/<id>.json`, which gives
  `elo`, `w` and `l` but not `t`) and keeps tracking a bot off the board. That endpoint is an
  addition to the brief's Inputs: public, read-only, at the same request rate.
- **False flags:** the boards are fetched seconds apart, so a human who climbs past the default
  board's cutoff in between shows up as a bot once. An account counts as a bot only after two
  snapshots in a row flag it, in both scripts.
- **Saved replays are a small sample.** The search returned 646 replays for the two, guoguo10000's
  back to 2026-09-23 and imjustpixel2's to 2023-12-23, but only 29 were uploaded since opt-in matching began on 2026-10-20 (guoguo10000 6
  of 42, imjustpixel2 23 of 604), all rated ladder games. `summary.py` leaves games before
  2026-10-20 out of its history tables. In those 29 games the opponents' median was 1571 (range
  1393–1752). The boards' lifetime `w`+`l` totals, 337 for guoguo10000 and 4,222 for
  imjustpixel2, suggest far more games than replays; the write-up measures the share over the
  monitored days. Against those 29 games' opponents, holding the 2026-11-27 #10 (1863) takes an
  83.7% score and holding #1 (1929) 88.1%, inside D9's ~77–86% and ~85–91%.
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
- One fetch by hand: `uv run --no-project tasks/T13-ladder-monitor/fetch.py <data dir> [--collect]`,
  where `--collect` forces a replay collection. Not while the job is running a collection: two
  runs at once break the one-request-per-second limit.
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
     integration, or made in this folder as copies of both scripts (`summary.py` imports from
     `fetch.py`).
   - **Spec:** T13's Brief, with this brief taking precedence. T13 closes without its acceptance
     checks, which are this task's.
   - **Limits:** one session, from 2026-12-10 22:52 UTC. Commit only aggregates and registered
     bots' names. When the snapshots it needs are in, remove the job
     (`tasks/T13-ladder-monitor/job.sh uninstall`), which is persistent configuration, and then
     run a last collection by hand
     (`uv run --no-project ~/.tychebot/t13-ladder-monitor/bin/fetch.py ~/.tychebot/t13-ladder-monitor --collect`),
     never both at once. Sleep gaps are expected and only need listing; `runs.jsonl` tells a dead
     job from sleep.
   - **If few replays:** with under 30 saved replays in the monitored days, the likely case
     (29 since 2026-10-20 on 2026-11-27, 23 of them imjustpixel2's), report the snapshot tables
     and the since-opt-in replay tables, labelled as such, and say how few games the D9 check
     rests on, rather than stopping.
   - **Stop and report if,** checked first at session start:
     - `runs.jsonl` shows `"blocked": true`, or an endpoint needs a login;
     - fewer than two registered bots played rated games in the first week (to 2026-12-03), from
       the per-day tables. guoguo10000 last played on 2026-11-25, so this may trigger.
   ```
