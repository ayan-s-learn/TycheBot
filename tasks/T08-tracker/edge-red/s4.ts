// Imposter / Transform / Revival Blessing
import { play, team } from './lib2.ts';
const DIT = `
Ditto @ Choice Scarf
Ability: Imposter
- Transform
`;
const A = team(`
Ditto @ Choice Scarf
Ability: Imposter
- Transform

Dit2 (Ditto) @ Leftovers
Ability: Limber
- Transform

Garchomp @ Rocky Helmet
Ability: Rough Skin
- Earthquake
- Swords Dance
- Roar
- Dragon Tail
`);
const B = team(`
Clefable @ Leftovers
Ability: Magic Guard
- Moonblast
- Calm Mind
- Soft-Boiled
- Stealth Rock

Garchomp @ Rocky Helmet
Ability: Rough Skin
- Earthquake
- Swords Dance
- Roar
- Dragon Tail
`);
// p1 Ditto Imposter vs Clefable (p2 Clefable boosts via Calm Mind after) ; p1 opp view
play('imposter', A, B, [
 ['default','default'],
 ['move 1','move 2', 'ditto already transformed by imposter; CM'],
 ['move 1','move 2', 'transform again -> fails?'],
 ['switch 2','move 3'],
 ['move 1','move 4', 'limber ditto transforms'],
 ['switch 3','switch 2'],
], {v:[4,5], show:['p2']});
// p2 switching in Ditto Imposter against a mon the p2 view knows little about
play('imposter-opp', B, A, [
 ['default','default'],
 ['move 2','move 1', 'CM; ditto imposter copying boosts'],
 ['move 2','move 1'],
 ['move 3','switch 2'],
], {v:true});
