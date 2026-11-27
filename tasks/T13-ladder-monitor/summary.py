# /// script
# requires-python = ">=3.14"
# ///
"""Result's tables from fetch.py's data dir, as Markdown on stdout.

uv run --no-project tasks/T13-ladder-monitor/summary.py <data dir>

Ratings are the ladder's `elo` field. Only aggregates and registered bots' names
are printed, so the output can be committed.
"""

import datetime as dt
import gzip
import json
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

from fetch import flagged, read_index

GAP_BANDS = [(-10_000, -300), (-300, -200), (-200, -100), (-100, 0), (0, 100), (100, 200), (200, 10_000)]
GAP_FLOOR = 90 * 60  # snapshots further apart than this count as a gap
# Registered bots are matched only with opted-in players and other bots since then
# (prior-work.md, MissingNo ladder).
POLICY_START = int(dt.datetime(2026, 10, 20, tzinfo=dt.UTC).timestamp())


def toid(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def day(t):
    return dt.datetime.fromtimestamp(t, dt.UTC).strftime("%Y-%m-%d")


def stamp(t):
    return dt.datetime.fromtimestamp(t, dt.UTC).strftime("%Y-%m-%d %H:%M")


def expected(bot, opp):
    return 1 / (1 + 10 ** ((opp - bot) / 400))


def band(rating, width=100):
    low = int(rating // width * width)
    return f"{low}-{low + width - 1}"


def load_snapshots(data):
    """Snapshots by time, with each registered bot's row: its board row while it is in
    the top 500, else its profile entry (which has no ties, so they carry over)."""
    snaps = []
    for path in (data / "snapshots").glob("*.json.gz"):
        s = json.loads(gzip.decompress(path.read_bytes()))
        default = s["default"]["toplist"]
        flags = set(flagged(s["default"], s["bots"]))
        snaps.append({
            "time": s["time"], "top1": default[0]["elo"], "top10": default[9]["elo"],
            "board": {r["userid"]: r for r in s["bots"]["toplist"] if r["userid"] in flags},
            "profiles": s.get("profiles", {}),
        })
    snaps.sort(key=lambda s: s["time"])
    # As in fetch.py: a bot once flagged in two snapshots in a row.
    bots = set().union(*(set(a["board"]) & set(b["board"]) for a, b in zip(snaps, snaps[1:])))
    ties = {}
    for snap in snaps:
        snap["rows"] = {}
        for uid in bots:
            if uid in snap["board"]:
                row = snap["board"][uid]
                ties[uid] = row["t"]
            elif snap["profiles"].get(uid):
                row = {**snap["profiles"][uid], "t": ties.get(uid, 0)}
            else:
                continue
            snap["rows"][uid] = row
    return snaps, bots


def parse_log(text):
    """Players with pre-game ratings, winner, rated flag and start time of one log."""
    players, winner, rated, start = {}, None, None, None
    for line in text.splitlines():
        parts = line.split("|")
        if len(parts) < 2:
            continue
        kind = parts[1]
        if kind == "player" and len(parts) >= 6 and parts[3] and parts[5]:
            players.setdefault(parts[2], (toid(parts[3]), int(parts[5])))
        elif kind == "rated":
            rated = parts[2] if len(parts) > 2 else ""
        elif kind == "win":
            winner = toid(parts[2])
        elif kind == "tie":
            winner = ""
        elif kind == "t:" and start is None:
            start = int(parts[2])
    return players, winner, rated, start


def load_games(data, bots):
    """One row per (bot, saved ladder replay) with a result."""
    index = data / "replays" / "index.jsonl"
    games, skipped = [], defaultdict(int)
    if not index.exists():
        return games, skipped
    seen = set()
    for entry in read_index(index):
        path = data / "replays" / f"{entry['id']}.log.gz"
        if not path.exists():
            skipped["private"] += 1
            continue
        players, winner, rated, start = parse_log(gzip.decompress(path.read_bytes()).decode())
        if rated != "":
            skipped["not a ladder game"] += 1
            continue
        if winner is None or len(players) != 2:
            skipped["no result or ratings"] += 1
            continue
        for side, (uid, rating) in players.items():
            if uid not in bots or (entry["id"], uid) in seen:
                continue
            seen.add((entry["id"], uid))
            opp = next(p for s, p in players.items() if s != side)
            games.append({
                "id": entry["id"], "bot": uid, "rating": rating, "opp": opp[0], "opp_rating": opp[1],
                "score": 0.5 if winner == "" else float(winner == uid),
                "start": start or entry["uploadtime"], "opp_is_bot": opp[0] in bots,
            })
    return games, skipped


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c) for c in row) + " |" for row in rows]
    return "\n".join(out)


def pct(x):
    return f"{100 * x:.1f}%"


def snapshot_section(snaps):
    out = ["## Snapshots", ""]
    start, end = snaps[0]["time"], snaps[-1]["time"]
    gaps = [(a["time"], b["time"]) for a, b in zip(snaps, snaps[1:]) if b["time"] - a["time"] > GAP_FLOOR]
    out.append(f"{len(snaps)} snapshots, {stamp(start)} to {stamp(end)} UTC ({(end - start) / 86400:.1f} days).")
    out.append(f"Gaps over {GAP_FLOOR // 60} minutes: {len(gaps)}, {sum(b - a for a, b in gaps) / 3600:.1f} hours in all.")
    out.append("")
    if gaps:
        out.append(table(["from (UTC)", "to (UTC)", "hours"], [(stamp(a), stamp(b), f"{(b - a) / 3600:.1f}") for a, b in gaps]))
        out.append("")

    out += ["### #1 and #10 on the default board, by day (UTC)", ""]
    by_day = defaultdict(list)
    for s in snaps:
        by_day[day(s["time"])].append(s)
    rows = []
    for d, ss in sorted(by_day.items()):
        t1, t10 = [s["top1"] for s in ss], [s["top10"] for s in ss]
        rows.append((d, len(ss), f"{min(t1):.0f}-{max(t1):.0f}", f"{ss[-1]['top1']:.0f}", f"{min(t10):.0f}-{max(t10):.0f}", f"{ss[-1]['top10']:.0f}"))
    out.append(table(["day", "snapshots", "#1 range", "#1 last", "#10 range", "#10 last"], rows))
    out.append("")
    return out


def bot_snapshot_stats(snaps):
    """Per bot and day: last rating, and games, wins and ties from w/l/t deltas,
    credited to the day of the later snapshot. "after_gap" is the part credited
    across a gap, and "tracked" the seconds covered by consecutive rows."""
    stats = defaultdict(lambda: defaultdict(lambda: {"games": 0, "wins": 0, "ties": 0, "after_gap": 0}))
    tracked = defaultdict(int)
    for a, b in zip(snaps, snaps[1:]):
        for uid, row in b["rows"].items():
            cell = stats[uid][day(b["time"])]
            cell["elo"] = row["elo"]
            cell["low"] = min(cell.get("low", row["elo"]), row["elo"])
            cell["high"] = max(cell.get("high", row["elo"]), row["elo"])
            if uid in a["rows"]:
                prev = a["rows"][uid]
                games = (row["w"] + row["l"] + row["t"]) - (prev["w"] + prev["l"] + prev["t"])
                cell["games"] += games
                cell["wins"] += row["w"] - prev["w"]
                cell["ties"] += row["t"] - prev["t"]
                if b["time"] - a["time"] > GAP_FLOOR:
                    cell["after_gap"] += games
                tracked[uid] += b["time"] - a["time"]
    for uid, row in snaps[0]["rows"].items():
        cell = stats[uid][day(snaps[0]["time"])]
        cell.setdefault("elo", row["elo"])
        cell["low"] = min(cell.get("low", row["elo"]), row["elo"])
        cell["high"] = max(cell.get("high", row["elo"]), row["elo"])
    return stats, tracked


def bots_section(snaps, stats, tracked):
    out = ["## Registered bots", ""]
    rows = []
    for uid in sorted(stats):
        days = stats[uid]
        games = sum(c["games"] for c in days.values())
        wins = sum(c["wins"] + 0.5 * c["ties"] for c in days.values())
        lows = [c["low"] for c in days.values() if "low" in c]
        highs = [c["high"] for c in days.values() if "high" in c]
        on_board = sum(uid in s["board"] for s in snaps)
        per_day = f"{games / (tracked[uid] / 86400):.1f}" if tracked[uid] else "-"
        rows.append((uid, f"{on_board}/{len(snaps)}", f"{min(lows):.0f}-{max(highs):.0f}", games, per_day,
                     pct(wins / games) if games else "-"))
    out.append(table(["bot", "in top 500 (snapshots)", "rating range", "rated games", "games/day", "score"], rows))
    out += ["", "Games and score come from the change in `w`, `l` and `t` between consecutive snapshots, from the board "
            "while the bot is in the top 500 and from its profile otherwise. A tie scores half. Games per day divide by "
            "the time those snapshot pairs cover.", ""]
    for uid in sorted(stats):
        out += [f"### {uid}, by day (UTC)", ""]
        out.append(table(["day", "last rating", "games", "wins", "ties", "games across a gap"],
                         [(d, f"{c['elo']:.0f}" if "elo" in c else "-", c["games"], c["wins"], c["ties"], c["after_gap"])
                          for d, c in sorted(stats[uid].items())]))
        out += ["", f"Games across a gap were played during a gap over {GAP_FLOOR // 60} minutes that ended that day, "
                "possibly on an earlier day.", ""]
    return out


def d9_section(snaps, sets):
    """The score that holds #10's and #1's current rating against the opponents met."""
    out = ["## Score needed to hold #10 and #1 against these opponents", "",
           "Mean Elo expectation of a player rated at the last snapshot's #10 or #1 against each opponent rating seen. "
           "Holding a rating takes scoring this.", ""]
    rows = []
    for name, games in sets:
        if not games:
            continue
        for rank, rating in (("#10", snaps[-1]["top10"]), ("#1", snaps[-1]["top1"])):
            need = sum(expected(rating, g["opp_rating"]) for g in games) / len(games)
            rows.append((name, rank, f"{rating:.0f}", len(games), pct(need)))
    out.append(table(["games", "rank", "rating", "n", "score needed"], rows))
    out.append("")
    return out


def replay_section(title, games, note):
    out = [f"## {title}", "", note, ""]
    if not games:
        return out + ["No games.", ""]
    opp = [g["opp_rating"] for g in games]
    q = statistics.quantiles(opp, n=10) if len(opp) >= 2 else [opp[0]] * 9
    out.append(f"{len(games)} games. Opponent rating: median {statistics.median(opp):.0f}, p10 {q[0]:.0f}, p90 {q[-1]:.0f}, "
               f"range {min(opp)}-{max(opp)}. Bot against bot: {sum(g['opp_is_bot'] for g in games)}.")
    out.append("")

    out += ["### Opponents by the bot's rating at the time", ""]
    rows = []
    for (uid, b), gs in sorted(group(games, lambda g: (g["bot"], band(g["rating"]))).items()):
        o = [g["opp_rating"] for g in gs]
        rows.append((uid, b, len(gs), f"{statistics.median(o):.0f}", f"{min(o)}-{max(o)}",
                     pct(sum(g["score"] for g in gs) / len(gs)), pct(sum(expected(g["rating"], g["opp_rating"]) for g in gs) / len(gs))))
    out.append(table(["bot", "bot rating", "games", "opp median", "opp range", "score", "Elo expectation"], rows))
    out.append("")

    out += ["### Score by rating gap (opponent minus bot)", ""]
    rows = []
    for b in sorted({band(g["rating"]) for g in games}):
        for low, high in GAP_BANDS:
            gs = [g for g in games if band(g["rating"]) == b and low <= g["opp_rating"] - g["rating"] < high]
            if gs:
                label = f"< {high}" if low == GAP_BANDS[0][0] else f">= {low}" if high == GAP_BANDS[-1][1] else f"{low} to {high - 1}"
                rows.append((b, label, len(gs), pct(sum(g["score"] for g in gs) / len(gs)),
                             pct(sum(expected(g["rating"], g["opp_rating"]) for g in gs) / len(gs))))
    out.append(table(["bot rating", "gap", "games", "score", "Elo expectation"], rows))
    out.append("")

    out += ["### Distinct opponents per ISO week", ""]
    rows = []
    for (uid, week), gs in sorted(group(games, lambda g: (g["bot"], "%d-W%02d" % dt.datetime.fromtimestamp(g["start"], dt.UTC).isocalendar()[:2])).items()):
        rows.append((uid, week, len(gs), len({g["opp"] for g in gs})))
    out.append(table(["bot", "week", "games", "distinct opponents"], rows))
    out.append("")
    return out


def group(items, key):
    out = defaultdict(list)
    for item in items:
        out[key(item)].append(item)
    return out


def coverage_section(snaps, stats, games):
    """Saved replays against the games the snapshots show, over the monitored days."""
    out = ["## Saved replays against snapshot games", ""]
    rows = []
    for uid in sorted(stats):
        snap_games = sum(c["games"] for c in stats[uid].values())
        snap_score = sum(c["wins"] + 0.5 * c["ties"] for c in stats[uid].values())
        # Games the snapshots can see: after the first snapshot that shows the bot.
        first = next(s["time"] for s in snaps if uid in s["rows"])
        gs = [g for g in games if g["bot"] == uid and g["start"] >= first and g["start"] <= snaps[-1]["time"]]
        rows.append((uid, snap_games, len(gs), pct(len(gs) / snap_games) if snap_games else "-",
                     pct(snap_score / snap_games) if snap_games else "-", pct(sum(g["score"] for g in gs) / len(gs)) if gs else "-"))
    out.append(table(["bot", "snapshot games", "saved replays", "share saved", "snapshot score", "replay score"], rows))
    out += ["", "Replays count when the game started after the bot's first snapshot and before the last snapshot.", ""]
    return out


def main(data):
    snaps, bots = load_snapshots(data)
    if not snaps:
        sys.exit("no snapshots")
    stats, tracked = bot_snapshot_stats(snaps)
    games, skipped = load_games(data, bots)
    start, end = snaps[0]["time"], snaps[-1]["time"]
    window = [g for g in games if start <= g["start"] <= end]
    since = [g for g in games if g["start"] >= POLICY_START]
    out = ["# T13 ladder-pool summary", "", f"Generated from {data.name}: {stamp(start)} to {stamp(end)} UTC.", ""]
    out += snapshot_section(snaps)
    out += bots_section(snaps, stats, tracked)
    out += coverage_section(snaps, stats, games)
    skipped_note = ", ".join(f"{k}: {v}" for k, v in sorted(skipped.items())) or "none"
    out += replay_section("Saved replays during the monitored days", window,
                          f"Rated ladder replays of the bots above that started between the first and last snapshot. Left out of the whole index: {skipped_note}.")
    out += replay_section("Saved replays since opt-in matching began", since,
                          f"Every rated ladder replay the search returned for these bots that started on or after {day(POLICY_START)}, "
                          "including those before monitoring began.")
    out += d9_section(snaps, [("monitored days", window), ("since opt-in matching", since)])
    print("\n".join(out))


if __name__ == "__main__":
    main(Path(sys.argv[1]).expanduser().resolve())
