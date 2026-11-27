import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import fetch  # noqa: E402
import summary  # noqa: E402


def row(uid, elo, w, l, t=0):
    return {"userid": uid, "username": uid, "elo": elo, "w": w, "l": l, "t": t}


def board(rows):
    return {"formatid": "gen9nationaldex", "toplist": rows}


def humans():
    return [row(f"p{i}", 1800 - 20 * i, 100, 50) for i in range(12)]


def write_snapshot(data, t, bot_row):
    path = data / "snapshots" / f"{t}.json.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    bots = sorted(humans() + [bot_row], key=lambda r: -r["elo"])
    path.write_bytes(gzip.compress(json.dumps({"time": t, "default": board(humans()), "bots": board(bots)}).encode()))


LOG = """|t:|1000
|player|p1|Some Bot|1|1700
|player|p2|Human One|2|1600
|rated|
|win|Human One
|raw|rating lines
|player|p1|
|player|p2|
"""


def test_registered_bots_skips_players_below_the_default_cutoff():
    default = board([row("a", 1800, 1, 1), row("b", 1700, 1, 1)])
    bots = board([row("a", 1800, 1, 1), row("bot", 1750, 1, 1), row("b", 1700, 1, 1), row("low", 1600, 1, 1)])
    assert fetch.registered_bots(default, bots) == ["bot"]


def test_parse_log_reads_pre_game_ratings_and_winner():
    players, winner, rated, start = summary.parse_log(LOG)
    assert players == {"p1": ("somebot", 1700), "p2": ("humanone", 1600)}
    assert (winner, rated, start) == ("humanone", "", 1000)


def test_snapshot_deltas_and_replays(tmp_path):
    write_snapshot(tmp_path, 900, row("somebot", 1700, 10, 5))
    write_snapshot(tmp_path, 4500, row("somebot", 1690, 11, 7, 1))
    snaps = summary.load_snapshots(tmp_path)
    stats = summary.bot_snapshot_stats(snaps)
    cell = stats["somebot"][summary.day(4500)]
    assert (cell["games"], cell["wins"], cell["ties"], cell["elo"]) == (4, 1, 1, 1690)

    replays = tmp_path / "replays"
    replays.mkdir()
    (replays / "r1.log.gz").write_bytes(gzip.compress(LOG.encode()))
    (replays / "index.jsonl").write_text(json.dumps({"id": "r1", "uploadtime": 1100}) + "\n")
    games, skipped = summary.load_games(tmp_path, set(stats))
    assert len(games) == 1 and not skipped
    g = games[0]
    assert (g["bot"], g["rating"], g["opp_rating"], g["score"]) == ("somebot", 1700, 1600, 0.0)
