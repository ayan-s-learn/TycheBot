"""Prints one scenario's protocol as one player saw it. Usage: uv run python show.py <name> <p1|p2> [grep]"""
import json, sys
name, side = sys.argv[1:3]
pat = sys.argv[3] if len(sys.argv) > 3 else None
for line in open("out/games.jsonl"):
    g = json.loads(line)
    if g["name"] != name:
        continue
    for c in g[side]:
        if c.startswith("|request|"):
            r = json.loads(c[9:])
            if r.get("wait"):
                print("  [wait]"); continue
            act = r.get("active")
            print("  [REQUEST]", "forceSwitch" if r.get("forceSwitch") else "", [m["id"] for m in act[0]["moves"]] if act else "", "trapped" if act and act[0].get("trapped") else "")
        elif c.startswith("|error|"):
            print("  [ERROR]", c)
        else:
            for l in c.split("\n"):
                if l.startswith(("|t:|", "|split|")) or not l: continue
                if pat is None or pat in l: print(l)
