import { start, go, show, simShow, team, dump } from './h.ts';
const t1 = team(`
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
const t2 = team(`
Garchomp @ Rocky Helmet
Ability: Rough Skin
- Earthquake
- Swords Dance
- Roar
- Dragon Tail

Gengar @ Life Orb
Ability: Cursed Body
- Shadow Ball
- Substitute
- Trick
- Perish Song

Rotom-Wash @ Sitrus Berry
Ability: Levitate
- Hydro Pump
- Will-O-Wisp
- Hex
- Thunderbolt
`);
const r = start(t1, t2, 3);
go(r, ['default', 'default']);
go(r, ['move 1', 'move 2']); // SD ; Garchomp SD
go(r, ['move 3', 'move 1']); // Mew sub ; garchomp EQ
console.log(r.errors, '\n', show(r, 'p2', {own:true}), '\n', simShow(r,'p1'));
go(r, ['move 2', 'move 1']); // Baton Pass
console.log(r.b.log.slice(-20).join('\n'));
go(r, ['switch 2', null]);
console.log(r.errors,'\n', show(r, 'p2'), '\n', simShow(r,'p1'));
console.log(JSON.stringify(r.req[0]).slice(0,300));
