// Items and abilities: Knock Off, Trick, Thief, Covet, Skill Swap, Trace, Neutralizing Gas, Wandering Spirit, Mummy, Revival Blessing, Pursuit/U-turn, Eject Button, Emergency Exit, Red Card, Dragon Tail
import { play, team } from './lib2.ts';
const A = team(`
Skarmory @ Leftovers
Ability: Sturdy
- Knock Off
- Trick
- Skill Swap
- Spikes

Porygon2 @ Eviolite
Ability: Trace
- Recover
- Thunder Wave
- Roar
- Dragon Tail

Weezing-Galar @ Black Sludge
Ability: Neutralizing Gas
- Will-O-Wisp
- Pain Split
- Defog
- Strange Steam

Pawmot @ Leftovers
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- U-turn
`);
const B = team(`
Blissey @ Choice Scarf
Ability: Natural Cure
- Seismic Toss
- Toxic
- Soft-Boiled
- Stealth Rock

Chansey @ Eviolite
Ability: Natural Cure
- Seismic Toss
- Soft-Boiled
- Dragon Tail
- Thunder Wave

Gardevoir @ Sitrus Berry
Ability: Trace
- Moonblast
- Psychic
- Calm Mind
- Will-O-Wisp

Mimikyu @ Red Card
Ability: Disguise
- Shadow Sneak
- Play Rough
- Swords Dance
- Trick
`);
play('items', A, B, [
 ['default','default'],
 ['move 1','move 1', 'Knock Off Blissey scarf; seismic toss'],
 ['move 3','move 4', 'skill swap; stealth rock'],
 ['move 2','move 3'],
 ['switch 2','switch 3', 'p2: gardevoir trace in'],
 ['switch 3','switch 4', 'weezing NG vs mimikyu'],
 ['move 3','move 3'],
 ['switch 4','switch 3'],
], {v:true});
