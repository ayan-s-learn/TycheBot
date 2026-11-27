// Checks a set library against its pool: every set passes Showdown's validation for gen9nationaldex at the pin
// unrepaired (scripts/pool/showdown.ts, problems), every species on a training team has a set, and every set has a
// source other than a held-out team. Exits 1 on any failure, naming it.
// Usage: node scripts/pool/check-library.ts data/priors/v0/species_sets.json data/pool/v1
import { readFileSync } from 'node:fs';
import { PIN, Teams, dex, problems } from './showdown.ts';

const [libraryFile, poolDir] = process.argv.slice(2);
if (!libraryFile || !poolDir) throw new Error('usage: node scripts/pool/check-library.ts <species_sets.json> <pool dir>');
const library: { showdown: string, species: Record<string, { set: string, sources: string[] }[]> } =
	JSON.parse(readFileSync(libraryFile, 'utf8'));
const pool: { id: string, team: string }[] = readFileSync(`${poolDir}/teams.jsonl`, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const heldOut = new Set(readFileSync(`${poolDir}/holdout.txt`, 'utf8').split('\n').filter(Boolean));
const ids = new Set(pool.map(t => t.id));

const failures: string[] = [];
if (library.showdown !== PIN) failures.push(`library built at Showdown ${library.showdown}, pin is ${PIN}`);
for (const id of heldOut) if (!ids.has(id)) failures.push(`held-out ${id} is not in the pool`);
let sets = 0;
for (const [species, entries] of Object.entries(library.species)) {
	for (const { set, sources } of entries) {
		sets++;
		const found = problems(set, 1);
		if (found) failures.push(`${species} ${set}: ${found.join('; ')}`);
		if (dex.species.get(Teams.unpack(set)![0].species).name !== species) failures.push(`${set} is filed under ${species}`);
		const kept = sources.filter(s => s.startsWith('analysis:') || (s.startsWith('pool:') && ids.has(s.slice(5)) && !heldOut.has(s.slice(5))));
		if (!kept.length) failures.push(`${species} ${set}: no source but held-out or unknown teams (${sources.join(', ')})`);
		for (const s of sources) if (s.startsWith('pool:') && heldOut.has(s.slice(5))) failures.push(`${species} ${set}: comes from held-out ${s}`);
	}
}
const training = pool.filter(t => !heldOut.has(t.id));
for (const t of training) {
	for (const s of Teams.unpack(t.team)!) {
		const name = dex.species.get(s.species).name;
		if (!library.species[name]?.length) failures.push(`${name} (on ${t.id}) has no library set`);
	}
}
for (const f of failures) console.error(`FAIL ${f}`);
console.log(`${sets} sets over ${Object.keys(library.species).length} species; ${training.length} training and ${heldOut.size} held-out teams; ${failures.length} failures`);
if (failures.length) process.exitCode = 1;
