// Median [min–max] over bench.ts runs, as a Markdown table.
// Usage: node summarize.ts runs/<file>.jsonl ...
import { readFileSync } from 'node:fs';

const runs = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l)));
const rows: [string, (r: any) => number, number][] = [['sim ms per decision', r => r.sim.simMs / r.sim.decisions, 3]];
for (const [mode, max] of [['all', 288], ['active', 48]] as const) {
	const c = (r: any) => r.calcs[mode];
	const perDecision = (r: any, k: 'uncached' | 'cached') => c(r)[`${k}Ms`] / c(r)[k].decisions;
	const sim = (r: any) => r.sim.simMs / r.sim.decisions;
	rows.push(
		[`${mode}: calcs per decision (max ${max})`, r => c(r).uncached.calcs / c(r).uncached.decisions, 1],
		[`${mode}: µs per calc, uncached`, r => 1000 * c(r).uncachedMs / c(r).uncached.calcs, 1],
		[`${mode}: ms per decision, uncached`, r => perDecision(r, 'uncached'), 3],
		[`${mode}: ms per decision, cached`, r => perDecision(r, 'cached'), 3],
		[`${mode}: cache hit rate`, r => c(r).cached.hits / c(r).cached.calcs, 3],
		[`${mode}: ms per decision at ${max} calcs, uncached`, r => max * c(r).uncachedMs / c(r).uncached.calcs, 3],
		[`${mode}: calc share of env time, uncached`, r => perDecision(r, 'uncached') / (sim(r) + perDecision(r, 'uncached')), 3],
		[`${mode}: calc share of env time, cached`, r => perDecision(r, 'cached') / (sim(r) + perDecision(r, 'cached')), 3],
	);
}
const fmt = (x: number, d: number) => x.toFixed(d);
console.log(`${runs.length} runs, ${runs[0].games} games each (${runs[0].sim.decisions} decisions, ${runs[0].sim.turns} turns), ` +
	`Node ${runs[0].node}, Showdown ${runs[0].pin.slice(0, 7)}`);
console.log(`load averages before → after: ${runs.map(r => `${r.loadavgBefore} → ${r.loadavgAfter}`).join('; ')}\n`);
console.log('| Measure | Median | Min–max |\n|---|---|---|');
for (const [label, f, d] of rows) {
	const xs = runs.map(f).sort((a, b) => a - b);
	const median = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
	console.log(`| ${label} | ${fmt(median, d)} | ${fmt(xs[0], d)}–${fmt(xs.at(-1)!, d)} |`);
}
