"""Per-scenario mismatch listing from compare.py's examples. Usage: uv run python rep.py <pkmn|pokeenv> [scenario-substr]"""
import json, sys
tr = sys.argv[1]; sub = sys.argv[2] if len(sys.argv) > 2 else ""
names = {json.loads(l)["game"]: json.loads(l)["name"] for l in open("out/games.jsonl")}
rows = {}
for l in open(f"out/ex-{tr}.jsonl"):
    r = json.loads(l)
    for e in r["examples"]:
        g = int(e["where"].split(":")[0])
        if sub in names[g]:
            rows.setdefault((names[g], r["field"], r["class"]), []).append(e)
for (n, f, c), es in sorted(rows.items()):
    print(f"{n:22} {f:14} {c[:60]:60} x{len(es)} e.g. {es[0]['where']} want={json.dumps(es[0]['want'])[:50]} got={json.dumps(es[0]['got'])[:60]}")
