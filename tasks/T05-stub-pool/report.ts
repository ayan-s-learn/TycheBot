// Counts a pool file's species, Mega Stones, Z-Crystals and Team-Preview-hidden formes, and checks
// the brief's contents criteria: 20 distinct teams with at least one of each of the last three.
// Usage, from the repo root: node tasks/T05-stub-pool/report.ts data/pool/v0/teams.jsonl
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');

const require = createRequire(import.meta.url);
const { Battle, Dex, Teams }: PS = require('../../vendor/pokemon-showdown/dist/sim/index.js');
const FORMAT = 'gen9nationaldex' as ID;
const dex = Dex.forFormat(FORMAT);

const packed: string[] = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => JSON.parse(l).team);
const teams = packed.map(t => Teams.unpack(t)!);

type Counts = Map<string, number>;
const add = (counts: Counts, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
const table = (counts: Counts) =>
	[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(', ');
const total = (counts: Counts) => [...counts.values()].reduce((a, b) => a + b, 0);
const perTeam = (has: (item: string) => boolean) => {
	const counts: Counts = new Map();
	for (const team of teams) add(counts, `${team.filter(s => has(s.item)).length}`);
	return [...counts].sort().map(([n, t]) => `${t} teams with ${n}`).join(', ');
};

const species: Counts = new Map();
const megas: Counts = new Map();
const crystals: Counts = new Map();
const hidden: Counts = new Map();
const isMega = (item: string) => !!dex.items.get(item).megaStone;
const isZ = (item: string) => !!dex.items.get(item).zMove;
for (const [i, team] of teams.entries()) {
	for (const set of team) {
		add(species, set.species);
		if (isMega(set.item)) add(megas, set.item);
		if (isZ(set.item)) add(crystals, set.item);
	}
	// Ask the sim what Team Preview shows rather than keeping our own list of hidden formes.
	const battle = new Battle({ formatid: FORMAT, p1: { team: packed[i] }, p2: { team: packed[i] } });
	for (const line of battle.log) {
		const shown = /^\|poke\|p1\|([^,|]+-\*)/.exec(line)?.[1];
		if (shown) add(hidden, shown);
	}
}

// Order-insensitive, so a reshuffled copy of a team is not a second team.
const distinct = new Set(teams.map(t => t.map(s => Teams.pack([s])).sort().join(']'))).size;
const rosters = teams.map(t => new Set(t.map(s => s.species)));
let maxShared = 0;
for (const [i, a] of rosters.entries()) {
	for (const b of rosters.slice(i + 1)) maxShared = Math.max(maxShared, [...a].filter(s => b.has(s)).length);
}

console.log(`${teams.length} teams, ${distinct} distinct; most species two teams share: ${maxShared}`);
console.log(`Species (${species.size} distinct, ${total(species)} sets): ${table(species)}`);
console.log(`Mega Stones (${total(megas)}; ${perTeam(isMega)}): ${table(megas)}`);
console.log(`Z-Crystals (${total(crystals)}; ${perTeam(isZ)}): ${table(crystals)}`);
console.log(`Hidden at Team Preview (${total(hidden)}): ${table(hidden)}`);
if (teams.length !== 20 || distinct !== 20 || !megas.size || !crystals.size || !hidden.size) {
	console.error('FAIL: need 20 distinct teams with a Mega Stone, a Z-Crystal and a hidden forme');
	process.exitCode = 1;
}
