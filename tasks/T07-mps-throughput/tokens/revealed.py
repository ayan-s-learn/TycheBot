"""Share of opposing moves revealed at each turn start, from T04's public replays (p1's view of p2 and vice versa).
Moves counted: |move| lines without [from] (so not Magic Bounce/Dancer etc.), excluding Struggle. Z-move names count as moves (slight overcount)."""
import gzip, json, sys, statistics as st
from collections import defaultdict
path = sys.argv[1]
act_fracs, seen_fracs, team_fracs, turn_buckets = [], [], [], defaultdict(list)
dist_active = defaultdict(int)
for line in gzip.open(path, 'rt'):
    g = json.loads(line)
    moves = {'p1': defaultdict(set), 'p2': defaultdict(set)}
    active = {'p1': None, 'p2': None}
    seen = {'p1': set(), 'p2': set()}
    fainted = {'p1': set(), 'p2': set()}
    turn = 0
    for l in g['log'].split('\n'):
        p = l.split('|')
        if len(p) < 2: continue
        t = p[1]
        if t in ('switch', 'drag', 'replace') and len(p) > 2:
            side, nick = p[2][:2], p[2].split(': ', 1)[1]
            active[side] = nick; seen[side].add(nick)
        elif t == 'faint':
            side, nick = p[2][:2], p[2].split(': ', 1)[1]; fainted[side].add(nick)
        elif t == 'move' and len(p) > 3:
            if any('[from]' in x for x in p[4:]): continue
            side, nick = p[2][:2], p[2].split(': ', 1)[1]
            if p[3] == 'Struggle': continue
            moves[side][nick].add(p[3])
        elif t == 'turn':
            turn = int(p[2])
            for me, opp in (('p1', 'p2'), ('p2', 'p1')):
                a = active[opp]
                if a and a not in fainted[opp]:
                    n = min(len(moves[opp][a]), 4); act_fracs.append(n / 4); dist_active[n] += 1
                    turn_buckets[min(turn // 10, 5)].append(n / 4)
                alive_seen = [m for m in seen[opp] if m not in fainted[opp]]
                if alive_seen:
                    seen_fracs.append(st.mean(min(len(moves[opp][m]), 4) / 4 for m in alive_seen))
                # whole team: 6 mons, unseen count 0
                alive = 6 - len(fainted[opp])
                team_fracs.append(sum(min(len(moves[opp][m]), 4) for m in alive_seen) / (4 * alive) if alive else 0)
print('decisions (turn starts x 2 players):', len(act_fracs))
print('opposing active: mean revealed share %.2f, median %.2f' % (st.mean(act_fracs), st.median(act_fracs)))
tot = sum(dist_active.values()); print('  revealed count distribution:', {k: f'{v/tot:.0%}' for k, v in sorted(dist_active.items())})
print('opposing seen, unfainted mons: mean share %.2f' % st.mean(seen_fracs))
print('opposing team, all unfainted (unseen = 0): mean share %.2f' % st.mean(team_fracs))
for b in sorted(turn_buckets): print(f'  active, turns {b*10}-{b*10+9 if b<5 else "+"}: {st.mean(turn_buckets[b]):.2f} (n={len(turn_buckets[b])})')
