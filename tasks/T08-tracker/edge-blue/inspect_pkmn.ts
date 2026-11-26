// Final tracked state of each side's mons in @pkmn/client, for the fields a calc needs. Usage: node inspect_pkmn.ts <scenario>
import { readFileSync } from 'node:fs';
import { Battle } from '@pkmn/client';
import { generations } from '../pkmn.ts';
const name = process.argv[2];
const gens = generations('natdex');
const g = readFileSync('out/games.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l)).find(x => x.name === name);
for (const side of ['p1', 'p2'] as const) {
	const b = new Battle(gens, side as any);
	for (const chunk of g[side] as string[]) {
		if (chunk.startsWith('|error|')) continue;
		for (const l of chunk.split('\n')) if (l.startsWith('|')) b.add(l);
	}
	console.log('== pkmn as', side);
	for (const s of [b[side], b[side].foe]) for (const p of s.team) {
		console.log(s === b[side] ? 'own' : 'opp', p.name, JSON.stringify({ species: p.speciesForme, types: p.types, item: p.item, lastItem: p.lastItem, ability: p.ability, baseAbility: p.baseAbility, hp: p.hp, maxhp: p.maxhp, status: p.status, moves: p.moveSlots.map(m => m.id), boosts: p.boosts, tera: p.teraType, terad: p.terastallized, stats: p.stats, level: p.level, active: s.active.includes(p), vol: Object.keys(p.volatiles) }));
	}
	console.log('side conds', JSON.stringify(b[side].sideConditions), JSON.stringify(b[side].foe.sideConditions), 'field', b.field.weather, b.field.terrain, JSON.stringify(Object.keys(b.field.pseudoWeather)));
}
