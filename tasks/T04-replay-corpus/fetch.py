"""Fetch public gen9nationaldex replays into data/replays/v0/.

uv run tasks/T04-replay-corpus/fetch.py <cache dir outside the repo>

Walks the replay search from the newest upload back. The first MAIN_COUNT usable
replays are the corpus. Older replays rated >= HIGH_RATING fill the high-rated
sample. Replays are cached as served (chat included) so a stopped run can be rerun.
"""

import gzip
import http.client
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from replay import FORMAT, HIGH_RATING, result_lines, strip_chat

BASE = "https://replay.pokemonshowdown.com"
USER_AGENT = "replay-corpus-fetch/0.1"
PAUSE_S = 1.0
MAIN_COUNT = 1000
HIGH_COUNT = 100
MAX_SEARCH_PAGES = 1000
MAX_BYTES = 20_000_000

TASK = Path(__file__).resolve().parent
OUT = TASK.parents[1] / "data/replays/v0"


def get(url):
    """Body of url, or None on 404. One request at a time, with a pause before each."""
    for attempt in range(5):
        time.sleep(PAUSE_S + 15 * attempt)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
            json.loads(body)
            return body
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code != 429 and e.code < 500:
                raise
            error = e
        except (OSError, http.client.HTTPException, json.JSONDecodeError) as e:
            error = e
        print(f"retrying {url}: {error}", flush=True)
    raise RuntimeError(f"giving up on {url}")


def search(log):
    """Search entries, newest upload first."""
    seen, before = set(), None
    for _ in range(MAX_SEARCH_PAGES):
        url = f"{BASE}/search.json?format={FORMAT}"
        if before:
            url += f"&before={before}"
        page = json.loads(get(url))
        log["search_pages"] += 1
        new = [entry for entry in page if entry["id"] not in seen]
        for entry in new:
            seen.add(entry["id"])
            yield entry
        # A 51st result means there is another page.
        if len(page) <= 50 or not new:
            return
        # `before` is exclusive; +1 keeps uploads that share the last timestamp.
        before = page[-1]["uploadtime"] + 1


def fetch_replay(replay_id, cache):
    path = cache / f"{replay_id}.json"
    if not path.exists():
        body = get(f"{BASE}/{replay_id}.json")
        if body is None:
            return None
        path.write_bytes(body)
    return json.loads(path.read_bytes())


def reject_reason(replay):
    if replay is None:
        return "404"
    if replay["formatid"] != FORMAT:
        return f"format {replay['formatid']}"
    results = len(result_lines(replay["log"].split("\n")))
    if results != 1:
        return f"{results} result lines"
    return None


def write(path, records):
    lines = "".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in records)
    data = gzip.compress(lines.encode(), mtime=0)
    path.write_bytes(data)
    print(f"{path.name}: {len(records)} replays, {len(data):,} bytes")
    return len(data)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def main():
    cache = Path(sys.argv[1])
    cache.mkdir(parents=True, exist_ok=True)
    log = {"started": now(), "search_pages": 0, "rejected": []}
    # "older" counts the search entries past the corpus, where the high-rated sample comes from.
    older = {"entries": 0, "rated": 0, "high": 0, "oldest_uploadtime": None}
    corpus, high = [], []

    for entry in search(log):
        if len(corpus) < MAIN_COUNT:
            target = corpus
        else:
            older["entries"] += 1
            older["oldest_uploadtime"] = entry["uploadtime"]
            older["rated"] += entry["rating"] is not None
            if (entry["rating"] or 0) < HIGH_RATING:
                continue
            older["high"] += 1
            target = high

        replay = fetch_replay(entry["id"], cache)
        reason = reject_reason(replay)
        if reason:
            log["rejected"].append({"id": entry["id"], "reason": reason})
            continue
        target.append({
            "id": replay["id"],
            "uploadtime": replay["uploadtime"],
            "rating": replay["rating"],
            "formatid": replay["formatid"],
            "players": replay["players"],
            "log": strip_chat(replay["log"]),
        })
        if len(corpus) % 100 == 0 or target is high:
            print(f"corpus {len(corpus)}, high-rated {len(high)}, search pages {log['search_pages']}", flush=True)
        if len(high) == HIGH_COUNT:
            break

    if len(corpus) < MAIN_COUNT:
        sys.exit(f"stop: only {len(corpus)} usable replays reachable")

    OUT.mkdir(parents=True, exist_ok=True)
    size = write(OUT / "replays.jsonl.gz", corpus) + write(OUT / "high-rated.jsonl.gz", high)
    log.update(finished=now(), older=older)
    (TASK / "fetch-log.json").write_text(json.dumps(log, indent=1) + "\n")
    if size > MAX_BYTES:
        sys.exit(f"stop: {size:,} compressed bytes is over {MAX_BYTES:,}; do not commit")


if __name__ == "__main__":
    main()
