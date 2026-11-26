# T13: Ladder-pool monitor

## Brief

- **Objective:** measure who a registered bot meets on the `gen9nationaldex` ladder, and how often. Then check D9's estimate of the win rate the target takes. A bot is matched only with opted-in players and other bots (D9, What the bar takes), and that estimate rests on 11 replays. The answer shows whether the target is reachable and what it rewards, long before the online gate.
- **Inputs:**
  - D9 (Target, What the bar takes), and prior-work.md (MissingNo, Ladder: the bot registry and opt-in policy).
  - Public endpoints, read-only: the ladder JSON `https://pokemonshowdown.com/ladder/gen9nationaldex.json`, with `?includebots` for the bots-included board; replay search `https://replay.pokemonshowdown.com/search.json?user=<name>&format=gen9nationaldex`; and replay logs `https://replay.pokemonshowdown.com/<id>.log`. A registered bot is an account that shows on the bots-included board but not the default one.
- **Deliverables,** in this folder:
  - A fetcher. Every hour it snapshots both boards, and every day it collects the new replays of each registered bot in the bots-included top 500. It runs as a scheduled job on this Mac for at least 14 days.
  - A summary script, which builds Result's tables from the snapshots and replays:
    - #10 and #1 over time;
    - each registered bot's rating over time and its rated games per day;
    - the ratings of the opponents it met (each replay log's `|player|` lines carry both players' ratings), and its win rate by rating gap;
    - how many distinct opponents the bots met per week.
  - Result: those tables, and whether the bots' opponents and win rates by rating gap fit what D9's estimate assumes: opponents around 1550–1650, and win rates near the Elo expectation (~77–86% to hold #10, ~85–91% to hold #1). Proposed D9 text goes under For integration.
- **Acceptance checks:**
  - ≥14 days of hourly snapshots, with any gaps listed.
  - The replays of every registered bot in the top 500 over those days.
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

## Result

## Outputs

## For integration
