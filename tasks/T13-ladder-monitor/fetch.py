"""Hourly ladder snapshot, plus a daily collection of registered bots' replays.

uv run --no-project tasks/T13-ladder-monitor/fetch.py <data dir>

Each run snapshots both gen9nationaldex boards. If the last replay collection was
>= 23 hours ago, it also collects the new saved replays (search entries and logs)
of every registered bot seen in the bots-included top 500 so far. Raw data holds
other players' names, so the data dir stays out of git.

Data dir layout:
  snapshots/<UTC time>.json.gz  {"time", "default", "bots"}: both boards as served
  replays/<id>.log.gz           replay logs as served
  replays/index.jsonl           search entries, one per line, with "bot" and "fetched"
  state.json                    {"bots_seen", "backfilled", "last_collection"}
  runs.jsonl                    one line per run: time, what it did, any error
"""

import gzip
import http.client
import json
import sys
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path

LADDER = "https://pokemonshowdown.com/ladder/gen9nationaldex.json"
SEARCH = "https://replay.pokemonshowdown.com/search.json"
REPLAY = "https://replay.pokemonshowdown.com"
FORMAT = "gen9nationaldex"
USER_AGENT = "ladder-monitor/0.1"
PAUSE_S = 1.1
COLLECT_EVERY_S = 23 * 3600
MAX_PAGES = 100


class Blocked(Exception):
    """A response that looks like a login wall or a block: a stop condition."""


def get(url, as_json=True):
    """Body of url, or None on 404. At most one request per PAUSE_S."""
    error = None
    for attempt in range(4):
        time.sleep(PAUSE_S + 20 * attempt)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (401, 403):
                raise Blocked(f"{e.code} on {url}")
            if e.code != 429 and e.code < 500:
                raise
            error = e
            continue
        except (OSError, http.client.HTTPException) as e:
            error = e
            continue
        if not as_json:
            return body
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            # A challenge or login page in place of JSON.
            raise Blocked(f"non-JSON body on {url}: {body[:120]!r}")
    raise RuntimeError(f"giving up on {url}: {error}")


def registered_bots(default, bots):
    """Accounts on the bots-included board that the default board hides.

    A player at the bottom of the bots-included board can be missing from the
    default one only if it is a bot, unless it rated below the default board's cutoff.
    """
    shown = {row["userid"] for row in default["toplist"]}
    cutoff = min(row["elo"] for row in default["toplist"])
    return [r["userid"] for r in bots["toplist"] if r["userid"] not in shown and r["elo"] >= cutoff]


def snapshot(data, now):
    default = get(LADDER)
    bots = get(LADDER + "?includebots")
    for board in (default, bots):
        if not board or len(board.get("toplist", [])) == 0:
            raise RuntimeError("empty board")
    out = data / "snapshots" / time.strftime("%Y%m%dT%H%M%SZ.json.gz", time.gmtime(now))
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_bytes(gzip.compress(json.dumps({"time": now, "default": default, "bots": bots}).encode()))
    tmp.rename(out)
    return registered_bots(default, bots)


def collect(data, state, now):
    """New search entries and logs for each bot seen. Returns the number of new logs.

    A bot's first walk pages back through all its saved replays. After that, a page
    with nothing new ends the walk, since the search lists newest first.
    """
    replays = data / "replays"
    replays.mkdir(parents=True, exist_ok=True)
    index = replays / "index.jsonl"
    known = set()
    if index.exists():
        known = {json.loads(line)["id"] for line in index.read_text().splitlines()}
    new = 0
    for bot in state["bots_seen"]:
        before = None
        for _ in range(MAX_PAGES):
            url = f"{SEARCH}?user={bot}&format={FORMAT}"
            if before:
                url += f"&before={before}"
            page = get(url) or []
            fresh = [e for e in page if e["id"] not in known]
            for entry in fresh:
                log = None
                if not (entry.get("password") or entry.get("private")):
                    log = get(f"{REPLAY}/{entry['id']}.log", as_json=False)
                if log is not None:
                    (replays / f"{entry['id']}.log.gz").write_bytes(gzip.compress(log))
                    new += 1
                with index.open("a") as f:
                    f.write(json.dumps({**entry, "bot": bot, "fetched": now, "log": log is not None}) + "\n")
                known.add(entry["id"])
            # A 51st entry means there is another page.
            if len(page) <= 50 or (not fresh and bot in state["backfilled"]):
                break
            # `before` is exclusive; +1 keeps uploads that share the last timestamp.
            before = page[-1]["uploadtime"] + 1
        else:
            raise RuntimeError(f"over {MAX_PAGES} search pages for {bot}")
        if bot not in state["backfilled"]:
            state["backfilled"].append(bot)
    return new


def main(data):
    data.mkdir(parents=True, exist_ok=True)
    now = int(time.time())
    state_path = data / "state.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {"bots_seen": [], "backfilled": [], "last_collection": 0}
    run = {"time": now}
    try:
        bots = snapshot(data, now)
        run["bots"] = bots
        state["bots_seen"] = sorted(set(state["bots_seen"]) | set(bots))
        if now - state["last_collection"] >= COLLECT_EVERY_S:
            run["new_replays"] = collect(data, state, now)
            state["last_collection"] = now
    except Exception as e:
        run["error"] = f"{type(e).__name__}: {e}"
        run["blocked"] = isinstance(e, Blocked)
        traceback.print_exc()
    state_path.write_text(json.dumps(state))
    run["seconds"] = int(time.time()) - now
    with (data / "runs.jsonl").open("a") as f:
        f.write(json.dumps(run) + "\n")
    print(json.dumps(run), flush=True)
    return 1 if "error" in run else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]).expanduser().resolve()))
