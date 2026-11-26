"""Recall of revealed opposing attributes: what each tracker knows (correctly) that the other doesn't.

compare.py checks only that revealed items, abilities and moves are true ones, which a tracker that records
nothing passes. This counts, at decisions where no opposing Illusion holds, each correct item, ability and move
one tracker holds for a seen opposing mon and the other lacks. Counts are unique game:player:mon:attribute
cases, by kind. What both trackers miss isn't measured.

Usage: uv run python recall.py <games.jsonl> <truth.jsonl> <views-pkmn.jsonl> <views-pokeenv.jsonl>
"""

import json
import sys
from collections import Counter, defaultdict

import orjson
from poke_env.data import GenData

from compare import norm_view, revealed_names, to_id

DEX = GenData.from_gen(9).pokedex
MEGA_STONES = {to_id(d["requiredItem"]) for d in DEX.values()
               if d.get("requiredItem") and str(d.get("forme", "")).startswith("Mega")}


def kind(attr, value, m):
    if attr == "item":
        return "Mega Stone" if value in MEGA_STONES else "Z-Crystal" if value.endswith("iumz") else "other item"
    if attr == "ability":
        abilities = DEX.get(to_id(m["species"]), {}).get("abilities", {})
        return "single-ability species" if len(abilities) == 1 else "other ability"
    return "move"


def known(v):
    """The attributes a tracker's view holds for a mon: (attribute, value) pairs."""
    out = set()
    if v["item"] is not None:
        out.add(("item", v["item"]))
    if v["ability"] is not None:
        out.add(("ability", v["ability"]))
    out.update(("move", x) for x in v["moves"])
    return out


def truth_of(m):
    return {("item", m["item"]), ("ability", m["ability"])} | {("move", x) for x in m["moves"]}


def main():
    games, truth, pkmn, pokeenv = sys.argv[1:5]
    cases = {"pkmn only": defaultdict(set), "pokeenv only": defaultdict(set)}
    examples = defaultdict(list)
    with open(games, "rb") as gf, open(truth, "rb") as tf, open(pkmn, "rb") as af, open(pokeenv, "rb") as bf:
        for gl, tl, al, bl in zip(gf, tf, af, bf):
            g, t, a, b = (orjson.loads(x) for x in (gl, tl, al, bl))
            for side in ("p1", "p2"):
                mi = 0 if side == "p1" else 1
                opp = "p2" if side == "p1" else "p1"
                td = [d for d in t["decisions"] if d["side"] == side]
                av = [x["view"] for x in a["views"] if x["side"] == side]
                bv = [x["view"] for x in b["views"] if x["side"] == side]
                for i, (d, va, vb) in enumerate(zip(td, av, bv)):
                    opp_t = d["state"]["sides"][1 - mi]
                    if any(m["illusion"] and m["active"] for m in opp_t["mons"]):
                        continue
                    seen = revealed_names(g[side], d["chunk"], opp)
                    va, vb = norm_view(va, "pkmn")["mons"]["opp"], norm_view(vb, "pokeenv")["mons"]["opp"]
                    for m in opp_t["mons"]:
                        if m["name"] not in seen or m["name"] not in va or m["name"] not in vb:
                            continue
                        true = truth_of(m)
                        ka, kb = known(va[m["name"]]) & true, known(vb[m["name"]]) & true
                        for label, only in (("pkmn only", ka - kb), ("pokeenv only", kb - ka)):
                            for attr, value in only:
                                k = (attr, kind(attr, value, m))
                                key = (g["game"], side, m["name"], attr, value)
                                if key not in cases[label][k] and len(examples[(label, k)]) < 5:
                                    examples[(label, k)].append(f"{g['game']}:{side}:{i}:{m['name']}:{value}")
                                cases[label][k].add(key)
    print(json.dumps({
        label: {f"{a}: {k}": {"cases": len(v), "examples": examples[(label, (a, k))]}
                for (a, k), v in sorted(by.items(), key=lambda kv: -len(kv[1]))}
        for label, by in cases.items()
    }, indent=1))


if __name__ == "__main__":
    main()
