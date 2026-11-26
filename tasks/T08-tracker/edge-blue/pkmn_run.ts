// @pkmn/client over the scenario games: views at each decision (T08's view format) plus errors, and the full final Battle for inspection.
import { readFileSync, writeFileSync } from 'node:fs';
import { Battle } from '@pkmn/client';
import { generations, view } from '../pkmn.ts';
const [input, output] = process.argv.slice(2);
const gens = generations('natdex');
const out: string[] = [];
const errs: any[] = [];
for (const line of readFileSync(input, 'utf8').trim().split('\n')) {
	const g = JSON.parse(line);
	const views: any[] = [];
	for (const side of ['p1', 'p2'] as const) {
		const b = new Battle(gens, side as any);
		let ok = true;
		const feed = (l: string) => {
			if (!ok || !l.startsWith('|')) return;
			try { b.add(l); } catch (e) { ok = false; errs.push({ game: g.name, side, line: l.slice(0, 100), err: (e as Error).message.split('\n')[0] }); }
		};
		for (const chunk of g[side] as string[]) {
			if (chunk.startsWith('|request|')) {
				const wait = JSON.parse(chunk.slice(9)).wait;
				feed(chunk);
				if (!wait) views.push({ side, view: ok ? view(b, side) : null });
			} else if (!chunk.startsWith('|error|')) for (const l of chunk.split('\n')) feed(l);
		}
		(globalThis as any).__b ??= {};
		(globalThis as any).__b[g.name + side] = b;
	}
	out.push(JSON.stringify({ game: g.game, views }));
}
writeFileSync(output, out.join('\n') + '\n');
console.log(JSON.stringify(errs, null, 1));
