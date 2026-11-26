import { play, team } from './lib2.ts';
import { show } from './h.ts';
const T1 = team(`
Ogerpon-Wellspring @ Wellspring Mask
Ability: Water Absorb
- Ivy Cudgel
- Swords Dance
- Horn Leech
- Knock Off

Zacian-Crowned @ Rusted Sword
Ability: Intrepid Sword
- Swords Dance
- Behemoth Blade
- Close Combat
- Play Rough

Urshifu-Rapid-Strike @ Choice Band
Ability: Unseen Fist
- Surging Strikes
- Close Combat
- U-turn
- Aqua Jet

Zamazenta-Crowned @ Rusted Shield
Ability: Dauntless Shield
- Iron Defense
- Behemoth Bash
- Close Combat
- Crunch
`);
const T2 = team(`
Zamazenta-Crowned @ Rusted Shield
Ability: Dauntless Shield
- Iron Defense
- Behemoth Bash
- Close Combat
- Crunch

Zacian-Crowned @ Rusted Sword
Ability: Intrepid Sword
- Swords Dance
- Behemoth Blade
- Close Combat
- Play Rough

Urshifu-Rapid-Strike @ Choice Band
Ability: Unseen Fist
- Surging Strikes
- Close Combat
- U-turn
- Aqua Jet

Ogerpon-Cornerstone @ Cornerstone Mask
Ability: Sturdy
- Ivy Cudgel
- Swords Dance
- Horn Leech
- Knock Off
`);
const r = play('forms', T1, T2, [
 ['default','default'],
 ['move 2','move 1'],
 ['switch 2','switch 2'],
 ['switch 3','switch 3'],
 ['switch 4','switch 4'],
 ['switch 1','switch 1'],
], {v:false, fmt:'gen9nationaldex'});
console.log(r.chunks[1][0].split('\n').filter(l=>l.startsWith('|poke')).join('\n'));
console.log(show(r,'p2'));
