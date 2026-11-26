import { play, team } from './lib2.ts';
import { show } from './h.ts';
const T1 = team(`
Zacian-Crowned @ Rusted Sword
Ability: Intrepid Sword
Tera Type: Fairy
- Swords Dance
- Behemoth Blade
`);
const T2 = team(`
Zamazenta-Crowned @ Rusted Shield
Ability: Dauntless Shield
Tera Type: Steel
- Iron Defense
- Behemoth Bash
`);
const r = play('x', T1,T2,[['default','default'],['move 1 terastallize','move 1']],{v:true});
console.log(show(r,'p2'));
console.log(r.chunks[0][0]);
console.log(JSON.stringify(r.req[0]).slice(0,600));
