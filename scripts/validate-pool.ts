// Validates every team in a pool file with Showdown's validator at the commit in showdown.pin.
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
const { Teams, TeamValidator }: PS = require(path('vendor/pokemon-showdown/dist/sim/index.js'));
const validator = TeamValidator.get(FORMAT);

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
		const sets = typeof team === 'string' ? Teams.unpack(team) : null;
		problems = sets ? validator.validateTeam(sets) : ['"team" is not a packed team'];
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
