// Shed Tail, Revival Blessing, Roar/Dragon Tail drags, Court Change, hazards
import { start, go, show, simShow, team, both } from './h.ts';
const T1 = team(`
Cyclizar @ Choice Scarf
Ability: Shed Skin
- Shed Tail
- Knock Off
- Taunt
- Spikes

Pawmot @ Leftovers
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- Spikes

Mew @ Leftovers
Ability: Synchronize
- Swords Dance
- Baton Pass
- Substitute
- Court Change
`);
const T2 = team(`
Blissey @ Leftovers
Ability: Natural Cure
- Roar
- Toxic
- Seismic Toss
- Stealth Rock

Toxapex @ Black Sludge
Ability: Regenerator
- Toxic Spikes
- Recover
- Haze
- Knock Off

Garchomp @ Rocky Helmet
Ability: Rough Skin
- Earthquake
- Swords Dance
- Roar
- Dragon Tail
`);
const r = start(T1, T2, 7);
go(r, ['default', 'default']);
go(r, ['move 4', 'move 4']);       // Spikes, Stealth Rock
both(r, 'hazards'); 
go(r, ['move 1', 'move 3']);       // Shed Tail, Seismic Toss
console.log(r.req[0].forceSwitch);
go(r, ['switch 3', null]);          // Mew in from shed tail
both(r, 'shed tail'); console.log(show(r,'p2')); console.log(simShow(r,'p1'));
console.log(r.b.log.slice(-30).join('\n'));
