import { play, team } from './lib2.ts';
import { FixedBattle } from './layer.ts';
import { gens, show, simShow } from './h.ts';
const A = team(`
Garchomp @ Leftovers
Ability: Rough Skin
- Earthquake
- Swords Dance
- Roar
- Dragon Tail

Zoroark-Hisui @ Life Orb
Ability: Illusion
- Nasty Plot
- Bitter Malice
- Hyper Voice
- Focus Blast

Gengar @ Leftovers
Ability: Cursed Body
- Shadow Ball
- Substitute
- Will-O-Wisp
- Destiny Bond
`);
const B = team(`
Ditto @ Choice Scarf
Ability: Imposter
- Transform

Blissey @ Leftovers
Ability: Natural Cure
- Soft-Boiled
- Toxic
- Wish
- Heal Bell
`);
for (const [nm, mk] of [['plain', undefined], ['layered', (s: any) => new FixedBattle(gens, s)]] as const) {
 const r = play('illusion-imposter-' + nm, A, B, [
  ['default','default'],
  ['switch 2','move 1', 'zoroark in as gengar; ditto transform (choice scarf) -> copies disguise'],
  ['move 1','move 1', 'nasty plot'],
  ['move 2','move 1', 'bitter malice hits ditto: breaks illusion'],
  ['move 3','move 1'],
 ], {v:[1,3], mk});
 console.log(show(r,'p2')); console.log(simShow(r,'p1'));
}
