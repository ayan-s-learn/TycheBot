// Timed sweep. For each run, process count P and driver, starts P bench.ts processes on one shared window
// (warm-up, then the measured seconds, so all P stay busy throughout) and records:
//   - msPerDecision, msPerTurn: summed driver time over summed decisions or turns. With P > 1 that is
//     core-ms, the cost of a decision to a process sharing the machine with P - 1 others;
//   - choiceMsPerDecision: the RandomPlayerAIs' time, reported apart;
//   - decisionsPerSecond: all P processes together, players' time included;
//   - the load averages just before the processes start.
// The drivers swap order each run. Take it under the timing lock (AGENTS.md, Conventions).
// Usage: node sweep.ts <out.json> [procs=1,2,4,8,10,12,14] [runs=3] [seconds=20] [warmup=5] [concurrency=32]
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { Stats } from './sim.ts';

const [out, procsArg = '1,2,4,8,10,12,14', ...rest] = process.argv.slice(2);
const procs = procsArg.split(',').map(Number);
const [runs = 3, seconds = 20, warmup = 5, concurrency = 32] = rest.map(Number);
const benchPath = new URL('bench.ts', import.meta.url).pathname;

function bench(args: (string | number)[]): Promise<Stats> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [benchPath, ...args.map(String)], { stdio: ['ignore', 'pipe', 'inherit'] });
		let text = '';
		child.stdout.on('data', d => { text += d; });
		child.on('exit', code => code ? reject(new Error(`bench.ts ${args.join(' ')}: exit ${code}`)) : resolve(JSON.parse(text)));
	});
}

const records = [];
for (let run = 1; run <= runs; run++) {
	for (const p of procs) {
		for (const driver of run % 2 ? ['direct', 'stream'] : ['stream', 'direct']) {
			const loadavg = execFileSync('sysctl', ['-n', 'vm.loadavg'], { encoding: 'utf8' }).trim();
			const start = Date.now() + warmup * 1000;
			// Both drivers play the same game ids: run r's process i starts at r * 1e6 + i * 1e4.
			const each = await Promise.all(Array.from({ length: p }, (_, i) =>
				bench([driver, run * 1e6 + i * 1e4, start, start + seconds * 1000, concurrency])));
			const sum = (k: keyof Stats) => each.reduce((a, s) => a + s[k], 0);
			const perProcess = each.map(s => s.driverMs / s.decisions);
			const record = {
				run, procs: p, driver, loadavg, seconds, concurrency,
				msPerDecision: sum('driverMs') / sum('decisions'),
				msPerTurn: sum('driverMs') / sum('turns'),
				choiceMsPerDecision: sum('choiceMs') / sum('decisions'),
				decisionsPerTurn: sum('decisions') / sum('turns'),
				decisionsPerSecond: each.reduce((a, s) => a + 1000 * s.decisions / s.windowMs, 0),
				perProcessMsPerDecision: [Math.min(...perProcess), Math.max(...perProcess)],
				games: sum('games'),
				processes: each,
			};
			records.push(record);
			writeFileSync(out, JSON.stringify({ node: process.version, records }, null, 1) + '\n');
			console.log(`run ${run}, ${p} procs, ${driver}: ${record.msPerDecision.toFixed(3)} ms/decision ` +
				`(per process ${record.perProcessMsPerDecision.map(x => x.toFixed(3)).join('-')}), ` +
				`${record.msPerTurn.toFixed(3)} ms/turn, choice ${record.choiceMsPerDecision.toFixed(3)} ms/decision, ` +
				`${record.decisionsPerSecond.toFixed(0)} decisions/s, ${record.games} games; load ${loadavg}`);
		}
	}
}

// Median and range over runs, per driver and process count.
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[xs.length >> 1];
const fmt = (xs: number[], d: number) => `${median(xs).toFixed(d)} (${Math.min(...xs).toFixed(d)}–${Math.max(...xs).toFixed(d)})`;
console.log('\n| Driver | Processes | ms/decision | ms/turn | choice ms/decision | decisions/s (all processes) |');
console.log('|---|---|---|---|---|---|');
for (const p of procs) {
	for (const driver of ['direct', 'stream']) {
		const rs = records.filter(r => r.procs === p && r.driver === driver);
		const col = (k: 'msPerDecision' | 'msPerTurn' | 'choiceMsPerDecision' | 'decisionsPerSecond', d: number) =>
			fmt(rs.map(r => r[k]), d);
		console.log(`| ${driver} | ${p} | ${col('msPerDecision', 3)} | ${col('msPerTurn', 3)} | ` +
			`${col('choiceMsPerDecision', 3)} | ${col('decisionsPerSecond', 0)} |`);
	}
}
