"""poke-env's tracker (poke_env.battle.Battle). Feeds each player's chunks of the recorded games to its own
Battle, dispatching lines as poke-env's Player._handle_battle_message does, and at each decision (a request
the player must answer) writes the tracked state in the shared view format (view.md). On public replays
(spectator view, no requests) it only counts errors, playing as p1.

Usage: uv run python pokeenv.py games <games.jsonl> <views.jsonl>
       uv run python pokeenv.py replays <replays.jsonl.gz>...
       uv run python pokeenv.py time <games.jsonl> [runs=3]   (tracking only, no views: ms per decision)
"""

import gzip
import json
import logging
import sys
import time
from collections import Counter

import orjson
from poke_env.battle import Battle
from poke_env.data import GenData
from poke_env.player.player import Player

UNKNOWN_ITEM = GenData.UNKNOWN_ITEM


class Counts(logging.Handler):
    """Counts the tracker's own warnings (it logs inconsistencies instead of raising)."""

    def __init__(self):
        super().__init__(logging.WARNING)
        self.warnings = Counter()

    def emit(self, record):
        self.warnings[record.msg if isinstance(record.msg, str) else repr(record.msg)] += 1


class Errors:
    def __init__(self):
        self.thrown = Counter()
        self.ignored = Counter()
        self.games_with_throw = set()
        self.handler = Counts()
        self.logger = logging.getLogger("tracker")
        # poke-env also warns through its own module logger (unknown effects, for example).
        for logger in (self.logger, logging.getLogger("poke-env")):
            logger.addHandler(self.handler)
            logger.propagate = False

    def summary(self, games):
        return {
            "games": games,
            "gamesWithThrow": len(self.games_with_throw),
            "thrown": dict(self.thrown.most_common()),
            "ignored": dict(self.ignored.most_common()),
            "warnings": dict(self.handler.warnings.most_common()),
        }


IGNORED = Battle.MESSAGES_TO_IGNORE | Player.MESSAGES_TO_IGNORE


def feed(battle, line, errs, where):
    """One protocol line, dispatched as Player._handle_battle_message does. False if it threw."""
    msg = line.split("|")
    if len(msg) < 2:
        return True
    try:
        if msg[1] == "request":
            if msg[2]:
                battle.parse_request(orjson.loads(msg[2]))
        elif msg[1] == "win":
            battle.won_by(msg[2])
        elif msg[1] == "tie":
            battle.tied()
        elif msg[1] in ("error", "bigerror"):
            pass
        else:
            if msg[1] in IGNORED and msg[1]:
                errs.ignored[msg[1]] += 1
            battle.parse_message(msg)
        return True
    except Exception as e:  # the tracker's own errors are what stage 1 counts
        errs.thrown[f"{msg[1]}: {type(e).__name__}: {str(e).splitlines()[0][:80] if str(e) else ''}"] += 1
        errs.games_with_throw.add(where)
        return False


STATUS_TURNS = {"slp", "tox"}


def view_mon(mon, own):
    status = mon.status.name.lower() if mon.status else ""
    if own:
        item = mon.item or ""
    else:
        item = None if mon.item == UNKNOWN_ITEM else (mon.item or "")
    return {
        "species": mon.species,
        "hp": mon.current_hp,
        "maxhp": mon.max_hp,
        "status": "" if status == "fnt" else status,
        "fainted": mon.fainted,
        "statusTurns": mon.status_counter if status in STATUS_TURNS else 0,
        "item": item,
        "ability": mon.ability,
        "moves": list(mon.moves),
        "active": bool(mon.active),
        "boosts": {k: v for k, v in mon.boosts.items() if v},
        "volatiles": sorted(e.name.lower() for e in mon.effects),
    }


def view(battle):
    def mons(team, own):
        return {key[4:]: view_mon(mon, own) for key, mon in team.items()}

    def conds(c):
        return {k.name.lower(): v for k, v in c.items()}

    return {
        "turn": battle.turn,
        "flags": {
            "own": {"megaUsed": battle.used_mega_evolve, "zUsed": battle.used_z_move},
            "opp": {"megaUsed": battle.opponent_used_mega_evolve, "zUsed": battle.opponent_used_z_move},
        },
        "field": {
            "weather": next((w.name.lower() for w in battle.weather), ""),
            "terrain": next((f.name.lower() for f in battle.fields if f.is_terrain), ""),
            "pseudo": sorted(f.name.lower() for f in battle.fields if not f.is_terrain),
        },
        "own": mons(battle.team, True),
        "opp": mons(battle.opponent_team, False),
        # Stackable conditions hold layers; the others hold the turn they started, so 1 marks them.
        "ownConds": conds(battle.side_conditions),
        "oppConds": conds(battle.opponent_side_conditions),
    }


def lines(path):
    with (gzip.open(path, "rt") if path.endswith(".gz") else open(path)) as f:
        yield from f


def new_battle(tag, username, errs):
    return Battle(tag, username, errs.logger, gen=9)


def main():
    mode, *rest = sys.argv[1:]
    errs = Errors()
    games = 0
    if mode == "games":
        src, dst = rest
        decisions = 0
        with open(dst, "w") as out:
            for line in lines(src):
                g = orjson.loads(line)
                games += 1
                views = []
                for n, side in enumerate(("p1", "p2")):
                    battle = new_battle(f"battle-gen9nationaldex-{g['game']}", f"Bot {n + 1}", errs)
                    ok = True
                    for chunk in g[side]:
                        if chunk.startswith("|request|"):
                            wait = orjson.loads(chunk[9:]).get("wait")
                            if ok:
                                ok = feed(battle, chunk, errs, f"{g['game']}{side}")
                            if not wait:
                                views.append({"side": side, "view": view(battle) if ok else None})
                                decisions += 1
                        elif not chunk.startswith("|error|"):
                            for l in chunk.split("\n"):
                                if ok:
                                    ok = feed(battle, l, errs, f"{g['game']}{side}")
                out.write(json.dumps({"game": g["game"], "views": views}) + "\n")
        print(json.dumps({"tracker": "poke-env", "decisions": decisions, **errs.summary(games * 2)}, indent=1))
    elif mode == "time":
        src, runs = rest[0], int(rest[1]) if len(rest) > 1 else 3
        games, decisions = [], 0
        for line in lines(src):
            g = orjson.loads(line)
            for side in ("p1", "p2"):
                games.append((g["game"], side, g[side]))
                decisions += sum(c.startswith("|request|") and '"wait":true' not in c for c in g[side])
        ms = []
        for _ in range(runs):
            t0 = time.perf_counter()
            for game, side, chunks in games:
                battle = new_battle(f"battle-gen9nationaldex-{game}", "Bot 1" if side == "p1" else "Bot 2", errs)
                for chunk in chunks:
                    if not chunk.startswith("|error|"):
                        for l in chunk.split("\n"):
                            feed(battle, l, errs, game)
            ms.append((time.perf_counter() - t0) * 1000 / decisions)
        print(json.dumps({"tracker": "poke-env", "decisions": decisions, "msPerDecision": [round(x, 4) for x in ms],
                          "thrown": len(errs.games_with_throw)}))
    elif mode == "replays":
        for path in rest:
            for line in lines(path):
                r = orjson.loads(line)
                games += 1
                battle = new_battle(f"battle-{r['id']}", r["players"][0], errs)
                for l in r["log"].split("\n"):
                    if not feed(battle, l, errs, r["id"]):
                        break
        print(json.dumps({"tracker": "poke-env", **errs.summary(games)}, indent=1))


if __name__ == "__main__":
    main()
