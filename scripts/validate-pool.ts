// Validates every team in a pool file with Showdown's validator at the commit in showdown.pin.
// A team also fails unless it is 6 Pokemon in canonical packed form, and validation leaves its species,
// items, abilities, moves, and any gender, nature, Hidden Power type or nickname as written.
// Usage: node scripts/validate-pool.ts data/pool/<ver>/teams.jsonl
// Exits 1 if any team fails, naming each one.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

type PS = typeof import('../vendor/pokemon-showdown/dist/sim/index.js');

const FORMAT = 'gen9nationaldex';
const path = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/validate-pool.ts <teams.jsonl>');

// A checkout left at an old pin would validate against old rules without complaint.
const pin = readFileSync(path('showdown.pin'), 'utf8').trim();
const head = execFileSync('git', ['-C', path('vendor/pokemon-showdown'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== pin) {
	throw new Error(`vendor/pokemon-showdown is at ${head}, but showdown.pin says ${pin}: run scripts/setup-showdown.sh`);
}

const require = createRequire(import.meta.url);
const { Teams, TeamValidator, toID }: PS = require(path('vendor/pokemon-showdown/dist/sim/index.js'));
const validator = TeamValidator.get(FORMAT);

function check(team: unknown): string[] | null {
	// unpack also takes JSON and silently drops or coerces malformed fields, so require a clean round trip.
	const sets = typeof team === 'string' ? Teams.unpack(team) : null;
	if (!sets || Teams.pack(sets) !== team) return ['"team" is not a canonical packed team'];
	if (sets.length !== 6) return [`a pool team has 6 Pokemon, this one has ${sets.length}`];
	const problems = validator.validateTeam(sets);
	if (problems) return problems;
	// validateTeam repairs some illegal sets in place and passes them, but the sim plays the string as written.
	const changes = Teams.unpack(team)!.flatMap((written, i) => {
		const kept = sets[i];
		const ids = (value: string | string[]) => String([value].flat().map(toID));
		const changed = [
			// Compared by id, because unpacking respells some names ("Kings Rock" for "King's Rock").
			...(['species', 'item', 'ability', 'moves'] as const).filter(key => ids(written[key]) !== ids(kept[key])),
			// Compared exactly when set (unset ones are legally filled in): an hpType of "ice" crashes the sim.
			...(['gender', 'nature', 'hpType'] as const).filter(key => written[key] && written[key] !== kept[key]),
		] as (keyof typeof written)[];
		// A name equal to the species means no nickname, and the sim shortens it as the server would.
		if (written.name !== written.species && written.name !== kept.name) changed.push('name');
		return changed.map(key => `${written.species}: the validator changes ${key} "${written[key]}" to "${kept[key]}"`);
	});
	return changes.length ? changes : null;
}

let teams = 0;
let failed = 0;
for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
	if (!line.trim()) continue;
	teams++;
	let label = `line ${i + 1}`;
	let problems: string[] | null;
	try {
		const { id, team, source } = JSON.parse(line);
		label = `${id} (line ${i + 1}${source?.name ? `, "${source.name}"` : ''})`;
		problems = check(team);
	} catch (e) {
		problems = [String(e)];
	}
	if (problems) {
		failed++;
		console.error(`FAIL ${label}:\n${problems.map(p => `  ${p}`).join('\n')}`);
	}
}
if (!teams) throw new Error(`${file} has no teams`);
console.log(`${teams - failed}/${teams} teams valid for ${FORMAT} at Showdown ${pin}`);
if (failed) process.exitCode = 1;
