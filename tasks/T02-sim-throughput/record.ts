// Recorder: plays seeded games between Showdown's RandomPlayerAIs (Battle driven directly) and writes one
// JSON line per game, with each player's chunks in the order that player receives them (protocol lines,
// |request| JSON, |error|), the result, and Showdown's input log, which replays the game exactly.
// Game g: p1 plays team g mod T of [teams/illusion.txt, ...teams/pool.jsonl], p2 a seeded draw from it.
// Usage: node record.ts <out.jsonl> [games=10] [first=0]
import { statSync, writeFileSync } from 'node:fs';
import { direct, freezeClock, illusionTeam, loadPool, makeGame, play, FORMAT, PIN } from './sim.ts';

const [out, games = '10', first = '0'] = process.argv.slice(2);
freezeClock();
const teams = [illusionTeam(), ...loadPool()];
const ids = Array.from({ length: Number(games) }, (_, i) => Number(first) + i);

const lines: string[] = [];
const count = { turns: 0, mega: 0, zmove: 0, illusionEnds: 0, hiddenFormes: 0 };
await play(direct, ids.map(id => makeGame(id, teams, teams[id % teams.length])).values(), {
	concurrency: 1,
	onEnd({ game, battle, chunks }) {
		lines.push(JSON.stringify({
			game: game.id, format: FORMAT, pin: PIN, seed: game.seed, aiSeeds: game.aiSeeds,
			winner: battle.winner, turns: battle.turn, p1: chunks[0], p2: chunks[1], inputLog: battle.inputLog,
		}));
		// p1's view has every public line and its own side of each |split|, so count there.
		const p1 = chunks[0].join('\n').split('\n');
		count.turns += battle.turn;
		count.mega += p1.filter(l => l.startsWith('|-mega|')).length;
		count.zmove += p1.filter(l => l.startsWith('|-zpower|')).length;
		count.illusionEnds += p1.filter(l => l.startsWith('|-end|') && l.endsWith('|Illusion')).length;
		count.hiddenFormes += p1.filter(l => l.startsWith('|poke|') && l.includes('-*')).length;
	},
});
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${out}: ${lines.length} games, ${(statSync(out).size / 2 ** 20).toFixed(2)} MiB; ` +
	`${count.turns} turns, ${count.mega} mega evolutions, ${count.zmove} z-moves, ` +
	`${count.illusionEnds} illusions broken, ${count.hiddenFormes} team preview formes shown as -*`);
