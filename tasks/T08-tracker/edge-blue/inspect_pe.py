"""Final tracked state in poke-env. Usage: uv run python inspect_pe.py <scenario>"""
import sys, json
sys.path.insert(0, "..")
import orjson, pokeenv as T
name = sys.argv[1]
errs = T.Errors()
for line in open("out/games.jsonl"):
    g = orjson.loads(line)
    if g["name"] != name: continue
    for n, side in enumerate(("p1", "p2")):
        b = T.new_battle(f"battle-gen9nationaldex-{g['game']}", f"Bot {n+1}", errs)
        for chunk in g[side]:
            if chunk.startswith("|request|"):
                T.feed(b, chunk, errs, "x")
            elif not chunk.startswith("|error|"):
                for l in chunk.split("\n"): T.feed(b, l, errs, "x")
        print("== poke-env as", side)
        for tag, team in (("own", b.team), ("opp", b.opponent_team)):
            for k, m in team.items():
                print(tag, k, json.dumps(dict(species=m.species, types=[t.name.lower() for t in m.types if t], item=m.item, ability=m.ability, hp=m.current_hp, maxhp=m.max_hp, status=m.status.name if m.status else None, moves=list(m.moves), boosts={a:v for a,v in m.boosts.items() if v}, tera=m.tera_type.name if m.tera_type else None, terad=m.is_terastallized, stats=m.stats, base=m.base_stats, active=m.active, eff=[e.name for e in m.effects]), default=str))
        print("conds", {k.name: v for k, v in b.side_conditions.items()}, {k.name: v for k, v in b.opponent_side_conditions.items()}, "fields", [f.name for f in b.fields], [w.name for w in b.weather])
