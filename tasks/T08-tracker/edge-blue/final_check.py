"""Same check for poke-env: types, species, ability, item, boosts of each active mon at the end of every scenario."""
import sys, json
sys.path.insert(0, "..")
import orjson, pokeenv as T
meta = json.load(open("out/meta.json"))
idf = lambda s: "".join(c for c in str(s or "").lower() if c.isalnum())
errs = T.Errors()
for line in open("out/games.jsonl"):
    g = orjson.loads(line)
    m = next(x for x in meta if x["name"] == g["name"])
    for si, side in enumerate(("p1", "p2")):
        b = T.new_battle(f"battle-gen9nationaldex-{g['game']}", f"Bot {si+1}", errs)
        for chunk in g[side]:
            if chunk.startswith("|request|"): T.feed(b, chunk, errs, g["name"])
            elif not chunk.startswith("|error|"):
                for l in chunk.split("\n"): T.feed(b, l, errs, g["name"])
        for who, tside, team in (("own", si, b.team), ("opp", 1 - si, b.opponent_team)):
            t = next((p for p in m["final"][tside] if p["active"]), None)
            p = next((x for x in team.values() if x.active), None)
            if not t or not p or t["hp"] == 0: continue
            d = []
            types = sorted(x.name.lower() for x in p.types if x)
            if types != sorted(x.lower() for x in t["types"]): d.append(f"types sim={t['types']} tracker={types}")
            if idf(p.species) != idf(t["species"]): d.append(f"species sim={t['species']} tracker={p.species}")
            if (who == "own" or p.ability) and idf(p.ability) != idf(t["ability"]): d.append(f"ability sim={t['ability']} tracker={p.ability}")
            it = None if p.item == "unknown_item" else p.item
            if (who == "own" or it) and idf(it) != idf(t["item"]): d.append(f"item sim={t['item']} tracker={it}")
            bo = {k: v for k, v in p.boosts.items() if v}
            tb = {k: v for k, v in t["boosts"].items() if v and k not in ("accuracy", "evasion")}
            if bo != tb: d.append(f"boosts sim={tb} tracker={bo}")
            if d: print(f"{g['name']} as {side} {who} {t['name']}: " + "; ".join(d))
print("poke-env throws:", dict(errs.thrown))
