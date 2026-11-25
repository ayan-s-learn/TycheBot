// Compares a rerun sweep with the reported one: for each driver and process count, whether the rerun's
// median ms/decision lies within the reported runs' min–max. Prints ms/turn and decisions/s alongside.
// Usage: node compare.ts <reported sweep.json> <rerun sweep.json>   (exit code 1 if any median is outside)
import { readFileSync } from 'node:fs';

type Rec = { procs: number, driver: string, msPerDecision: number, msPerTurn: number, decisionsPerSecond: number };
const load = (f: string): Rec[] => JSON.parse(readFileSync(f, 'utf8')).records;
const [reported, rerun] = process.argv.slice(2).map(load);
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[xs.length >> 1];
const pick = (rs: Rec[], p: number, d: string, k: keyof Rec) =>
	rs.filter(r => r.procs === p && r.driver === d).map(r => r[k] as number);

let outside = 0;
console.log('| Driver | Processes | ms/decision: reported median (min–max) | rerun median | Within | ms/turn, rerun | decisions/s, rerun |');
console.log('|---|---|---|---|---|---|---|');
for (const p of [...new Set(rerun.map(r => r.procs))]) {
	for (const d of ['direct', 'stream']) {
		const rep = pick(reported, p, d, 'msPerDecision');
		const got = median(pick(rerun, p, d, 'msPerDecision'));
		const within = got >= Math.min(...rep) && got <= Math.max(...rep);
		if (!within) outside++;
		console.log(`| ${d} | ${p} | ${median(rep).toFixed(3)} (${Math.min(...rep).toFixed(3)}–${Math.max(...rep).toFixed(3)}) ` +
			`| ${got.toFixed(3)} | ${within ? 'yes' : 'no'} | ${median(pick(rerun, p, d, 'msPerTurn')).toFixed(3)} ` +
			`| ${median(pick(rerun, p, d, 'decisionsPerSecond')).toFixed(0)} |`);
	}
}
console.log(`\n${outside} of the rerun's medians outside the reported range`);
process.exit(outside ? 1 : 0);
