import { start, go, show, simShow, team, both, log } from './h.ts';
const T1 = team(`
Mew @ Leftovers
Ability: Synchronize
- Swords Dance
- Baton Pass
- Substitute
- Revival Blessing

Cyclizar @ Choice Scarf
Ability: Shed Skin
- Shed Tail
- Knock Off
- Taunt
- Draco Meteor

Pawmot @ Leftovers
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- Spikes
`);
const T2 = team(`
Blissey @ Leftovers
Ability: Natural Cure
- Roar
- Toxic
- Wish
- Heal Bell

Chansey @ Eviolite
Ability: Natural Cure
- Seismic Toss
- Soft-Boiled
- Dragon Tail
- Thunder Wave

Toxapex @ Black Sludge
Ability: Regenerator
- Toxic Spikes
- Recover
- Haze
- Knock Off
`);
const r = start(T1, T2, 5);
go(r, ['default', 'default']);
go(r, ['move 1', 'move 2']);   // SD, Toxic
both(r, 'sd+toxic');
go(r, ['move 3', 'move 3']);   // Sub, Wish
both(r, 'sub');
go(r, ['move 2', 'move 4']);   // Baton Pass, Heal Bell
let n = r.b.log.length;
go(r, ['switch 2', null]);
both(r, 'after BP'); console.log(show(r,'p2')); console.log(simShow(r,'p1'));
go(r, ['move 1', 'move 1']);   // Shed Tail, Roar
both(r, 'shed tail'); console.log(r.b.log.slice(-25).join('\n'));
console.log(r.req[0].forceSwitch);
go(r, ['switch 2', null]);
both(r, 'after shed switch'); console.log(show(r,'p2')); console.log(simShow(r,'p1'));
console.log(r.b.log.slice(-15).join('\n'));
