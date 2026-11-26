import json, sys
sys.path.insert(0, '..')
import pokeenv as P
d = json.load(open('scen/twoturn.json')); errs = P.Errors()
b = P.new_battle('battle-gen9nationaldex-1', 'P2', errs)
pos = 0
for i, mk in enumerate([m[1] for m in d['marks']]):
    while pos < mk:
        c = d['p2'][pos]; pos += 1
        if c.startswith('|request|'): P.feed(b, c, errs, 'x')
        elif not c.startswith('|error|'):
            for l in c.split('\n'): P.feed(b, l, errs, 'x')
    o = b.opponent_active_pokemon
    print(i, o.species if o else None, 'preparing=', getattr(o, '_preparing_move', None) or getattr(o, 'preparing', None), 'recharge=', Effect.MUST_RECHARGE in o.effects if False else [e.name for e in o.effects] if o else None)
