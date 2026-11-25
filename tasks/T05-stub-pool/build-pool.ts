// Writes data/pool/v0/teams.jsonl: the first 20 teams in the Smogon sample-team snapshot
// (evidence/sample-teams.json) that validate at the pin. Reports every team that fails.
// Usage, from the repo root: node tasks/T05-stub-pool/build-pool.ts [output file]
import { deepStrictEqual } from 'node:assert';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type Stats = Partial<StatsTable>;
interface Source {
	name?: string;
	author?: string;
	data: {
		species: string, item: string, ability: string, moves: string[], nature: string, gender?: GenderName,
		evs?: Stats, ivs?: Stats, shiny?: boolean, level?: number, happiness?: number, hpType?: string,
	}[];
}

const SOURCE_URL = 'https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json';
const SIZE = 20;

const require = createRequire(import.meta.url);
const { Teams, TeamValidator }: PS = require('../../vendor/pokemon-showdown/dist/sim/index.js');
const validator = TeamValidator.get('gen9nationaldex');
const snapshot: Source[] = JSON.parse(readFileSync(new URL('evidence/sample-teams.json', import.meta.url), 'utf8'));

const stats = (given: Stats | undefined, fill: number): StatsTable =>
	({ hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill, ...given });

// Every field a source set can carry, with Showdown's default where it is absent.
const fields = (s: Source['data'][number]) => ({
	species: s.species, item: s.item, ability: s.ability, moves: s.moves, nature: s.nature,
	gender: s.gender || '', evs: stats(s.evs, 0), ivs: stats(s.ivs, 31), shiny: !!s.shiny,
	level: s.level || 100, happiness: s.happiness ?? 255, hpType: s.hpType || '',
});
const known = new Set(Object.keys(fields(snapshot[0].data[0])));

const lines: string[] = [];
let failed = 0;
for (const [entry, { name, author, data }] of snapshot.entries()) {
	for (const key of data.flatMap(Object.keys)) {
		if (!known.has(key)) throw new Error(`entry ${entry}: unhandled set field ${key}`);
	}
	const packed = Teams.pack(data.map(s => ({
		...s, name: s.species, gender: s.gender || '', evs: stats(s.evs, 0), ivs: stats(s.ivs, 31),
		level: s.level || 100,
	})));
	// Packing must lose nothing. Checked before validation, which edits the sets it is given.
	deepStrictEqual(Teams.unpack(packed)!.map(s => fields(s as Source['data'][number])), data.map(fields), `entry ${entry}`);
	const problems = validator.validateTeam(Teams.unpack(packed));
	if (problems) {
		failed++;
		console.log(`entry ${entry} (${name}) fails:\n  ${problems.join('\n  ')}`);
	} else if (lines.length < SIZE) {
		lines.push(JSON.stringify({
			id: `smogon-sample-${String(entry).padStart(2, '0')}`,
			team: packed,
			source: { url: SOURCE_URL, entry, name: name ?? null, author: author ?? null, date: null },
		}));
	}
}
console.log(`${snapshot.length} sample teams, ${failed} failed validation, ${lines.length} taken`);
if (lines.length < SIZE) throw new Error(`only ${lines.length} teams validate, need ${SIZE}`);
const out = process.argv[2] ?? new URL('../../data/pool/v0/teams.jsonl', import.meta.url);
writeFileSync(out, lines.map(l => l + '\n').join(''));
