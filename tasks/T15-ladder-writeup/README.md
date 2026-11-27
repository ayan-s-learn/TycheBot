# T15: Ladder-pool write-up

## Brief

- **Objective:** T13's objective, from the data its job collects: who a registered bot meets on the `gen9nationaldex` ladder and how often, and whether that fits D9's estimate of the win rate the target takes.
- **Inputs:** T13's fetcher, summary script and job (`tasks/T13-ladder-monitor/`, Outputs), its data dir `~/.tychebot/t13-ladder-monitor/` on the user's Mac, and D9 (What the bar takes).
- **Deliverables and acceptance checks:** T13's, minus the fetcher and job. Result's tables are built by `tasks/T13-ladder-monitor/summary.py`, and proposed D9 text goes under For integration.
- **Spec:** T13's Brief, with this brief taking precedence. T13 closed without its acceptance checks, which are this task's.
- **May change:** `tasks/T15-ladder-writeup/`. Fixes to T13's scripts are proposed under For integration, or made in this folder as copies of both scripts (`summary.py` imports from `fetch.py`).
- **Limits:**
  - One session, on the user's Mac, from 2026-12-10 22:52 UTC.
  - Commit only aggregates and registered bots' names.
  - When the snapshots it needs are in, remove the job (`tasks/T13-ladder-monitor/job.sh uninstall`), which is persistent configuration. Then run a last collection by hand (`uv run --no-project ~/.tychebot/t13-ladder-monitor/bin/fetch.py ~/.tychebot/t13-ladder-monitor --collect`), never both at once.
  - Sleep gaps are expected and only need listing; `runs.jsonl` tells a dead job from sleep.
- **If few replays:** with under 30 saved replays in the monitored days, the likely case (29 since 2026-10-20 on 2026-11-27, 23 of them imjustpixel2's), report the snapshot tables and the since-opt-in replay tables, labelled as such. Say how few games the D9 check rests on, rather than stopping.
- **Stop and report if,** checked first at session start:
  - `runs.jsonl` shows `"blocked": true`, or an endpoint needs a login;
  - fewer than two registered bots played rated games in the first week (to 2026-12-03), from the per-day tables. guoguo10000 last played on 2026-11-25, so this may trigger.

## Progress

## Result

## Outputs

## For integration
