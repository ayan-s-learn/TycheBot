// Plays 200 random-player games between v1 pool teams. Counts games ending in a win or tie, and every error the
// sim sends a player (an [Unavailable choice] is retried; any other rejects the game). Exits 1 unless all 200
// end with no error. Usage, from the root: node tasks/T12-pool-v1/smoke-battles.ts [teams.jsonl, default v1's]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type AI = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/random-player-ai.js');
const require = createRequire(import.meta.url);
const sim = '../../vendor/pokemon-showdown/dist/sim/';
const { BattleStream, getPlayerStreams }: PS = require(`${sim}index.js`);
const { RandomPlayerAI }: AI = require(`${sim}tools/random-player-ai.js`);

const GAMES = 200;
const teams: { id: string, team: string }[] = readFileSync(process.argv[2] ?? new URL('../../data/pool/v1/teams.jsonl', import.meta.url), 'utf8')
	.split('\n').filter(Boolean).map(l => JSON.parse(l));
const errors: string[] = [];
class Player extends RandomPlayerAI {
	override receiveError(error: Error) {
		errors.push(error.message);
		super.receiveError(error);
	}
}

let ended = 0;
for (let g = 0; g < GAMES; g++) {
	const [a, b] = [teams[g % teams.length], teams[(g * 7 + 3) % teams.length]];
	const streams = getPlayerStreams(new BattleStream());
	const players = [new Player(streams.p1, { seed: `${g},1,2,3` }), new Player(streams.p2, { seed: `${g},4,5,6` })];
	let log = '';
	const read = (async () => { for await (const chunk of streams.omniscient) log += chunk; })();
	void streams.omniscient.write(`>start {"formatid":"gen9nationaldex","seed":[${g},7,8,9]}\n` +
		`>player p1 ${JSON.stringify({ name: 'a', team: a.team })}\n>player p2 ${JSON.stringify({ name: 'b', team: b.team })}`);
	try {
		await Promise.all([...players.map(p => p.start()), read]);
	} catch (e) {
		errors.push(`${a.id} vs ${b.id}: ${e}`);
	}
	if (/\n\|(win|tie)\b/.test(log)) ended++;
}
console.log(`${ended}/${GAMES} games ended in a win or tie; ${errors.length} errors sent to players`);
for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
if (ended !== GAMES || errors.length) process.exitCode = 1;
