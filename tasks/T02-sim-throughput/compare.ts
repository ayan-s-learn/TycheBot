// Pools sweeps and checks a rerun against them. The reported figures are the median (min–max) over every
// run of the reported sweeps, per driver and process count. Given a rerun, it checks T02's timing
// acceptance rule (TOLERANCE, accepted by the user on 2026-11-25): for each driver and process count,
// the rerun's median ms/decision lies within 10% of the reported median. It also shows whether that median
// lies within the reported min–max, the brief's original rule.
// Usage: node compare.ts <reported sweep.json>[,<another>...] [<rerun sweep.json>]
//   (with a rerun: exit code 1 if any of its medians is more than 10% off)
import { readFileSync } from 'node:fs';

interface Rec {
	procs: number, driver: string, msPerDecision: number, msPerTurn: number, choiceMsPerDecision: number,
	decisionsPerSecond: number,
}
const load = (f: string): Rec[] => JSON.parse(readFileSync(f, 'utf8')).records;
const [reportedArg, rerunArg] = process.argv.slice(2);
const reported = reportedArg.split(',').flatMap(load);
const median = (xs: number[]) => {
	const s = xs.toSorted((a, b) => a - b), m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pick = (rs: Rec[], p: number, d: string, k: keyof Rec) =>
	rs.filter(r => r.procs === p && r.driver === d).map(r => r[k] as number);
const fmt = (xs: number[], digits: number) =>
	`${median(xs).toFixed(digits)} (${Math.min(...xs).toFixed(digits)}–${Math.max(...xs).toFixed(digits)})`;
const procs = [...new Set(reported.map(r => r.procs))].sort((a, b) => a - b);
const drivers = ['direct', 'stream'];
const TOLERANCE = 0.10;

if (!rerunArg) {
	const runs = pick(reported, procs[0], 'direct', 'msPerDecision').length;
	console.log(`Median (min–max) over ${runs} runs\n`);
	console.log('| Driver | Processes | ms/decision | ms/turn | choice ms/decision | decisions/s |');
	console.log('|---|---|---|---|---|---|');
	for (const p of procs) {
		for (const d of drivers) {
			console.log(`| ${d} | ${p} | ${fmt(pick(reported, p, d, 'msPerDecision'), 3)} | ` +
				`${fmt(pick(reported, p, d, 'msPerTurn'), 3)} | ${fmt(pick(reported, p, d, 'choiceMsPerDecision'), 3)} | ` +
				`${fmt(pick(reported, p, d, 'decisionsPerSecond'), 0)} |`);
		}
	}
	process.exit(0);
}

const rerun = load(rerunArg);
let outside = 0, failing = 0, worst = 0;
console.log('| Driver | Processes | ms/decision: reported median (min–max) | rerun median | Within | vs reported median | ms/turn, rerun | decisions/s, rerun |');
console.log('|---|---|---|---|---|---|---|---|');
for (const p of [...new Set(rerun.map(r => r.procs))].sort((a, b) => a - b)) {
	for (const d of drivers) {
		const rep = pick(reported, p, d, 'msPerDecision');
		const got = median(pick(rerun, p, d, 'msPerDecision'));
		const within = got >= Math.min(...rep) && got <= Math.max(...rep);
		if (!within) outside++;
		const off = got / median(rep) - 1;
		if (!(Math.abs(off) <= TOLERANCE)) failing++; // NaN, from a configuration not reported, fails too
		worst = Math.max(worst, Math.abs(off));
		console.log(`| ${d} | ${p} | ${fmt(rep, 3)} | ${got.toFixed(3)} | ${within ? 'yes' : 'no'} | ` +
			`${off >= 0 ? '+' : ''}${(100 * off).toFixed(1)}% | ` +
			`${median(pick(rerun, p, d, 'msPerTurn')).toFixed(3)} | ${median(pick(rerun, p, d, 'decisionsPerSecond')).toFixed(0)} |`);
	}
}
console.log(`\n${failing} of the rerun's medians more than ${100 * TOLERANCE}% from the reported median ` +
	`(the farthest is ${(100 * worst).toFixed(1)}%); ${outside} outside the reported min–max`);
process.exit(failing ? 1 : 0);
