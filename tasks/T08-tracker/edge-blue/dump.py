"""Shows truth and both trackers' view of the active mons (or all with -a) at decision i of a side.
Usage: uv run python dump.py <scenario> <p1|p2> <i> [mon-substr]"""
import json, sys
name, side, i = sys.argv[1], sys.argv[2], int(sys.argv[3]); sub = sys.argv[4] if len(sys.argv) > 4 else ""
games = [json.loads(l) for l in open("out/games.jsonl")]
gi = [g["name"] for g in games].index(name)
truth = [json.loads(l) for l in open("out/truth.jsonl")][gi]
vp = [json.loads(l) for l in open("out/views-pkmn.jsonl")][gi]
ve = [json.loads(l) for l in open("out/views-pokeenv.jsonl")][gi]
td = [d for d in truth["decisions"] if d["side"] == side][i]
mi = 0 if side == "p1" else 1
pv = [x for x in vp["views"] if x["side"] == side][i]["view"]
ev = [x for x in ve["views"] if x["side"] == side][i]["view"]
print("turn", td["state"]["turn"])
def show(tag, m):
    keys = ["species", "hp", "maxhp", "status", "item", "ability", "moves", "boosts", "volatiles"]
    print(f"   {tag:9}", {k: m.get(k) for k in keys})
for who, ti, vk in (("OWN", mi, "own"), ("OPP", 1 - mi, "opp")):
    for m in td["state"]["sides"][ti]["mons"]:
        if not m["active"] or sub not in m["name"].lower() and sub: continue
        print(who, m["name"])
        show("truth", m)
        for tag, v in (("pkmn", pv), ("pokeenv", ev)):
            vm = v[vk].get(m["name"])
            if vm is None:
                # transformed/illusion: show active
                vm = next((x for x in v[vk].values() if x["active"]), None)
            show(tag, vm or {})
print("conds truth own", td["state"]["sides"][mi]["conds"], td["state"]["sides"][mi]["slotConds"], "opp", td["state"]["sides"][1-mi]["conds"], td["state"]["sides"][1-mi]["slotConds"])
print("conds pkmn", pv["ownConds"], pv["oppConds"], "pokeenv", ev["ownConds"], ev["oppConds"])
print("field truth", td["state"]["field"], "pkmn", pv["field"], "pe", ev["field"])
