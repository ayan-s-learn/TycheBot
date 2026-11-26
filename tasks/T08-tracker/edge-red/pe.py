"""Feeds a saved scenario (scen/<name>.json from h.ts dump) to poke-env's Battle and prints its state after each step.
Usage: uv run python pe.py <name> <p1|p2> [steps comma list]"""
import json, sys
sys.path.insert(0, '..')
import pokeenv as P

name, me = sys.argv[1], sys.argv[2]
want = set(int(x) for x in sys.argv[3].split(',')) if len(sys.argv) > 3 else None
d = json.load(open(f'scen/{name}.json'))
errs = P.Errors()
n = 0 if me == 'p1' else 1
b = P.new_battle('battle-gen9nationaldex-1', 'P1' if me == 'p1' else 'P2', errs)
chunks = d[me]
marks = [m[n] for m in d['marks']]
pos = 0
def show(i):
    v = P.view(b)
    print(f'  step {i} turn={v["turn"]} flags={v["flags"]} field={v["field"]} oppconds={v["oppConds"]} ownconds={v["ownConds"]}')
    for who in ('own', 'opp'):
        for k, m in v[who].items():
            print(f'    {who} {k}: sp={m["species"]} hp={m["hp"]}/{m["maxhp"]} st={m["status"]} fnt={m["fainted"]} item={m["item"]} ab={m["ability"]} act={m["active"]} boosts={m["boosts"]} eff={m["volatiles"]} moves={m["moves"]}')
for i, mk in enumerate(marks):
    while pos < mk:
        c = chunks[pos]; pos += 1
        if c.startswith('|request|'):
            P.feed(b, c, errs, 'x')
        elif not c.startswith('|error|'):
            for l in c.split('\n'): 
                if not P.feed(b, l, errs, 'x'): print('THROW', l, errs.thrown)
    if want is None or i in want: show(i)
print('thrown', dict(errs.thrown), 'ignored', dict(errs.ignored), 'warn', dict(errs.handler.warnings))
