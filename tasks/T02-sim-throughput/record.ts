// Recorder: plays seeded games between Showdown's RandomPlayerAIs (Battle driven directly) and writes one
// JSON line per game, with each player's chunks in the order that player receives them (protocol lines,
// |request| JSON, |error|), the result, and Showdown's input log, which replays the game exactly.
// Game g is recorderGame(g): p1 plays team g mod 26 of [teams/illusion.txt, ...teams/pool.jsonl], p2 a
// seeded draw from the same list.
// Usage: node record.ts <out.jsonl> [ids=0-9]   (ids: comma-separated ids and ranges, e.g. 0-10,15)
import { statSync, writeFileSync } from 'node:fs';
import { direct, freezeClock, play, recorderGame, recorderTeams, FORMAT, PIN } from './sim.ts';

const [out, spec = '0-9'] = process.argv.slice(2);
const ids = spec.split(',').flatMap(part => {
	const [a, b = a] = part.split('-').map(Number);
	return Array.from({ length: b - a + 1 }, (_, i) => a + i);
});
freezeClock();
const teams = recorderTeams();

const lines: string[] = [];
const count = { turns: 0, mega: 0, zmove: 0, illusionEnds: 0, hiddenFormes: 0, formeReveals: 0 };
await play(direct, ids.map(id => recorderGame(id, teams)).values(), {
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
		// A forme shown as `Species-*` at Team Preview, and the formes those species switch in as.
		const hidden = p1.filter(l => l.startsWith('|poke|') && l.includes('-*'))
			.map(l => { const [, , side, details] = l.split('|'); return `${side}|${details.split('-*')[0]}-`; });
		count.hiddenFormes += hidden.length;
		const revealed = new Set(p1.filter(l => l.startsWith('|switch|') || l.startsWith('|drag|')).map(l => {
			const [, , who, details] = l.split('|');
			return `${who.slice(0, 2)}|${details.split(',')[0]}`;
		}).filter(s => hidden.some(h => s.startsWith(h))));
		count.formeReveals += revealed.size;
	},
});
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${out}: ${lines.length} games, ${(statSync(out).size / 1e6).toFixed(2)} MB; ` +
	`${count.turns} turns, ${count.mega} mega evolutions, ${count.zmove} z-moves, ` +
	`${count.illusionEnds} illusions broken, ${count.hiddenFormes} team preview formes shown as -*, ` +
	`${count.formeReveals} of them switching in as a named forme`);
