"""Check the committed replay files and print the figures in this task's Result.

uv run tasks/T04-replay-corpus/stats.py

Exits non-zero if an acceptance check fails. Percentiles interpolate linearly.
"""

import collections
import gzip
import json
import re
import sys
import time
from pathlib import Path

import numpy as np

from replay import FORMAT, HIGH_RATING, result_lines

DATA = Path(__file__).resolve().parents[2] / "data/replays/v0"
BANDS = [("<1100", 0), ("1100-1199", 1100), ("1200-1299", 1200), ("1300-1499", 1300), ("1500+", 1500)]
# Server messages that end a game early, from Showdown's server/ code (room battles and tournaments).
ENDINGS = {
    "forfeit": re.compile(
        r"^\|-message\|.* (forfeited\.|forfeited the series\.|forfeited by changing their name\."
        r"|lost by having an inappropriate name\.|was made to forfeit\."
        r"|lost by being unavailable at the start of a game\.|was disqualified from the tournament\.)$"
    ),
    "inactivity": re.compile(
        r"^\|-message\|(.* lost (the series )?due to inactivity\.|All players are inactive\.)$"
    ),
}
CUSTOM_RULES = re.compile(r"^\|raw\|.*<strong>\d+ custom rules?:</strong>")
RATING_LINE = re.compile(r"^\|raw\|.*'s rating: \d+ &rarr; <strong>(\d+)</strong>")

failures = []


def check(ok, what):
    print(f"{'PASS' if ok else 'FAIL'}  {what}")
    if not ok:
        failures.append(what)


def kind_of(lines):
    """From the |rated| line: ladder games have an empty one, tournament games a label."""
    if "|rated|" in lines:
        return "ladder"
    return "tournament" if any(line.startswith("|rated|") for line in lines) else "not rated"


def parse(record):
    lines = record["log"].split("\n")
    results = result_lines(lines)
    turns = [int(line.split("|")[2]) for line in lines if line.startswith("|turn|")]
    ending = next((name for name, pattern in ENDINGS.items() if any(map(pattern.match, lines))), "played out")
    rating_at = [i for i, line in enumerate(lines) if RATING_LINE.match(line)]
    new_ratings = [int(RATING_LINE.match(lines[i])[1]) for i in rating_at]

    # Cross-check on the label: the loser has fainted out exactly when nobody forfeited or timed out.
    ending_matches_faints = None
    result = lines[results[0]] if results else ""
    if result.startswith("|win|"):
        sides, sizes = {}, {}
        for line in lines:
            part = line.split("|")
            if line.startswith("|player|") and len(part) > 3 and part[3]:
                sides.setdefault(part[2], part[3])
            elif line.startswith("|teamsize|"):
                sizes[part[2]] = int(part[3])
        losers = [side for side, name in sides.items() if name != result[len("|win|"):]]
        if len(losers) == 1 and losers[0] in sizes:
            fainted = sum(line.startswith(f"|faint|{losers[0]}") for line in lines) - sum(
                line.startswith(f"|-heal|{losers[0]}") and line.endswith("[from] move: Revival Blessing")
                for line in lines
            )
            ending_matches_faints = (fainted >= sizes[losers[0]]) == (ending == "played out")

    return {
        **record,
        "turns": max(turns, default=0),
        "ending": ending,
        "tie": result.startswith("|tie"),
        "custom_rules": any(map(CUSTOM_RULES.match, lines)),
        "kind": kind_of(lines),
        "last_timestamp": max((int(line.split("|")[2]) for line in lines if line.startswith("|t:|")), default=0),
        "results": len(results),
        "chat": any(line.startswith(("|c|", "|c:|")) for line in lines),
        "rating_lines_ok": bool(results) and bool(rating_at) and min(rating_at) > results[0],
        "new_ratings": new_ratings,
        "ending_matches_faints": ending_matches_faints,
    }


def load(name):
    with gzip.open(DATA / name, "rt") as f:
        return [parse(json.loads(line)) for line in f]


def band(game):
    if game["rating"] is None:
        return "no rating"
    return [label for label, low in BANDS if game["rating"] >= low][-1]


def check_games(name, games):
    print(f"\n### Checks: {name}")
    check(len({g["id"] for g in games}) == len(games), f"{len(games)} replays, all ids distinct")
    check(all(g["formatid"] == FORMAT for g in games), f"every formatid is {FORMAT}")
    check(all(g["results"] == 1 for g in games), "every log has exactly one |win| or |tie line")
    rated = [g for g in games if g["rating"] is not None or g["kind"] == "ladder"]
    bad = [g["id"] for g in rated if not g["rating_lines_ok"]]
    check(not bad, f"{len(rated)} ladder games: |raw| rating lines follow the result "
                   f"({len(bad)} without them {bad[:5]})")
    if bad:
        early = sum(g["uploadtime"] < g["last_timestamp"] for g in games if g["id"] in bad)
        print(f"info  of those, uploaded before the log's last |t:| timestamp: {early}")
    check(not any(g["chat"] for g in games), "no |c| or |c:| lines")
    differ = [g["id"] for g in rated if g["new_ratings"] and g["rating"] != min(g["new_ratings"])]
    print(f"info  rating differs from the lower new rating in the log: {len(differ)} games {differ[:10]}")
    cross = [g for g in games if g["ending_matches_faints"] is not None]
    differ = [g["id"] for g in cross if not g["ending_matches_faints"]]
    print(f"info  forfeit/inactivity label disagrees with the loser's faint count: "
          f"{len(differ)} of {len(cross)} decided games {differ[:10]}")


def quit_early(games):
    return sum(g["ending"] != "played out" for g in games)


def percent(n, total):
    return f"{100 * n / total:.1f}%" if total else "-"


def table(rows):
    print("| games | n | median | mean | p90 | max | forfeit or inactivity |")
    print("|---|---|---|---|---|---|---|")
    for label, games in rows:
        if not games:
            print(f"| {label} | 0 | - | - | - | - | - |")
            continue
        t = np.array([g["turns"] for g in games])
        print(f"| {label} | {len(t)} | {np.median(t):g} | {t.mean():.1f} | {np.percentile(t, 90):g} "
              f"| {t.max()} | {percent(quit_early(games), len(games))} |")


def report(name, games):
    times = sorted(g["uploadtime"] for g in games)
    first, last = (time.strftime("%Y-%m-%d %H:%M", time.gmtime(t)) for t in (times[0], times[-1]))
    players = collections.Counter(re.sub(r"[^a-z0-9]", "", p.lower()) for g in games for p in g["players"])
    endings = collections.Counter(g["ending"] for g in games)
    print(f"\n## {name}: {len(games)} replays")
    print(f"Uploaded {first} to {last} UTC.")
    print(f"Distinct players: {len(players)}. Most frequent: in {percent(players.most_common(1)[0][1], len(games))} "
          f"of games; the top 10 fill {percent(sum(n for _, n in players.most_common(10)), 2 * len(games))} of seats.")
    for ending in ("forfeit", "inactivity", "played out"):
        print(f"{ending}: {endings[ending]} ({percent(endings[ending], len(games))})")
    print(f"Ties: {sum(g['tie'] for g in games)}. Ended before turn 1: {sum(g['turns'] == 0 for g in games)}.")

    custom = [g for g in games if g["custom_rules"]]
    print(f"Custom-rule games: {len(custom)} ({percent(len(custom), len(games))}), "
          f"{sum(g['rating'] is not None for g in custom)} with a rating, "
          f"{sum(g['kind'] == 'tournament' for g in custom)} tournament games.")

    played = [g for g in games if g["ending"] == "played out"]
    print("\n### Turns per game\n")
    table([("all", games), ("not ended by forfeit or inactivity", played),
           ("ladder", [g for g in games if g["kind"] == "ladder"]),
           ("ladder, not ended by forfeit or inactivity", [g for g in played if g["kind"] == "ladder"])]
          + [(f"rating {label}", [g for g in games if band(g) == label]) for label, _ in BANDS]
          + [(f"no rating: {kind}", [g for g in games if g["rating"] is None and g["kind"] == kind])
             for kind in ("ladder", "tournament", "not rated")]
          + [("custom rules", custom)])

    t = np.array([g["turns"] for g in games])
    print(f"\nTotal turns {t.sum()}. p99 {np.percentile(t, 99):g}, p99.9 {np.percentile(t, 99.9):g}.")
    for cap in (50, 100, 150, 200, 300):
        over = int((t > cap).sum())
        beyond = int((t[t > cap] - cap).sum())
        print(f"Over {cap} turns: {over} games ({percent(over, len(t))}); "
              f"the turns past {cap} are {percent(beyond, int(t.sum()))} of all turns.")
    print("Longest: " + ", ".join(f"{g['turns']} ({g['id']}, {g['ending']})"
                                  for g in sorted(games, key=lambda g: -g["turns"])[:5]))

    ratings = np.array([g["rating"] for g in games if g["rating"] is not None])
    print("\n### Rating distribution (the lower player's rating after the game)\n")
    print("| band | n | share |\n|---|---|---|")
    counts = collections.Counter(map(band, games))
    for label in [label for label, _ in BANDS] + ["no rating"]:
        print(f"| {label} | {counts[label]} | {percent(counts[label], len(games))} |")
    q = np.percentile(ratings, [0, 25, 50, 75, 90, 99, 100])
    print("\nGames with a rating, min / p25 / median / p75 / p90 / p99 / max: " + " / ".join(f"{v:.0f}" for v in q))


def main():
    corpus = load("replays.jsonl.gz")
    high = load("high-rated.jsonl.gz")
    check_games("replays.jsonl.gz", corpus)
    check(len(corpus) >= 1000, "at least 1,000 replays")
    check_games("high-rated.jsonl.gz", high)
    check(len(high) <= 100, "at most 100 replays")
    check(all((g["rating"] or 0) >= HIGH_RATING for g in high), f"every rating is at least {HIGH_RATING}")
    check(not {g["id"] for g in high} & {g["id"] for g in corpus}, "none is in replays.jsonl.gz")
    report("Corpus", corpus)
    if high:
        report("High-rated sample", high)
    if failures:
        sys.exit(f"\n{len(failures)} checks failed")


if __name__ == "__main__":
    main()
