import json, sys
for l in open("out/meta.json") and [json.load(open("out/meta.json"))]:
    for m in l:
        if m["name"] == sys.argv[1]:
            for i, s in enumerate(m["final"]):
                for p in s: print("sim p%d" % (i+1), json.dumps(p))
