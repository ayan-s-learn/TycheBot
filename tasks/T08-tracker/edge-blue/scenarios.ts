// Scenario definitions. A mon is [species, item, ability, moves, extra lines]. Teams are not validated (Battle doesn't validate).
export type Mon = [string, string, string, string[], string?];
export interface Scenario { name: string, p1: string, p2: string, steps: [string | null, string | null][], seed?: number, format?: string }
const team = (...mons: Mon[]) => mons.map(([s, i, a, m, x]) =>
	`${s}${i ? ' @ ' + i : ''}\nAbility: ${a}\nEVs: 252 HP / 252 SpD / 4 Spe\n${x ? x + '\n' : ''}${m.map(v => '- ' + v).join('\n')}`).join('\n\n');
const P: [string, string] = ['default', 'default'];
const S = (a: string | null, b: string | null): [string | null, string | null] => [a, b];

const filler: Mon = ['Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Protect']];
const wall: Mon = ['Skarmory', 'Leftovers', 'Sturdy', ['Spikes', 'Roost', 'Protect', 'Iron Head']];

export const scenarios: Scenario[] = [
	{ name: 'imposter-own', // p1's Ditto transforms on entry into a +0 Garchomp that then boosts
		p1: team(['Ditto', 'Leftovers', 'Imposter', ['Transform']], filler),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Stealth Rock', 'Dragon Claw']], wall),
		steps: [P, S('move 1', 'move 1'), S('move 2', 'move 3'), S('move 2', 'move 2')] },
	{ name: 'imposter-opp', // p2's Ditto enters, copying a +2 Garchomp and its boosts
		p1: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Swords Dance', 'Earthquake', 'Stealth Rock', 'Dragon Claw']], filler),
		p2: team(wall, ['Ditto', 'Leftovers', 'Imposter', ['Transform']]),
		steps: [P, S('move 1', 'move 1'), S('move 1', 'switch 2'), S('move 2', 'move 2'), S(null, 'switch 1'), S('move 2', 'move 3')] },
	{ name: 'baton-pass', // Substitute and boosts pass; the receiver then acts
		p1: team(['Scizor', 'Leftovers', 'Technician', ['Swords Dance', 'Substitute', 'Baton Pass', 'Bullet Punch']], ['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']]),
		p2: team(['Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Protect']], wall),
		steps: [P, S('move 1', 'move 4'), S('move 2', 'move 4'), S('move 3', 'move 4'), S('switch 2', null), S('move 1', 'move 1')] },
	{ name: 'shed-tail', // Substitute handed to the next mon, user is switched out
		p1: team(['Cyclizar', 'Leftovers', 'Shed Skin', ['Shed Tail', 'Protect']], ['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']]),
		p2: team(['Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Protect']], wall),
		steps: [P, S('move 1', 'move 4'), S('switch 2', null), S('move 4', 'move 1')] },
	{ name: 'court-change', // hazards on both sides, then Court Change swaps them
		p1: team(['Mew', 'Leftovers', 'Synchronize', ['Court Change', 'Stealth Rock', 'Spikes', 'Protect']], filler),
		p2: team(['Skarmory', 'Leftovers', 'Sturdy', ['Spikes', 'Toxic Spikes', 'Sticky Web', 'Roost']], filler),
		steps: [P, S('move 2', 'move 1'), S('move 3', 'move 2'), S('move 1', 'move 3'), S('move 4', 'move 4')] },
	{ name: 'hazard-absorb', // grounded Poison type absorbs Toxic Spikes; Rapid Spin; Defog
		p1: team(['Skarmory', 'Leftovers', 'Sturdy', ['Toxic Spikes', 'Spikes', 'Stealth Rock', 'Defog']], ['Toxapex', 'Leftovers', 'Regenerator', ['Recover', 'Protect']], ['Forretress', 'Leftovers', 'Sturdy', ['Rapid Spin', 'Protect']]),
		p2: team(wall, ['Toxapex', 'Leftovers', 'Regenerator', ['Recover', 'Protect']], ['Forretress', 'Leftovers', 'Sturdy', ['Rapid Spin', 'Protect', 'Spikes']]),
		steps: [P, S('move 1', 'move 1'), S('move 2', 'move 3'), S('move 3', 'move 3'), S('switch 2', 'switch 2'), S('move 1', 'move 1'), S('switch 3', 'switch 3'), S('move 1', 'move 1')] },
	{ name: 'revival-blessing',
		p1: team(['Pincurchin', 'Leftovers', 'Electric Surge', ['Revival Blessing', 'Protect']], ['Pikachu', 'Light Ball', 'Static', ['Surf', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']], wall),
		steps: [P, S('move 2', 'move 1'), S('switch 2', null), S('move 2', 'move 2'), S('move 2', 'move 1')] },
	{ name: 'crowned-formes',
		p1: team(['Zamazenta-Crowned', 'Rusted Shield', 'Dauntless Shield', ['Iron Head', 'Protect', 'Close Combat', 'Behemoth Bash']], filler),
		p2: team(['Zacian-Crowned', 'Rusted Sword', 'Intrepid Sword', ['Behemoth Blade', 'Protect', 'Close Combat', 'Play Rough']], filler),
		steps: [P, S('move 2', 'move 2'), S('move 1', 'move 1')] },
	{ name: 'tera-ogerpon-terapagos',
		p1: team(['Ogerpon-Wellspring', 'Wellspring Mask', 'Water Absorb', ['Ivy Cudgel', 'Protect', 'Horn Leech', 'Swords Dance'], 'Tera Type: Water'], ['Terapagos', 'Leftovers', 'Tera Shift', ['Tera Starstorm', 'Protect', 'Earth Power', 'Calm Mind']]),
		p2: team(['Gholdengo', 'Leftovers', 'Good as Gold', ['Make It Rain', 'Protect', 'Nasty Plot', 'Shadow Ball'], 'Tera Type: Fairy'], ['Terapagos', 'Leftovers', 'Tera Shift', ['Tera Starstorm', 'Protect', 'Earth Power', 'Calm Mind']]),
		steps: [P, S('move 1', 'move 2'), S('switch 2', 'switch 2'), S('move 4', 'move 4')] },
	{ name: 'item-swaps', // Trick, Knock Off, Switcheroo (drag-in), Fling
		p1: team(['Weavile', 'Choice Scarf', 'Pressure', ['Knock Off', 'Trick', 'Switcheroo', 'Fling']], filler),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Roost', 'Protect', 'Earthquake', 'Dragon Claw']], ['Gengar', 'Black Sludge', 'Cursed Body', ['Shadow Ball', 'Protect']]),
		steps: [P, S('move 2', 'move 1'), S('move 1', 'move 1'), S('move 3', 'switch 2'), S('move 4', 'move 2'), S('move 1', 'move 1')] },
	{ name: 'ability-swaps', // Skill Swap, Trace, Neutralizing Gas, Mummy, Role Play, Gastro Acid, Worry Seed
		p1: team(['Porygon2', 'Eviolite', 'Trace', ['Recover', 'Protect']], ['Mew', 'Leftovers', 'Synchronize', ['Skill Swap', 'Role Play', 'Gastro Acid', 'Worry Seed']], ['Weezing-Galar', 'Leftovers', 'Neutralizing Gas', ['Protect', 'Will-O-Wisp']]),
		p2: team(['Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Protect', 'Flare Blitz', 'Knock Off']], ['Cofagrigus', 'Leftovers', 'Mummy', ['Protect', 'Will-O-Wisp']], ['Gengar', 'Leftovers', 'Cursed Body', ['Shadow Ball', 'Protect']]),
		steps: [P, S('move 1', 'move 2'), S('switch 2', 'move 2'), S('move 1', 'move 2'), S('move 2', 'switch 2'), S('move 2', 'move 2'), S('move 3', 'move 2'), S('switch 3', 'move 2'), S('move 1', 'move 2')] },
	{ name: 'volatiles', // Leech Seed, Yawn, Substitute, Perish Song, Disable, Taunt, Torment
		p1: team(['Gliscor', 'Toxic Orb', 'Poison Heal', ['Substitute', 'Encore', 'Taunt', 'Leech Seed']], filler),
		p2: team(['Clefable', 'Leftovers', 'Unaware', ['Yawn', 'Perish Song', 'Disable', 'Torment']], filler),
		steps: [P, S('move 4', 'move 1'), S('move 1', 'move 2'), S('move 3', 'move 3'), S('move 3', 'move 4'), S('move 2', 'move 4')] },
	{ name: 'partial-trap-wish',
		p1: team(['Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Wish', 'Protect', 'Salt Cure']], filler),
		p2: team(['Clefable', 'Leftovers', 'Magic Guard', ['Wish', 'Protect', 'Moonblast', 'Whirlpool']], filler),
		steps: [P, S('move 1', 'move 3'), S('move 2', 'move 2'), S('move 3', 'move 3'), S('move 4', 'move 4'), S('move 3', 'move 4')] },
	{ name: 'pivot-drag', // Volt Switch, U-turn, Roar, Dragon Tail, Red Card, Eject Button
		p1: team(['Scizor', 'Leftovers', 'Technician', ['U-turn', 'Pursuit', 'Protect', 'Bullet Punch']], ['Tyranitar', 'Eject Button', 'Sand Stream', ['Pursuit', 'Protect', 'Roar', 'Dragon Tail']], filler),
		p2: team(['Zapdos', 'Red Card', 'Static', ['Volt Switch', 'Roost', 'Protect', 'Heat Wave']], ['Gengar', 'Eject Pack', 'Cursed Body', ['Shadow Ball', 'Protect']], wall),
		steps: [P, S('move 2', 'move 1'), S('move 1', null), S(null, 'move 1'), S(null, 'switch 2'), S('move 1', 'move 2')] },
	{ name: 'emergency-exit-wimp',
		p1: team(['Golisopod', 'Leftovers', 'Emergency Exit', ['Protect', 'First Impression']], filler),
		p2: team(['Gengar', 'Eject Pack', 'Cursed Body', ['Shadow Ball', 'Protect', 'Sludge Bomb']], ['Wimpod', 'Leftovers', 'Wimp Out', ['Protect', 'Sticky Web']], filler),
		steps: [P, S('move 1', 'move 3'), S('move 2', 'move 1'), S('move 2', 'move 1')] },
	{ name: 'illusion-vs-imposter', // the hit breaks Zoroark's Illusion, then Ditto enters and copies it
		p1: team(['Zoroark-Hisui', 'Focus Sash', 'Illusion', ['Nasty Plot', 'Bitter Malice', 'Hyper Voice', 'Protect']], filler, ['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']], ['Ditto', 'Leftovers', 'Imposter', ['Transform']]),
		steps: [P, S('move 1', 'move 1'), S('move 1', 'switch 2'), S('move 2', 'move 2'), S('move 2', 'move 1')] },
	{ name: 'mimic-sketch',
		p1: team(['Smeargle', 'Leftovers', 'Own Tempo', ['Sketch', 'Protect']], ['Mew', 'Leftovers', 'Synchronize', ['Mimic', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Roost', 'Protect', 'Earthquake', 'Dragon Claw']], wall),
		steps: [P, S('move 2', 'move 2'), S('move 1', 'move 1'), S('switch 2', 'move 1'), S('move 1', 'move 1'), S('move 1', 'move 2')] },
    { name: 'boost-tricks', // Psych Up, Heart Swap, Topsy-Turvy, Haze, Belly Drum, Clear Smog, Spectral Thief
		p1: team(['Mew', 'Leftovers', 'Synchronize', ['Swords Dance', 'Psych Up', 'Heart Swap', 'Haze']], filler),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Swords Dance', 'Belly Drum', 'Topsy-Turvy', 'Clear Smog']], filler),
		steps: [P, S('move 1', 'move 1'), S('move 2', 'move 1'), S('move 3', 'move 3'), S('move 3', 'move 2'), S('move 4', 'move 1'), S('move 1', 'move 4')] },
	{ name: 'formes', // Aegislash, Mimikyu, Palafin, Meloetta, Minior, Morpeko, Castform, Eiscue
		p1: team(['Aegislash', 'Leftovers', 'Stance Change', ['King\'s Shield', 'Shadow Ball', 'Protect', 'Sacred Sword']], ['Mimikyu', 'Leftovers', 'Disguise', ['Shadow Sneak', 'Protect']], ['Palafin', 'Leftovers', 'Zero to Hero', ['Flip Turn', 'Protect']], ['Meloetta', 'Leftovers', 'Serene Grace', ['Relic Song', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']], filler),
		steps: [P, S('move 1', 'move 2'), S('move 2', 'move 2'), S('move 4', 'move 2'), S('switch 2', 'move 2'), S('move 1', 'move 1'), S('switch 3', 'move 2'), S('move 1', 'move 2'), S('switch 4', 'move 2'), S('move 1', 'move 2')] },
	{ name: 'tera-types', // Tera on offence, Tera Blast, Terastal Shell
		p1: team(['Dragapult', 'Leftovers', 'Clear Body', ['Shadow Ball', 'Tera Blast', 'Protect', 'Dragon Darts'], 'Tera Type: Fairy'], filler),
		p2: team(['Gholdengo', 'Leftovers', 'Good as Gold', ['Make It Rain', 'Protect', 'Nasty Plot', 'Shadow Ball'], 'Tera Type: Steel'], filler),
		steps: [P, S('move 2', 'move 2'), S('move 2', 'move 3')] },
	{ name: 'misc-events', // Pain Split, Endeavor, Sleep Talk/Rest, Substitute break, Focus Sash, berries, Air Balloon, Memento, Destiny Bond
		p1: team(['Slowbro', 'Air Balloon', 'Regenerator', ['Pain Split', 'Rest', 'Protect', 'Surf']], filler),
		p2: team(['Garchomp', 'Sitrus Berry', 'Rough Skin', ['Earthquake', 'Protect', 'Flamethrower', 'Dragon Claw']], wall),
		steps: [P, S('move 4', 'move 3'), S('move 1', 'move 1'), S('move 2', 'move 3'), S('move 2', 'move 4')] },
	{ name: 'nicknames', // nicknames with colon, comma, unicode, pipe-free punctuation
		p1: team(['Dr. Ev1l: ñ☃ p2a: (Gengar)', 'Leftovers', 'Cursed Body', ['Shadow Ball', 'Protect', 'Will-O-Wisp', 'Taunt']], ['Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']], wall),
		steps: [P, S('move 1', 'move 1'), S('move 3', 'move 2'), S('switch 2', 'move 3')] },
	{ name: 'items-berries', // Sitrus, Weakness Policy, Booster Energy, Air Balloon, Focus Sash, Life Orb, Rocky Helmet, Choice lock
		p1: team(['Iron Valiant', 'Booster Energy', 'Quark Drive', ['Close Combat', 'Protect', 'Swords Dance', 'Knock Off']], ['Garchomp', 'Focus Sash', 'Rough Skin', ['Earthquake', 'Protect']]),
		p2: team(['Great Tusk', 'Sitrus Berry', 'Protosynthesis', ['Headlong Rush', 'Protect', 'Rapid Spin', 'Ice Spinner']], ['Heatran', 'Air Balloon', 'Flash Fire', ['Magma Storm', 'Protect']], ['Blissey', 'Rocky Helmet', 'Natural Cure', ['Seismic Toss', 'Protect', 'Soft-Boiled']]),
		steps: [P, S('move 1', 'move 1'), S('move 3', 'move 2'), S('move 4', 'switch 2'), S('move 4', 'move 1'), S('move 1', 'switch 3'), S('move 1', 'move 1')] },
	{ name: 'urshifu-preview', // Urshifu-* resolves at switch-in; Zygarde and Greninja forms
		p1: team(['Urshifu-Rapid-Strike', 'Choice Band', 'Unseen Fist', ['Surging Strikes', 'Close Combat']], ['Greninja-Bond', 'Leftovers', 'Battle Bond', ['Water Shuriken', 'Protect']], ['Zygarde', 'Leftovers', 'Power Construct', ['Protect', 'Thousand Arrows']]),
		p2: team(['Tyranitar', 'Leftovers', 'Sand Stream', ['Protect', 'Crunch']], ['Urshifu', 'Leftovers', 'Unseen Fist', ['Wicked Blow', 'Protect']], ['Ursaluna-Bloodmoon', 'Leftovers', 'Mind\'s Eye', ['Blood Moon', 'Protect']]),
		steps: [P, S('move 1', 'move 1'), S('switch 2', 'switch 2'), S('move 1', 'move 1'), S('switch 3', 'switch 3'), S('move 2', 'move 2')] },
	{ name: 'weather-terrain', // Sand Stream, Orichalcum Pulse, Hadron Engine, Trick Room, Tailwind, screens
		p1: team(['Koraidon', 'Leftovers', 'Orichalcum Pulse', ['Protect', 'Tailwind', 'Aurora Veil', 'Trick Room']], ['Miraidon', 'Leftovers', 'Hadron Engine', ['Protect', 'Light Screen', 'Reflect']]),
		p2: team(['Tyranitar', 'Leftovers', 'Sand Stream', ['Protect', 'Crunch', 'Rain Dance', 'Safeguard']], filler),
		steps: [P, S('move 2', 'move 3'), S('move 4', 'move 4'), S('switch 2', 'move 1'), S('move 2', 'move 1')] },
	{ name: 'type-changes', // Libero, Soak, Reflect Type, Burn Up, Roost, Forest's Curse, Trick-or-Treat
		p1: team(['Cinderace', 'Leftovers', 'Libero', ['Pyro Ball', 'Protect', 'Gunk Shot', 'Sucker Punch']], ['Moltres', 'Leftovers', 'Flame Body', ['Burn Up', 'Protect', 'Roost']], ['Mew', 'Leftovers', 'Synchronize', ['Forest\'s Curse', 'Trick-or-Treat', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Roost', 'Protect', 'Soak', 'Reflect Type']], ['Skarmory', 'Leftovers', 'Sturdy', ['Roost', 'Protect', 'Iron Head']]),
		steps: [P, S('move 1', 'move 3'), S('move 2', 'move 4'), S('switch 2', 'move 3'), S('move 1', 'move 4'), S('move 3', 'switch 2'), S('switch 3', 'move 1'), S('move 1', 'move 1'), S('move 2', 'move 2')] },
	{ name: 'wish-real', // plain Wish: pending, then heals
		p1: team(['Clefable', 'Leftovers', 'Magic Guard', ['Wish', 'Protect', 'Seismic Toss', 'Soft-Boiled']], ['Blissey', 'Leftovers', 'Natural Cure', ['Soft-Boiled', 'Seismic Toss', 'Toxic', 'Protect']]),
		p2: team(['Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake', 'Protect', 'Roost', 'Dragon Claw']], wall),
		steps: [P, S('move 3', 'move 1'), S('move 1', 'move 1'), S('switch 2', 'move 1'), S('move 4', 'move 2'), S('move 2', 'move 2')] },
];
