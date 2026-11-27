# /// script
# requires-python = ">=3.14"
# ///
"""Hourly ladder snapshot, plus a daily collection of registered bots' replays.

uv run --no-project tasks/T13-ladder-monitor/fetch.py <data dir> [--collect]

Each run snapshots both gen9nationaldex boards and the public profile of every
registered bot seen so far, so a bot that drops out of the top 500 is still tracked.
If the last replay collection was >= 23 hours ago, or with --collect, it also
collects the bots' new saved replays (search entries and logs). An account counts
as a registered bot once two snapshots in a row show it on the bots-included board
but not the default one. Raw data holds other players' names, so the data dir
stays out of git. Don't run it by hand while the job runs: two runs at once
break the request rate.

Data dir layout:
  snapshots/<UTC time>.json.gz  {"time", "default", "bots", "profiles"}: both boards as
                                served, and each bot's gen9nationaldex entry from its profile
  replays/<id>.log.gz           replay logs as served
  replays/index.jsonl           search entries, one per line, with "bot" and "fetched"
  state.json                    {"bots_seen", "flagged", "backfilled", "last_collection"}
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
PROFILE = "https://pokemonshowdown.com/users"
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
    if isinstance(error, urllib.error.HTTPError) and error.code == 429:
        raise Blocked(f"429 after retries on {url}")
    raise RuntimeError(f"giving up on {url}: {error}")


def flagged(default, bots):
    """Accounts on the bots-included board that the default board hides.

    A human can show up here once: the boards are fetched seconds apart, and one
    who climbs past the default board's cutoff in between is on the second only.
    """
    shown = {row["userid"] for row in default["toplist"]}
    return [r["userid"] for r in bots["toplist"] if r["userid"] not in shown]


def write_atomic(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.rename(path)


def snapshot(data, bots_seen, now):
    default = get(LADDER)
    bots = get(LADDER + "?includebots")
    for board in (default, bots):
        if not board or len(board.get("toplist", [])) == 0:
            raise RuntimeError("empty board")
    profiles = {}
    for bot in bots_seen:
        profile = get(f"{PROFILE}/{bot}.json")
        profiles[bot] = ((profile or {}).get("ratings") or {}).get(FORMAT)
    out = data / "snapshots" / time.strftime("%Y%m%dT%H%M%SZ.json.gz", time.gmtime(now))
    out.parent.mkdir(parents=True, exist_ok=True)
    body = {"time": now, "default": default, "bots": bots, "profiles": profiles}
    write_atomic(out, gzip.compress(json.dumps(body).encode()))
    return flagged(default, bots)


def collect(data, state, now):
    """New search entries and logs for each bot seen. Returns the number of new logs.

    A bot's first walk pages back through all its saved replays. After that, the walk
    ends at the first page holding a replay already collected.
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
                    try:
                        log = get(f"{REPLAY}/{entry['id']}.log", as_json=False)
                    except Blocked:
                        raise
                    except Exception as e:
                        # Left out of the index, so the next collection retries it.
                        print(f"skipping {entry['id']}: {e}", flush=True)
                        continue
                if log is not None:
                    (replays / f"{entry['id']}.log.gz").write_bytes(gzip.compress(log))
                    new += 1
                with index.open("a") as f:
                    f.write(json.dumps({**entry, "bot": bot, "fetched": now, "log": log is not None}) + "\n")
                known.add(entry["id"])
            # A 51st entry means there is another page. Once a bot is backfilled, a known
            # entry means the older ones are known too, since the search lists newest first.
            if len(page) <= 50 or (len(fresh) < len(page) and bot in state["backfilled"]):
                break
            # `before` is exclusive; +1 keeps uploads that share the last timestamp.
            before = page[-1]["uploadtime"] + 1
        else:
            raise RuntimeError(f"over {MAX_PAGES} search pages for {bot}")
        if bot not in state["backfilled"]:
            state["backfilled"].append(bot)
    return new


def main(data, force_collect=False):
    data.mkdir(parents=True, exist_ok=True)
    now = int(time.time())
    state_path = data / "state.json"
    state = {"bots_seen": [], "flagged": [], "backfilled": [], "last_collection": 0}
    if state_path.exists():
        state |= json.loads(state_path.read_text())
    run = {"time": now}
    try:
        flags = snapshot(data, state["bots_seen"], now)
        run["flagged"] = flags
        state["bots_seen"] = sorted(set(state["bots_seen"]) | (set(flags) & set(state["flagged"])))
        state["flagged"] = flags
        if force_collect or now - state["last_collection"] >= COLLECT_EVERY_S:
            run["new_replays"] = collect(data, state, now)
            state["last_collection"] = now
    except Exception as e:
        run["error"] = f"{type(e).__name__}: {e}"
        run["blocked"] = isinstance(e, Blocked)
        traceback.print_exc()
    write_atomic(state_path, json.dumps(state).encode())
    run["seconds"] = int(time.time()) - now
    with (data / "runs.jsonl").open("a") as f:
        f.write(json.dumps(run) + "\n")
    print(json.dumps(run), flush=True)
    return 1 if "error" in run else 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]).expanduser().resolve(), "--collect" in sys.argv[2:]))
