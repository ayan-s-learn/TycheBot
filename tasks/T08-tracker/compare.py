"""Stage 3: diffs each tracker's view against the sim's state at every decision.

Reads the recorded games (for what each player has been shown), the truth (truth.ts) and one tracker's views
(pkmn.ts or pokeenv.py), all in game order. Writes mismatch counts by field and class to stdout as JSON, and
up to N examples per class and Illusion tag to the examples file.

Usage: uv run python compare.py <games.jsonl> <truth.jsonl> <views.jsonl> <pkmn|pokeenv> <examples.jsonl> [N=5]
"""

import json
import re
import sys
from collections import Counter, defaultdict

import orjson


def to_id(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


# Truth volatiles the protocol never announces. The player infers some of them (choicelock and lockedmove
# from its own request, stall from its own Protect), but no protocol line starts or ends them.
NOT_SHOWN = {"choicelock", "stall", "lockedmove", "chillyreception", "mirrorcoat", "counter", "pursuit"}
# Partial-trapping moves, which trackers name and the sim calls partiallytrapped.
TRAPPING = {"bind", "wrap", "firespin", "whirlpool", "sandtomb", "clamp", "infestation", "magmastorm",
            "snaptrap", "thundercage"}
# Markers the trackers keep as volatiles that are not sim volatiles: ability or item state, which the
# view compares elsewhere (item, ability) or doesn't use.
MARKERS = re.compile(r"^(fallen\d|itemremoved|airballoon|(quarkdrive|protosynthesis)(atk|def|spa|spd|spe))$")
WEATHER = {"rain": "raindance", "sun": "sunnyday", "sand": "sandstorm", "snow": "snowscape",
           "harshsunshine": "desolateland", "heavyrain": "primordialsea", "strongwinds": "deltastream"}
FUTURE = {"futuresight": "futuremove", "doomdesire": "futuremove"}
# Rules the sim runs as pseudo-weather.
RULES = {"sleepclausemod"}


def norm_move(m):
    """Request move ids carry Hidden Power's type and Return's and Frustration's power."""
    m = to_id(m)
    return re.sub(r"^(hiddenpower)[a-z]*\d*$|^(return|frustration)\d+$", lambda x: x.group(1) or x.group(2), m)


def norm_volatiles(vs):
    out = set()
    for v in vs:
        v = to_id(v)
        if MARKERS.match(v):
            continue
        out.add("partiallytrapped" if v in TRAPPING else v)
    return out


def norm_view(v, tracker):
    """Tracker view -> canonical ids (Showdown's), keeping the tracker's own naming nowhere else."""
    f = v["field"]
    weather = to_id(f["weather"])
    terrain = to_id(f["terrain"])
    if tracker == "pkmn" and terrain:
        terrain += "terrain"
    field = {"weather": WEATHER.get(weather, weather), "terrain": terrain,
             "pseudo": sorted(to_id(p) for p in f["pseudo"])}
    mons = {}
    for side in ("own", "opp"):
        mons[side] = {}
        for name, m in v[side].items():
            m = dict(m)
            m["species"] = to_id(m["species"])
            m["volatiles"] = norm_volatiles(m["volatiles"])
            m["moves"] = [norm_move(x) for x in m["moves"]]
            if m["ability"] is not None:
                m["ability"] = to_id(m["ability"])
            if m["item"] is not None:
                m["item"] = to_id(m["item"])
            mons[side][name] = m
    conds = {}
    for side in ("own", "opp"):
        c = {}
        for k, layers in v[side + "Conds"].items():
            k = FUTURE.get(to_id(k), to_id(k))
            c[k] = layers if k in ("spikes", "toxicspikes") else 1
        conds[side] = c
    # poke-env keeps a pending Future Sight as an effect on its user, until it hits.
    if tracker == "pokeenv":
        for s, foe in (("own", "opp"), ("opp", "own")):
            for m in mons[s].values():
                if "futuresight" in m["volatiles"]:
                    m["volatiles"].discard("futuresight")
                    conds[foe]["futuremove"] = 1
    # @pkmn/client keeps a pending Future Sight on its user's side; the sim on its target's.
    if tracker == "pkmn":
        fm = [conds[s].pop("futuremove", None) for s in ("own", "opp")]
        for s, layers in zip(("opp", "own"), fm):
            if layers:
                conds[s]["futuremove"] = layers
    return {"field": field, "mons": mons, "conds": conds, "turn": v["turn"], "flags": v["flags"]}


def opp_hp(m):
    if m["hp"] == 0:
        return 0
    pct = -(-100 * m["hp"] // m["maxhp"])
    return 99 if pct == 100 and m["hp"] < m["maxhp"] else pct


def revealed_names(chunks, upto, opp):
    """Names of the opposing mons the player has seen switch in, by its chunks so far."""
    names = set()
    pat = re.compile(r"^\|(?:switch|drag|replace)\|" + opp + r"a: ([^|]+)\|", re.M)
    for c in chunks[:upto]:
        names.update(pat.findall(c))
    return names


class Tally:
    def __init__(self, n_examples):
        self.n = n_examples
        self.by_field = Counter()
        self.by_class = Counter()
        self.class_tags = defaultdict(Counter)
        self.illusion = {"now": Counter(), "after": Counter()}  # mismatches by Illusion tag, by field
        self.examples = defaultdict(list)
        self.decisions = 0
        self.bad_decisions = 0
        # Stage 2: mons compared with each feature, and mismatches on them by field.
        self.feature_mons = Counter()
        self.feature_bad = defaultdict(Counter)

    def add(self, field, cls, where, want, got, tag):
        self.by_field[field] += 1
        self.by_class[(field, cls)] += 1
        self.class_tags[(field, cls)][tag] += 1
        if tag != "none":
            self.illusion[tag][field] += 1
        ex = self.examples[(field, cls)]
        if sum(e["illusion"] == tag for e in ex) < self.n:
            ex.append({"where": where, "illusion": tag, "want": want, "got": got})


HIDDEN_FORMES = {"Urshifu", "Greninja", "Gourgeist", "Pumpkaboo", "Xerneas", "Silvally", "Dudunsparce",
                 "Zacian", "Zamazenta"}


def features(m):
    """The stage-2 features a true mon has."""
    f = set()
    if "-Mega" in m["species"]:
        f.add("mega")
    if m["item"].endswith("iumz") or m["item"] in ("ultranecroziumz",):
        f.add("zcrystal")
    if m["ability"] == "illusion":
        f.add("illusion user")
    if m["species"].split("-")[0] in HIDDEN_FORMES:
        f.add("hidden forme (" + m["species"].split("-")[0] + ")")
    for x in m["past"]:
        f.add("past " + x)
    return f


def jsonable(x):
    return sorted(x) if isinstance(x, set) else x


def compare_decision(tally, truth, view, me, chunks, upto, where, illusion_seen):
    """Adds this decision's mismatches to the tally. Returns how many it found.

    illusion_seen: per side index, whether an Illusion has held on that side at an earlier decision of this
    player's game. A mismatch is tagged "now" if an Illusion holds at this decision, "after" if one held
    earlier in the game, else "none".
    """
    mi = 0 if me == "p1" else 1
    own_t, opp_t = truth["sides"][mi], truth["sides"][1 - mi]
    now = [any(m["illusion"] and m["active"] for m in s["mons"]) for s in truth["sides"]]
    tag = "now" if any(now) else "after" if any(illusion_seen) else "none"
    for i in (0, 1):
        illusion_seen[i] = illusion_seen[i] or now[i]
    found = 0
    preview = truth["turn"] == 0

    mon_features = set()

    def bad(field, cls, want, got):
        nonlocal found
        found += 1
        tally.add(field, cls, where, jsonable(want), jsonable(got), tag)
        for f in mon_features:
            tally.feature_bad[f][field] += 1

    def compared(m):
        nonlocal mon_features
        mon_features = features(m)
        for f in mon_features:
            tally.feature_mons[f] += 1

    # Field and side conditions.
    tf, vf = truth["field"], view["field"]
    if tf["weather"] != vf["weather"]:
        bad("field.weather", f"{tf['weather'] or '-'}->{vf['weather'] or '-'}", tf["weather"], vf["weather"])
    if tf["terrain"] != vf["terrain"]:
        bad("field.terrain", f"{tf['terrain'] or '-'}->{vf['terrain'] or '-'}", tf["terrain"], vf["terrain"])
    tp = sorted(set(tf["pseudo"]) - RULES)
    if tp != vf["pseudo"]:
        bad("field.pseudo", f"{tp}->{vf['pseudo']}", tp, vf["pseudo"])
    for side, ts in (("own", own_t), ("opp", opp_t)):
        want = dict(ts["conds"])
        for c in ts["slotConds"]:
            want[c] = 1
        got = view["conds"][side]
        for k in set(want) | set(got):
            if want.get(k) != got.get(k):
                cls = f"missing:{k}" if k not in got else f"extra:{k}" if k not in want else f"layers:{k}"
                bad(f"conds.{side}", cls, want.get(k), got.get(k))

    # Mega and Z: whether each side has used its one.
    for side, ts in (("own", own_t), ("opp", opp_t)):
        for k in ("megaUsed", "zUsed"):
            if ts[k] != view["flags"][side][k]:
                bad(f"flags.{side}", f"{k} {ts[k]}->{view['flags'][side][k]}", ts[k], view["flags"][side][k])

    # Own side: everything.
    own_v = view["mons"]["own"]
    for m in own_t["mons"]:
        compared(m)
        v = own_v.get(m["name"])
        if v is None:
            bad("own.missing", "missing", m["name"], None)
            continue
        if m["fainted"] != v["fainted"]:
            bad("own.fainted", f"{m['fainted']}->{v['fainted']}", m["fainted"], v["fainted"])
        if m["fainted"]:
            continue
        checks = {
            "species": (to_id(m["species"]), v["species"]),
            "hp": (m["hp"], v["hp"]),
            "maxhp": (m["maxhp"], v["maxhp"]),
            "status": (m["status"], v["status"]),
            "item": (m["item"], v["item"]),
            "ability": (m["ability"], v["ability"]),
            "moves": (set(m["moves"]), set(v["moves"])),
        }
        if not preview:
            checks["active"] = (m["active"], v["active"])
        # The sim keeps a benched mon's toxic stage until it switches in again, then resets it.
        if m["status"] == "slp" or (m["status"] == "tox" and m["active"]):
            checks["statusTurns"] = (m["statusTurns"], v["statusTurns"])
        if len(set(v["moves"])) < len(v["moves"]):
            bad("own.moveSlots", "duplicate slots", None, v["moves"])
        if m["active"]:
            checks["boosts"] = (m["boosts"], v["boosts"])
            checks["volatiles"] = (set(m["volatiles"]) - NOT_SHOWN, v["volatiles"])
        for k, (want, got) in checks.items():
            if want == got:
                continue
            bad(f"own.{k}", classify(k, want, got, m), want, got)
    mon_features = set()
    for name in set(own_v) - {m["name"] for m in own_t["mons"]}:
        bad("own.extra", "extra", None, name)

    # Opposing side: what the player is shown.
    opp_v = view["mons"]["opp"]
    seen = revealed_names(chunks, upto, opp_side(me))
    true_names = {m["name"] for m in opp_t["mons"]}
    for m in opp_t["mons"]:
        v = opp_v.get(m["name"])
        if m["name"] not in seen:
            continue
        compared(m)
        if v is None:
            bad("opp.missing", "missing", m["name"], None)
            continue
        if m["fainted"] != v["fainted"]:
            bad("opp.fainted", f"{m['fainted']}->{v['fainted']}", m["fainted"], v["fainted"])
            continue
        if m["fainted"]:
            continue
        checks = {
            "hp": (opp_hp(m), v["hp"]),
            "status": (m["status"], v["status"]),
            "active": (m["active"], v["active"]),
        }
        if m["active"]:
            checks["species"] = (to_id(m["species"]), v["species"])
            checks["statusTurns"] = (m["statusTurns"], v["statusTurns"])
            checks["boosts"] = (m["boosts"], v["boosts"])
            checks["volatiles"] = (set(m["volatiles"]) - NOT_SHOWN, v["volatiles"])
        for k, (want, got) in checks.items():
            if want == got:
                continue
            bad(f"opp.{k}", classify(k, want, got, m), want, got)
        # Revealed attributes must be true ones.
        if v["item"] is not None and v["item"] != m["item"]:
            bad("opp.item", f"{v['item'] or '-'} for {m['item'] or '-'}", m["item"], v["item"])
        if v["ability"] is not None and v["ability"] != m["ability"]:
            bad("opp.ability", f"{v['ability']} for {m['ability']}", m["ability"], v["ability"])
        wrong = set(v["moves"]) - set(m["moves"])
        if wrong:
            bad("opp.moves", "not in set:" + ",".join(sorted(wrong)), sorted(m["moves"]), sorted(v["moves"]))
    mon_features = set()
    # Entries for mons not seen yet (Team Preview's, named by species) can't be matched by name, so count
    # only entries beyond the number of mons still unseen.
    unmatched = set(opp_v) - (true_names & seen)
    extra = len(unmatched) - len(true_names - seen)
    if extra > 0:
        bad("opp.extra", f"{extra} extra", None, sorted(unmatched))
    return found


def classify(k, want, got, m):
    if k == "volatiles":
        parts = [f"missing:{x}" for x in sorted(want - got)] + [f"extra:{x}" for x in sorted(got - want)]
        return " ".join(parts)
    if k == "boosts":
        keys = sorted(set(want) | set(got))
        return "differ:" + ",".join(x for x in keys if want.get(x) != got.get(x))
    if k == "hp" and m["ability"] == "regenerator" and not m["active"]:
        return "regenerator"
    if k == "statusTurns":
        # The sim's toxic stage stops at 15 (data/conditions.ts).
        cap = " past cap" if m["status"] == "tox" and want == 15 and got > 15 else ""
        return f"{m['status']} {got - want:+d}{cap}"
    if k == "hp":
        return "off"
    if k == "moves":
        return "missing:" + ",".join(sorted(set(want) - set(got))) + " extra:" + ",".join(sorted(set(got) - set(want)))
    return f"{want or '-'}->{got or '-'}"


def opp_side(me):
    return "p2" if me == "p1" else "p1"


def main():
    games_path, truth_path, views_path, tracker, examples_path = sys.argv[1:6]
    n_ex = int(sys.argv[6]) if len(sys.argv) > 6 else 5
    tally = Tally(n_ex)
    null_views = 0
    with open(games_path, "rb") as gf, open(truth_path, "rb") as tf, open(views_path, "rb") as vf:
        for gl, tl, vl in zip(gf, tf, vf):
            g, t, v = orjson.loads(gl), orjson.loads(tl), orjson.loads(vl)
            assert g["game"] == t["game"] == v["game"]
            for side in ("p1", "p2"):
                illusion_seen = [False, False]
                td = [d for d in t["decisions"] if d["side"] == side]
                vd = [x for x in v["views"] if x["side"] == side]
                assert len(td) == len(vd), (g["game"], side, len(td), len(vd))
                for i, (d, x) in enumerate(zip(td, vd)):
                    tally.decisions += 1
                    if x["view"] is None:
                        null_views += 1
                        continue
                    where = f"{g['game']}:{side}:{i}:t{d['state']['turn']}"
                    view = norm_view(x["view"], tracker)
                    if compare_decision(tally, d["state"], view, side, g[side], d["chunk"], where, illusion_seen):
                        tally.bad_decisions += 1
    print(json.dumps({
        "tracker": tracker, "decisions": tally.decisions, "noView": null_views,
        "decisionsWithMismatch": tally.bad_decisions,
        "byField": dict(tally.by_field.most_common()),
        # Stage 2: per feature, how many (decision, mon) pairs were compared and the mismatches on them.
        "byFeature": {f: {"compared": n, **dict(tally.feature_bad[f].most_common())}
                      for f, n in sorted(tally.feature_mons.items())},
        "illusionNow": dict(tally.illusion["now"].most_common()),
        "illusionEarlier": dict(tally.illusion["after"].most_common()),
        # Per class: [total, at a decision where an Illusion holds, after one held earlier in the game].
        "byClass": {f"{f} | {c}": [n, tally.class_tags[(f, c)]["now"], tally.class_tags[(f, c)]["after"]]
                    for (f, c), n in tally.by_class.most_common()},
    }, indent=1))
    with open(examples_path, "w") as out:
        for (f, c), ex in sorted(tally.examples.items(), key=lambda kv: -tally.by_class[kv[0]]):
            out.write(json.dumps({"field": f, "class": c, "count": tally.by_class[(f, c)], "examples": ex}) + "\n")


if __name__ == "__main__":
    main()
