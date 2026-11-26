// Scripted scenarios: drives the sim's Battle with fixed seeds and chosen inputs, and writes files in the
// formats T08's compare.py reads: out/games.jsonl (chunks per player), out/truth.jsonl (sim state at each decision).
// Usage: node gen.ts [name...]   (all scenarios if none)
import { writeFileSync, mkdirSync } from 'node:fs';
import { Battle, Collector, freezeClock, Teams, FORMAT } from '../sim.ts';
import { snapshot } from '../truth.ts';
import { scenarios } from './scenarios.ts';

freezeClock();
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const want = process.argv.slice(2);
const games: string[] = [], truths: string[] = [], meta: any[] = [];
let id = 0;
for (const sc of scenarios) {
	if (want.length && !want.includes(sc.name)) continue;
	const out = new Collector();
	const decisions: any[] = [];
	const errors: string[] = [];
	const battle = new Battle({
		formatid: sc.format ?? FORMAT, seed: `sodium,${(sc.seed ?? 1).toString(16).padStart(64, '0')}` as any,
		send: (type, data) => {
			const text = Array.isArray(data) ? data.join('\n') : data;
			out.receive(type, text);
			if (type !== 'sideupdate') return;
			if (text.slice(3).startsWith('|error|')) errors.push(text);
			if (!text.slice(3).startsWith('|request|')) return;
			if (JSON.parse(text.slice(12)).wait) return;
			const side = text.slice(0, 2);
			decisions.push({ side, chunk: out.chunks[side === 'p1' ? 0 : 1].length, state: snapshot(battle) });
		},
	});
	battle.setPlayer('p1', { name: 'Bot 1', team: Teams.pack(Teams.import(sc.p1)) });
	battle.setPlayer('p2', { name: 'Bot 2', team: Teams.pack(Teams.import(sc.p2)) });
	battle.sendUpdates();
	const inputs: string[] = [];
	for (const [a, b] of sc.steps) {
		for (const [side, c] of [['p1', a], ['p2', b]] as const) {
			if (!c) continue;
			inputs.push(`${side} ${c}`);
			battle.choose(side, c);
		}
		battle.sendUpdates();
		if (battle.ended) break;
	}
	games.push(JSON.stringify({ game: id, name: sc.name, p1: out.chunks[0], p2: out.chunks[1], inputLog: inputs }));
	truths.push(JSON.stringify({ game: id, decisions }));
	meta.push({ game: id, name: sc.name, errors, ended: battle.ended, final: battle.sides.map(sd => sd.pokemon.filter(p => p.isActive || true).map(p => ({
		name: p.name, active: p.isActive, species: p.species.name, types: p.getTypes(), item: p.item, ability: p.ability, hp: p.hp, maxhp: p.maxhp,
		status: p.status, stats: p.storedStats, base: p.species.baseStats, moves: p.moveSlots.map(m => m.id), boosts: p.boosts, tera: p.teraType, volatiles: Object.keys(p.volatiles) }))) });
	id++;
}
const dir = new URL('./out/', import.meta.url).pathname;
writeFileSync(dir + 'games.jsonl', games.join('\n') + '\n');
writeFileSync(dir + 'truth.jsonl', truths.join('\n') + '\n');
writeFileSync(dir + 'meta.json', JSON.stringify(meta, null, 1));
console.log(meta.map(m => `${m.game} ${m.name}${m.errors.length ? ' ERRORS:' + m.errors.join(' / ').replace(/\n/g, ' ') : ''}`).join('\n'));
