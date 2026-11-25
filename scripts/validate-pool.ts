// Validates every team in a pool file with Showdown's validator at the commit in showdown.pin.
// A team also fails unless it is 6 Pokemon in canonical packed form and validation leaves every value
// as written, apart from filling in some unset ones.
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

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const RESPELLED = new Set<string>(['species', 'item', 'ability', 'moves']);
// These have no fixed default, so the validator may fill an unset one in.
const FILLED_IN = new Set<string>(['gender', 'nature', 'hpType', 'teraType', 'pokeball', 'gigantamax', 'dynamaxLevel']);

// Every field of a set but its name, with the sim's default where a packed team leaves it out.
function read(set: PokemonSet) {
	const stats = (given: Partial<StatsTable> | undefined, fill: number) => STATS.map(s => given?.[s] ?? fill).join('/');
	return {
		// By id, because unpacking respells some names ("Kings Rock" for "King's Rock").
		species: toID(set.species), item: toID(set.item), ability: toID(set.ability), moves: set.moves.map(toID).join(),
		level: set.level || 100, evs: stats(set.evs, 0), ivs: stats(set.ivs, 31),
		shiny: !!set.shiny, happiness: set.happiness ?? 255,
		// Compared exactly: an hpType of "ice" passes the validator and crashes the sim.
		gender: set.gender, nature: set.nature, hpType: set.hpType, teraType: set.teraType, pokeball: set.pokeball,
		gigantamax: set.gigantamax, dynamaxLevel: set.dynamaxLevel,
	};
}

function check(team: unknown): string[] | null {
	// unpack also takes JSON and silently drops or coerces malformed fields, so require a clean round trip.
	const sets = typeof team === 'string' ? Teams.unpack(team) : null;
	if (!sets || Teams.pack(sets) !== team) return ['"team" is not a canonical packed team'];
	if (sets.length !== 6) return [`a pool team has 6 Pokemon, this one has ${sets.length}`];
	const problems = validator.validateTeam(sets);
	if (problems) return problems;
	// validateTeam repairs some illegal sets in place and passes them, but the sim plays the string as written.
	const changes = Teams.unpack(team)!.flatMap((written, i) => {
		const before = read(written);
		const after = read(sets[i]);
		const changed = (Object.keys(before) as (keyof typeof before)[])
			.filter(key => before[key] !== after[key] && !(FILLED_IN.has(key) && !before[key]))
			.map(key => {
				const [from, to] = RESPELLED.has(key) ? [written, sets[i]].map(s => s[key]) : [before[key], after[key]];
				return `${key} ${JSON.stringify(from)} to ${JSON.stringify(to)}`;
			});
		// A name equal to the species means no nickname, and the sim shortens it as the server would.
		if (written.name !== written.species && written.name !== sets[i].name) {
			changed.push(`name ${JSON.stringify(written.name)} to ${JSON.stringify(sets[i].name)}`);
		}
		return changed.map(change => `${written.species}: the validator changes ${change}`);
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
