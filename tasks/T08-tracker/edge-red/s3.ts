// Tera + switching; Ogerpon, Terapagos; Crowned formes from Team Preview
import { play, team } from './lib2.ts';
const T1 = team(`
Ogerpon-Wellspring @ Wellspring Mask
Ability: Water Absorb
Tera Type: Water
- Ivy Cudgel
- Swords Dance
- Horn Leech
- Knock Off

Zacian-Crowned @ Rusted Sword
Ability: Intrepid Sword
Tera Type: Fairy
- Swords Dance
- Behemoth Blade
- Close Combat
- Play Rough

Terapagos @ Leftovers
Ability: Tera Shift
Tera Type: Stellar
- Tera Starstorm
- Rapid Spin
- Earth Power
- Calm Mind
`);
const T2 = team(`
Zamazenta-Crowned @ Rusted Shield
Ability: Dauntless Shield
Tera Type: Steel
- Iron Defense
- Behemoth Bash
- Close Combat
- Crunch

Blissey @ Leftovers
Ability: Natural Cure
Tera Type: Normal
- Roar
- Toxic
- Soft-Boiled
- Stealth Rock

Chansey @ Eviolite
Ability: Natural Cure
Tera Type: Fairy
- Seismic Toss
- Soft-Boiled
- Dragon Tail
- Thunder Wave
`);
play('tera', T1, T2, [
 ['default','default'],
 ['move 2 terastallize','move 1', 'Ogerpon tera, SD'],
 ['switch 2', 'move 1'],
 ['switch 3', 'move 1', 'terapagos in'],
 ['move 4 terastallize','move 1'],
 ['switch 1', 'move 1'],
 ['switch 2', 'move 2'],
], {v: true});
