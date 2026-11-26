import { play, team } from './lib2.ts';
import { FixedBattle } from './layer.ts';
import { gens } from './h.ts';
import { show } from './h.ts';
const A = team(`
Corviknight @ Leftovers
Ability: Pressure
- Bounce
- Roost
- Brave Bird
- Taunt

Garchomp @ Leftovers
Ability: Rough Skin
- Dig
- Solar Beam
- Hyper Beam
- Encore

Gengar @ Leftovers
Ability: Cursed Body
- Phantom Force
- Substitute
- Disable
- Destiny Bond
`);
const B = team(`
Blissey @ Leftovers
Ability: Natural Cure
- Soft-Boiled
- Toxic
- Wish
- Heal Bell

Chansey @ Leftovers
Ability: Natural Cure
- Soft-Boiled
- Torment
- Wish
- Yawn
`);
play('twoturn', A, B, [
 ['default','default'],
 ['move 1','move 1', 'bounce -> mid-air'],
 ['move 1','move 1', 'bounce lands'],
 ['switch 2','move 4', 'garchomp in, yawn'],
 ['move 1','move 2', 'dig'],
 ['move 1','move 1', 'dig hits'],
 ['move 3','move 1', 'hyper beam'],
 ['move 3','move 2', 'recharge'],
 ['move 4','move 3', 'encore'],
 ['switch 3','move 1', 'gengar'],
 ['move 2','move 1', 'sub'],
 ['move 1','move 1', 'phantom force'],
], {v:[1,4], mk: (side: any) => new FixedBattle(gens, side)});
