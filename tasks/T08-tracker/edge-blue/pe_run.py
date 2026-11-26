"""poke-env over the scenario games, same view format as T08's pokeenv.py (imported from the parent folder)."""
import json, sys
sys.path.insert(0, "..")
import orjson
import pokeenv as T

src, dst = sys.argv[1:3]
errs = T.Errors()
log = []
with open(dst, "w") as out:
    for line in open(src):
        g = orjson.loads(line)
        views = []
        for n, side in enumerate(("p1", "p2")):
            b = T.new_battle(f"battle-gen9nationaldex-{g['game']}", f"Bot {n + 1}", errs)
            ok = True
            for chunk in g[side]:
                if chunk.startswith("|request|"):
                    wait = orjson.loads(chunk[9:]).get("wait")
                    if ok:
                        before = sum(errs.thrown.values())
                        ok = T.feed(b, chunk, errs, f"{g['name']}{side}")
                    if not wait:
                        views.append({"side": side, "view": T.view(b) if ok else None})
                elif not chunk.startswith("|error|"):
                    for l in chunk.split("\n"):
                        if ok:
                            before = sum(errs.thrown.values())
                            ok = T.feed(b, l, errs, f"{g['name']}{side}")
                            if not ok:
                                log.append({"game": g["name"], "side": side, "line": l[:100]})
        out.write(json.dumps({"game": g["game"], "views": views}) + "\n")
print(json.dumps({"thrown": dict(errs.thrown), "where": sorted(errs.games_with_throw), "lines": log,
                  "warnings": dict(errs.handler.warnings)}, indent=1))
