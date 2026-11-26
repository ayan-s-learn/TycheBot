// Stage 1, data lag: how far each tracker's data is from Showdown's at the pin, on the NatDex legal set
// (gen 9 entries that exist with isNonstandard unset, Past or Unobtainable, as Standard NatDex allows).
// Counts entries each tracker lacks and entries whose compared fields differ, with examples.
// Usage: node datalag.ts <poke-env static data dir>
import { readFileSync } from 'node:fs';
import { Dex as SimDex } from './sim.ts';
import { toID } from '@pkmn/data';
import { generations } from './pkmn.ts';

const [pokeEnvDir] = process.argv.slice(2);
const sim = SimDex.forFormat('gen9nationaldex');
const pkmn = generations('natdex').get(9);
const pokeEnv = {
	species: JSON.parse(readFileSync(`${pokeEnvDir}/pokedex/gen9pokedex.json`, 'utf8')),
	moves: JSON.parse(readFileSync(`${pokeEnvDir}/moves/gen9moves.json`, 'utf8')),
};
// As poke-env's GenData.load_pokedex does: cosmetic formes resolve to their base species' entry.
for (const d of Object.values<any>(pokeEnv.species)) {
	for (const f of d.cosmeticFormes ?? []) pokeEnv.species[toID(f)] = d;
}

const LEGAL = new Set([undefined, null, 'Past', 'Unobtainable']);
const legal = (d: any) => d.exists && LEGAL.has(d.isNonstandard);
const pick = (d: any, keys: string[]) => JSON.stringify(keys.map(k => {
	const v = d?.[k];
	return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v;
}));
const FIELDS = {
	species: ['baseStats', 'types', 'abilities'],
	moves: ['basePower', 'type', 'category', 'accuracy', 'priority', 'pp'],
	items: ['name'],
	abilities: ['name'],
};

type Kind = keyof typeof FIELDS;
const all: Record<Kind, any[]> = {
	species: sim.species.all().filter(legal),
	moves: sim.moves.all().filter(legal),
	items: sim.items.all().filter(legal),
	abilities: sim.abilities.all().filter(d => legal(d) && d.id !== 'noability'),
};

const report: Record<string, unknown> = {};
for (const kind of Object.keys(FIELDS) as Kind[]) {
	const fields = FIELDS[kind];
	const row: Record<string, unknown> = { legal: all[kind].length };
	for (const tracker of ['@pkmn/dex', 'poke-env'] as const) {
		if (tracker === 'poke-env' && !(kind in pokeEnv)) {
			row[tracker] = 'no data (stores ids only)';
			continue;
		}
		const missing: string[] = [], differ: string[] = [];
		for (const d of all[kind]) {
			// Hidden Power's typed variants share the id hiddenpower; their names tell them apart.
			const id = toID(d.name);
			const other = tracker === '@pkmn/dex' ? (pkmn as any)[kind].get(id) : (pokeEnv as any)[kind][id];
			if (!other) missing.push(id);
			else if (pick(d, fields) !== pick(other, fields)) differ.push(`${id}: ${pick(d, fields)} vs ${pick(other, fields)}`);
		}
		row[tracker] = { missing: missing.length, differ: differ.length, missingEx: missing.slice(0, 8), differEx: differ.slice(0, 5) };
	}
	report[kind] = row;
}
console.log(JSON.stringify(report, null, 1));
