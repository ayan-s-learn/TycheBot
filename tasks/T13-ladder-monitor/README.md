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
2026-11-26 (2)
State: waiting_for_job (`tasks/T13-ladder-monitor/job.sh status`; runs.jsonl in the data dir)
Verified: both boards, the replay search and replay logs answer without a login (2026-11-26).
  fetch.py's first run snapshotted both boards and backfilled 646 saved replays of the two
  registered bots, guoguo10000 and imjustpixel2, in 14 minutes. The user approved the launchd
  agent on 2026-11-26; it is installed and its first run exited 0. The 3 tests pass
  (`uv run --no-project --with pytest==9.2.0 pytest -p no:cacheprovider tasks/T13-ladder-monitor`).
Pending: >=14 days of snapshots (until at least 2026-12-10 22:52 UTC); the rest of the
  acceptance checks; Result.
Next: after 2026-12-10, run summary.py on the data dir, check runs.jsonl for errors and
  `"blocked": true`, then write Result and For integration and remove the job
  (`job.sh uninstall`). Check the first week (to 2026-12-03) for the stop condition on
  fewer than two bots playing rated games.
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

## Outputs

- Data dir, outside the repo since it holds other players' names: `~/.tychebot/t13-ladder-monitor/`.
  Layout in `fetch.py`'s docstring. Stdlib only, Python 3.14.
- Job: `tasks/T13-ladder-monitor/job.sh install | status | uninstall` (launchd agent
  `local.tychebot.t13-ladder-monitor`, hourly, running `fetch.py` from this checkout). Installed
  2026-11-26 from the worktree `.claude/worktrees/T13-ladder-monitor`, so that worktree must stay
  until the job is removed. launchd runs a missed interval once on wake, so the Mac's sleep leaves
  gaps: it slept ~60 of the 161 hours before 2026-11-26 (`pmset -g log`).
- One fetch by hand: `uv run --no-project tasks/T13-ladder-monitor/fetch.py <data dir>`.
- Tables: `uv run --no-project tasks/T13-ladder-monitor/summary.py <data dir>`.

## For integration
