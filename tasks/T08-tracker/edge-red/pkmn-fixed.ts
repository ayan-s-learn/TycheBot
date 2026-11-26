// Same as ../pkmn.ts `games` mode, but with FixedBattle. Writes views in the same format for ../compare.py.
// Usage: node pkmn-fixed.ts <games.jsonl> <views.jsonl>
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { generations, view } from '../pkmn.ts';
import { FixedBattle } from './layer.ts';

const gens = generations('natdex');
const [input, output] = process.argv.slice(2);
const out = createWriteStream(output);
let thrown = 0, games = 0;
for await (const line of createInterface({ input: createReadStream(input) })) {
	const g = JSON.parse(line); games++;
	const views: unknown[] = [];
	for (const side of ['p1', 'p2'] as const) {
		const b = new FixedBattle(gens, side as any);
		let ok = true;
		for (const chunk of g[side] as string[]) {
			if (chunk.startsWith('|request|')) {
				const wait = JSON.parse(chunk.slice(9)).wait;
				if (ok) try { b.add(chunk); } catch (e) { ok = false; thrown++; console.error(String(e).slice(0, 100)); }
				if (!wait) {
					let v: any = null;
					if (ok) {
						v = view(b as any, side);
						const opp = side === 'p1' ? 'p2' : 'p1';
						v.flags = { own: { megaUsed: b.megaUsed[side], zUsed: b.zUsed[side] }, opp: { megaUsed: b.megaUsed[opp], zUsed: b.zUsed[opp] } };
					}
					views.push({ side, view: v });
				}
			} else if (!chunk.startsWith('|error|')) {
				for (const l of chunk.split('\n')) if (ok && l.startsWith('|')) try { b.add(l); } catch (e) { ok = false; thrown++; console.error(String(e).slice(0, 100)); }
			}
		}
	}
	out.write(JSON.stringify({ game: g.game, views }) + '\n');
}
out.end();
console.log(JSON.stringify({ games, thrown }));
