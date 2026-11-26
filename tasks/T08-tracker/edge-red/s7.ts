import { play, team } from './lib2.ts';
const A = team(`
Mew @ Leftovers
Ability: Synchronize
- Memento
- Explosion
- Wish
- Encore

Pawmot @ Leftovers
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- U-turn

Corviknight @ Leftovers
Ability: Pressure
- Defog
- Roost
- Brave Bird
- Taunt
`);
const B = team(`
Mew @ Leftovers
Ability: Synchronize
- Memento
- Explosion
- Wish
- Encore

Pawmot @ Sitrus Berry
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- U-turn

Clefable @ Red Card
Ability: Magic Guard
- Moonblast
- Calm Mind
- Soft-Boiled
- Stealth Rock
`);
play('revival', A, B, [
 ['default','default'],
 ['move 1','move 1', 'memento both'],
 ['switch 2','switch 2', 'pawmots in'],
 ['move 1', 'move 3', 'p1 RB'],
 ['switch 2', null, 'revive Mew'],
 ['move 3','move 1', 'p2 RB'],
 [null,'switch 2'],
], {v:true});
