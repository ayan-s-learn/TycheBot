import { play, team } from './lib2.ts';
const A = team(`
Pawmot @ Leftovers
Ability: Volt Absorb
- Revival Blessing
- Close Combat
- Nuzzle
- U-turn

Mew @ Leftovers
Ability: Synchronize
- Court Change
- Perish Song
- Wish
- Encore

Cresselia @ Eject Button
Ability: Levitate
- Moonlight
- Mean Look
- Disable
- Substitute

Corviknight @ Leftovers
Ability: Pressure
- Defog
- Roost
- Brave Bird
- Taunt
`);
const B = team(`
Garchomp @ Focus Sash
Ability: Rough Skin
- Earthquake
- Spikes
- Roar
- Dragon Tail

Volcarona @ Leftovers
Ability: Flame Body
- Fire Spin
- Quiver Dance
- Morning Sun
- Toxic Spikes

Clefable @ Red Card
Ability: Magic Guard
- Moonblast
- Calm Mind
- Soft-Boiled
- Stealth Rock

Toxapex @ Black Sludge
Ability: Regenerator
- Toxic Spikes
- Haze
- Recover
- Knock Off
`);
play('misc', A, B, [
 ['default','default'],
 ['move 3','move 2', 'close combat? no: Nuzzle; Garchomp spikes'],
 ['switch 2','move 4'],
 ['move 1','move 3', 'court change; roar'],
 ['move 2','switch 2', 'perish song; volcarona in'],
 ['move 3','move 1', 'wish; fire spin'],
 ['switch 3','move 1', 'cresselia in, eject button'],
 ['move 3','move 1', 'disable'],
 ['move 2','move 2'],
], {v:true});
