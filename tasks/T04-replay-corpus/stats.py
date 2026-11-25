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
        r"|lost by being unavailable at the start of a game\.|was disqualified from the tournament\."
        r"|lost by being banned\.|lost by being offline too long\.)$"
    ),
    "inactivity": re.compile(
        r"^\|-message\|(.* lost (the series )?due to inactivity\.|All players are inactive\.)$"
    ),
}
CUSTOM_RULES = re.compile(r"^\|raw\|.*<strong>\d+ custom rules?:</strong>")
RATING_LINE = re.compile(r"^\|raw\|.*'s rating: \d+ &rarr; <strong>(\d+)</strong>")

# Ladder games with neither a rating nor rating lines, accepted by the user on 2026-11-24 (Result).
ACCEPTED_UNRATED = {f"{FORMAT}-{number}" for number in (
    2717751610, 2717861354, 2718189460, 2718273993, 2718277604, 2718277703, 2718278550,
    2718280135, 2718282827, 2718284464, 2718398731, 2718446782, 2718450964, 2718605709,
    2718636878, 2718669421, 2718788206, 2718913139, 2719015572, 2719020541,
)}

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

    sizes = {line.split("|")[2]: int(line.split("|")[3]) for line in lines if line.startswith("|teamsize|")}
    # Pokemon each side has left at the end. Revival Blessing brings fainted ones back.
    left = {
        side: size
        - sum(line.startswith(f"|faint|{side}") for line in lines)
        + sum(line.startswith(f"|-heal|{side}") and line.endswith("[from] move: Revival Blessing") for line in lines)
        for side, size in sizes.items()
    }

    # Cross-check on the label: the loser has fainted out exactly when nobody forfeited or timed out.
    ending_matches_faints = None
    result = lines[results[0]] if results else ""
    if result.startswith("|win|"):
        sides = {}
        for line in lines:
            part = line.split("|")
            if line.startswith("|player|") and len(part) > 3 and part[3]:
                sides.setdefault(part[2], part[3])
        losers = [side for side, name in sides.items() if name != result[len("|win|"):]]
        if len(losers) == 1 and losers[0] in left:
            ending_matches_faints = (left[losers[0]] <= 0) == (ending == "played out")

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
        "rating_lines_ok": bool(results) and len(rating_at) == 2 and min(rating_at) > results[0],
        "new_ratings": new_ratings,
        "ending_matches_faints": ending_matches_faints,
        "fainted": sum(line.startswith("|faint|") for line in lines),
        "fewest_left": min(left.values(), default=None),
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
    ladder = [g for g in games if g["rating"] is not None or g["kind"] == "ladder"]
    unscored = [g for g in ladder
                if g["id"] in ACCEPTED_UNRATED and g["rating"] is None and not g["new_ratings"]]
    accepted = {g["id"] for g in unscored}
    rated = [g for g in ladder if g["id"] not in accepted]
    bad = [g["id"] for g in rated if g["rating"] is None or not g["rating_lines_ok"]]
    check(not bad, f"{len(rated)} rated games: a rating, and two |raw| rating lines after the result {bad[:10]}")
    if unscored:
        early = sum(g["uploadtime"] < g["last_timestamp"] for g in unscored)
        print(f"info  accepted exception: {len(unscored)} ladder games have no rating and no rating lines; "
              f"{early} were uploaded before the log's last |t:| timestamp")
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


def played_out(game):
    return game["ending"] == "played out"


def played_out_or_nearly(game):
    """Also counts a cut game with a side down to one Pokemon as ending where it was cut."""
    return played_out(game) or (game["fewest_left"] is not None and game["fewest_left"] <= 1)


def still_going(games, is_finished=played_out):
    """Kaplan-Meier share of games lasting past turn 0, 1, 2, ..., with its 95% interval.

    A game cut off during turn t is known to have reached turn t, not whether it would have
    ended there. From that turn on it is taken to behave like the games still being watched.
    """
    turns = np.array([g["turns"] for g in games])
    finished = np.array([is_finished(g) for g in games])
    span = range(turns.max() + 1)
    at_risk = np.array([((turns > t) | (finished & (turns == t))).sum() for t in span])
    ended = np.array([(finished & (turns == t)).sum() for t in span])
    share = np.cumprod(1 - ended / np.maximum(at_risk, 1))
    with np.errstate(divide="ignore", invalid="ignore"):
        # Greenwood's variance on the log(-log) scale, which keeps the interval inside 0 to 1.
        terms = np.where(ended > 0, ended / (at_risk * (at_risk - ended)), 0)
        spread = 1.96 * np.sqrt(np.cumsum(terms)) / np.abs(np.log(share))
        return share, share ** np.exp(spread), share ** np.exp(-spread)


def corrected_lengths(games):
    turns = np.array([g["turns"] for g in games])
    horizon = max(g["turns"] for g in games if played_out(g))
    share, low, high = still_going(games)
    nearly = still_going(games, played_out_or_nearly)[0]

    def reached(curve, level):
        return str(int(np.argmax(curve <= level))) if (curve <= level).any() else "-"

    def quantile(level):
        return f"{reached(share, level)} ({reached(low, level)} to {reached(high, level)})"

    print("\n### Lengths corrected for games cut short (Kaplan-Meier, 95% intervals)\n")
    print("| measure | observed | corrected | corrected, nearly decided games counted as ended |")
    print("|---|---|---|---|")
    print(f"| median turns | {np.median(turns):g} | {quantile(0.5)} | {reached(nearly, 0.5)} |")
    print(f"| p90 turns | {np.percentile(turns, 90):g} | {quantile(0.1)} | {reached(nearly, 0.1)} |")
    print(f"| mean turns, counting each game up to turn {horizon} | {np.minimum(turns, horizon).mean():.1f} "
          f"| {share[:horizon].sum():.1f} | {nearly[:horizon].sum():.1f} |")
    for t in sorted({50, 100, horizon}):
        if t <= horizon:
            print(f"| share past turn {t} | {percent((turns > t).sum(), len(turns))} "
                  f"| {100 * share[t]:.1f}% ({100 * low[t]:.1f} to {100 * high[t]:.1f}) | {100 * nearly[t]:.1f}% |")
    beyond = [g for g in games if g["turns"] > 100]
    print(f"\nGames observed past turn 100: {len(beyond)}, of them played out: {sum(map(played_out, beyond))}.")
    print(f"\nLongest game played out: {horizon} turns. Games cut off later than that: {(turns > horizon).sum()}, "
          f"the last at turn {turns.max()}. Nothing is estimated past it.")
    cut = [g for g in games if g["ending"] != "played out" and g["fewest_left"] is not None]
    print(f"Of {len(cut)} cut games that started, {sum(g['fewest_left'] <= 1 for g in cut)} ended with a side "
          f"down to one Pokemon or none.")


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
           ("all, without custom rules", [g for g in games if not g["custom_rules"]]),
           ("not ended by forfeit or inactivity, without custom rules",
            [g for g in played if not g["custom_rules"]]),
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

    corrected_lengths(games)

    ratings = np.array([g["rating"] for g in games if g["rating"] is not None])
    print("\n### Rating distribution (the lower player's rating after the game)\n")
    print("| band | n | share |\n|---|---|---|")
    counts = collections.Counter(map(band, games))
    for label in [label for label, _ in BANDS] + ["no rating"]:
        print(f"| {label} | {counts[label]} | {percent(counts[label], len(games))} |")
    q = np.percentile(ratings, [0, 25, 50, 75, 90, 99, 100])
    print("\nGames with a rating, min / p25 / median / p75 / p90 / p99 / max: " + " / ".join(f"{v:g}" for v in q))


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
    long = sorted((g for g in corpus + high if g["turns"] > 100), key=lambda g: -g["turns"])
    print(f"\n## Both samples, over 100 turns: {len(long)} games, {quit_early(long)} ended by forfeit or inactivity\n")
    for g in long:
        print(f"{g['turns']} turns, {g['id']}, {g['ending']}, {g['fainted']} Pokemon fainted")
    if failures:
        sys.exit(f"\n{len(failures)} checks failed")


if __name__ == "__main__":
    main()
