// Checks that both drivers play the same games, with the clock frozen. For each game, compares each
// player's chunks (protocol lines, requests, errors), the winner, the turn count and the input log:
//   - Battle direct and BattleStream, each with 16 battles interleaved and with one at a time;
//   - Showdown's own split, getPlayerStreams over a BattleStream, as the reference.
// Usage: node check.ts [games=200] [first=0]   (exit code 1 on any difference)
import { createHash } from 'node:crypto';
import {
	direct, stream, freezeClock, gameIds, getPlayerStreams, loadPool, play, BattleStream, Player, SIDES, FORMAT,
	type Driver, type Ended, type Game,
} from './sim.ts';

const [games = 200, first = 0] = process.argv.slice(2).map(Number);
freezeClock();
const pool = loadPool();
const digest = (chunks: string[][], winner: string | undefined, turns: number, inputLog: string[]) =>
	createHash('sha256').update(JSON.stringify([chunks, winner, turns, inputLog])).digest('hex');

const counts = { turns: 0, decisions: 0, unavailable: 0, mega: 0, zmove: 0 };
async function run(driver: Driver<any>, concurrency: number, tally = false) {
	const out = new Map<number, string>();
	const onEnd = ({ game, battle, chunks }: Ended) => {
		out.set(game.id, digest(chunks, battle.winner, battle.turn, battle.inputLog));
		if (!tally) return;
		const lines = chunks.flat().join('\n').split('\n');
		counts.unavailable += lines.filter(l => l.startsWith('|error|[Unavailable choice]')).length;
		counts.mega += lines.filter(l => l.startsWith('|-mega|')).length / 2; // public: once per player
		counts.zmove += lines.filter(l => l.startsWith('|-zpower|')).length / 2;
	};
	const stats = await play(driver, gameIds(first, pool, games), { concurrency, onEnd });
	if (tally) Object.assign(counts, { turns: stats.turns, decisions: stats.decisions });
	return out;
}

/** One game through getPlayerStreams, each player answering its own stream's requests. */
async function reference(game: Game) {
	const s = new BattleStream();
	const streams = getPlayerStreams(s);
	const chunks: [string[], string[]] = [[], []];
	const answer = async (i: 0 | 1) => {
		const player = new Player(game.aiSeeds[i]);
		for await (const chunk of streams[SIDES[i]]) {
			chunks[i].push(chunk);
			if (!chunk.startsWith('|request|')) continue;
			const choice = player.answer(chunk.slice(9));
			if (choice !== null) void streams[SIDES[i]].write(choice);
		}
	};
	const done = Promise.all([answer(0), answer(1), streams.omniscient.readAll()]);
	void streams.omniscient.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: game.seed })}\n` +
		`>player p1 ${JSON.stringify({ name: 'Bot 1', team: game.teams[0] })}\n` +
		`>player p2 ${JSON.stringify({ name: 'Bot 2', team: game.teams[1] })}`);
	await done;
	return digest(chunks, s.battle!.winner, s.battle!.turn, s.battle!.inputLog);
}

const base = await run(direct, 16, true);
const variants: [string, Map<number, string>][] = [
	['direct, 1 at a time', await run(direct, 1)],
	['stream, 16 interleaved', await run(stream, 16)],
	['stream, 1 at a time', await run(stream, 1)],
];
const ref = new Map<number, string>();
for (const game of gameIds(first, pool, games)) ref.set(game.id, await reference(game));
variants.push(['getPlayerStreams', ref]);

let failures = 0;
for (const [label, result] of variants) {
	const differ = [...base.keys()].filter(id => result.get(id) !== base.get(id));
	failures += differ.length + Math.abs(result.size - base.size);
	console.log(`${label}: ${result.size} games, ${differ.length ? `differ from direct in ${differ.join(', ')}` :
		'all match direct, 16 interleaved'}`);
}
console.log(`games ${first}..${first + games - 1}: ${counts.turns} turns, ${counts.decisions} decisions, ` +
	`${counts.unavailable} [Unavailable choice] errors, ${counts.mega} mega evolutions, ${counts.zmove} z-moves`);
process.exit(failures ? 1 : 0);
