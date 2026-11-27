// Plays random-player games and counts games ending in a win or tie, and every error the sim sends a player (an
// [Unavailable choice] is retried; any other rejects the game). A game not over within a minute fails.
// Exits 1 unless every game ends with no error. Usage, from the root:
//   node tasks/T12-pool-v1/smoke-battles.ts [teams.jsonl]   200 games between pool teams (default: v1's)
//   node tasks/T12-pool-v1/smoke-battles.ts --library       every library set, on teams of 6 species, 4 games each
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type AI = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/random-player-ai.js');
const require = createRequire(import.meta.url);
const sim = '../../vendor/pokemon-showdown/dist/sim/';
const { BattleStream, Teams, getPlayerStreams }: PS = require(`${sim}index.js`);
const { RandomPlayerAI }: AI = require(`${sim}tools/random-player-ai.js`);
const TIMEOUT_MS = 60_000;

let teams: { id: string, team: string }[];
let games: number;
if (process.argv[2] === '--library') {
	// Deal every set, in file order, into teams of 6 distinct species; a set that fits no open team starts one.
	const library: { species: Record<string, { set: string }[]> } =
		JSON.parse(readFileSync(new URL('../../data/priors/v0/species_sets.json', import.meta.url), 'utf8'));
	const open: { species: Set<string>, sets: string[] }[] = [];
	teams = [];
	for (const [species, sets] of Object.entries(library.species)) {
		for (const { set } of sets) {
			let team = open.find(t => !t.species.has(species));
			if (!team) open.push(team = { species: new Set(), sets: [] });
			team.species.add(species);
			team.sets.push(set);
			if (team.sets.length === 6) {
				open.splice(open.indexOf(team), 1);
				teams.push({ id: `library-${teams.length}`, team: team.sets.join(']') });
			}
		}
	}
	// Top up the unfilled teams from the first full one, keeping species distinct.
	const filler = Teams.unpack(teams[0].team)!;
	for (const t of open) {
		for (const s of filler) if (t.sets.length < 6 && !t.species.has(s.species)) { t.species.add(s.species); t.sets.push(Teams.pack([s])); }
		teams.push({ id: `library-${teams.length}`, team: t.sets.join(']') });
	}
	games = teams.length * 4;
} else {
	teams = readFileSync(process.argv[2] ?? new URL('../../data/pool/v1/teams.jsonl', import.meta.url), 'utf8')
		.split('\n').filter(Boolean).map(l => JSON.parse(l));
	games = 200;
}

const errors: string[] = [];
class Player extends RandomPlayerAI {
	override receiveError(error: Error) {
		errors.push(error.message);
		super.receiveError(error);
	}
}

let ended = 0;
for (let g = 0; g < games; g++) {
	const [a, b] = [teams[g % teams.length], teams[(g * 7 + 3) % teams.length]];
	const battle = new BattleStream();
	const streams = getPlayerStreams(battle);
	const players = [new Player(streams.p1, { seed: `${g},1,2,3` }), new Player(streams.p2, { seed: `${g},4,5,6` })];
	let log = '';
	const read = (async () => { for await (const chunk of streams.omniscient) log += chunk; })();
	void streams.omniscient.write(`>start {"formatid":"gen9nationaldex","seed":[${g},7,8,9]}\n` +
		`>player p1 ${JSON.stringify({ name: 'a', team: a.team })}\n>player p2 ${JSON.stringify({ name: 'b', team: b.team })}`);
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`not over in ${TIMEOUT_MS} ms`)), TIMEOUT_MS); });
	try {
		await Promise.race([Promise.all([...players.map(p => p.start()), read]), timeout]);
	} catch (e) {
		errors.push(`${a.id} vs ${b.id}: ${e}`);
		void battle.destroy();
	} finally {
		clearTimeout(timer);
	}
	if (/\n\|(win|tie)\b/.test(log)) ended++;
}
console.log(`${teams.length} teams; ${ended}/${games} games ended in a win or tie; ${errors.length} errors sent to players`);
for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
if (ended !== games || errors.length) process.exitCode = 1;
