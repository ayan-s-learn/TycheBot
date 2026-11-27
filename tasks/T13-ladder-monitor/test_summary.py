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


def write_snapshot(data, t, bot_row=None, profiles=None):
    path = data / "snapshots" / f"{t}.json.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    bots = sorted(humans() + ([bot_row] if bot_row else []), key=lambda r: -r["elo"])
    body = {"time": t, "default": board(humans()), "bots": board(bots), "profiles": profiles or {}}
    path.write_bytes(gzip.compress(json.dumps(body).encode()))


LOG = """|t:|1000
|player|p1|Some Bot|1|1700
|player|p2|Human One|2|1600
|rated|
|win|Human One
|raw|rating lines
|player|p1|
|player|p2|
"""


def test_flagged_lists_accounts_the_default_board_hides():
    default = board([row("a", 1800, 1, 1), row("b", 1700, 1, 1)])
    bots = board([row("a", 1800, 1, 1), row("bot", 1750, 1, 1), row("b", 1700, 1, 1)])
    assert fetch.flagged(default, bots) == ["bot"]


def test_parse_log_reads_pre_game_ratings_and_winner():
    players, winner, rated, start = summary.parse_log(LOG)
    assert players == {"p1": ("somebot", 1700), "p2": ("humanone", 1600)}
    assert (winner, rated, start) == ("humanone", "", 1000)


def test_snapshot_deltas_and_replays(tmp_path):
    write_snapshot(tmp_path, 900, row("somebot", 1700, 10, 5))
    write_snapshot(tmp_path, 4500, row("somebot", 1690, 11, 7, 1))
    snaps, bots = summary.load_snapshots(tmp_path)
    stats, tracked = summary.bot_snapshot_stats(snaps)
    cell = stats["somebot"][summary.day(4500)]
    assert (cell["games"], cell["wins"], cell["ties"], cell["elo"]) == (4, 1, 1, 1690)
    assert tracked["somebot"] == 3600

    replays = tmp_path / "replays"
    replays.mkdir()
    (replays / "r1.log.gz").write_bytes(gzip.compress(LOG.encode()))
    (replays / "index.jsonl").write_text(json.dumps({"id": "r1", "uploadtime": 1100}) + "\n")
    games, skipped = summary.load_games(tmp_path, bots)
    assert len(games) == 1 and not skipped
    g = games[0]
    assert (g["bot"], g["rating"], g["opp_rating"], g["score"]) == ("somebot", 1700, 1600, 0.0)


def test_a_single_flag_is_not_a_bot_and_profiles_cover_a_bot_off_the_board(tmp_path):
    write_snapshot(tmp_path, 0, row("onceonly", 1500, 1, 1))
    write_snapshot(tmp_path, 3600, row("somebot", 1700, 10, 5))
    write_snapshot(tmp_path, 7200, row("somebot", 1690, 11, 7, 1))
    # Off the board: the profile has no ties, so the last board count carries over.
    write_snapshot(tmp_path, 10800, profiles={"somebot": {"elo": 1600, "w": 12, "l": 9}})
    snaps, bots = summary.load_snapshots(tmp_path)
    assert bots == {"somebot"}
    stats, tracked = summary.bot_snapshot_stats(snaps)
    days = stats["somebot"].values()
    assert sum(c["games"] for c in days) == 7 and sum(c["ties"] for c in days) == 1
    assert tracked["somebot"] == 7200


def test_collect_pages_back_once_then_stops_at_known_replays(tmp_path, monkeypatch):
    entries = [{"id": f"r{i}", "uploadtime": 1000 - i, "private": 0, "password": None} for i in range(60)]
    requests = []

    def fake_get(url, as_json=True):
        requests.append(url)
        if url.endswith(".log"):
            return b"|t:|1\n"
        before = int(url.split("before=")[1]) if "before=" in url else 10**9
        return [e for e in entries if e["uploadtime"] < before][:51]

    monkeypatch.setattr(fetch, "get", fake_get)
    state = {"bots_seen": ["somebot"], "backfilled": []}
    assert fetch.collect(tmp_path, state, 0) == 60
    assert state["backfilled"] == ["somebot"]
    lines = (tmp_path / "replays" / "index.jsonl").read_text().splitlines()
    assert len({json.loads(line)["id"] for line in lines}) == 60

    requests.clear()
    entries.insert(0, {"id": "new", "uploadtime": 2000, "private": 0, "password": None})
    assert fetch.collect(tmp_path, state, 0) == 1
    # One search page and one log: the page is full, but its rest is known.
    assert len(requests) == 2
