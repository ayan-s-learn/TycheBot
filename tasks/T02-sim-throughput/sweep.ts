// Timed sweep. For each run, process count P and driver, starts P bench.ts processes on one shared window
// (warm-up, then the measured seconds, so all P stay busy throughout) and records:
//   - msPerDecision, msPerTurn: all processes' driver time over all their decisions or turns, the cost of
//     a decision to a process sharing the machine with P - 1 others;
//   - choiceMsPerDecision: the RandomPlayerAIs' time, reported apart;
//   - decisionsPerSecond: all P processes together, players' time included;
//   - otherCores: the rest of the machine's load during the window, in cores: all cores' busy time (from
//     os.cpus()) less the bench processes' own CPU time, over the window. otherBefore is the same over
//     5 s just before the configuration starts. cpuPerWall is each process's CPU time over its window;
//   - the load averages just before the processes start.
// Each configuration waits until otherBefore is under QUIET cores, for up to MAX_WAIT_S, then runs anyway.
// The drivers swap order each run. Take it under the timing lock (AGENTS.md, Conventions).
// Usage: node sweep.ts <out.json> [procs=1,2,4,8,10,12,14] [runs=3] [seconds=20] [warmup=5] [concurrency=32]
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Stats } from './sim.ts';

const QUIET = 2.5; // cores; this Mac's desktop alone kept ~1.6 busy (2026-11-25)
const MAX_WAIT_S = 180;
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

type Times = ReturnType<typeof cpus>[number]['times'][];
const cpuTimes = (): Times => cpus().map(c => c.times);
/** Busy cores between two snapshots: the busy fraction of all cores' time, times the core count. */
function busyCores(a: Times, b: Times) {
	let busy = 0, total = 0;
	b.forEach((t, i) => {
		const idle = t.idle - a[i].idle;
		const all = t.user + t.nice + t.sys + t.irq + t.idle - (a[i].user + a[i].nice + a[i].sys + a[i].irq + a[i].idle);
		total += all;
		busy += all - idle;
	});
	return busy / total * b.length;
}
async function otherNow() {
	const a = cpuTimes();
	await sleep(5000);
	return busyCores(a, cpuTimes());
}

const records = [];
for (let run = 1; run <= runs; run++) {
	for (const p of procs) {
		for (const driver of run % 2 ? ['direct', 'stream'] : ['stream', 'direct']) {
			let otherBefore = await otherNow();
			let waitedS = 5;
			while (otherBefore >= QUIET && waitedS < MAX_WAIT_S) {
				await sleep(25_000);
				otherBefore = await otherNow();
				waitedS += 30;
			}
			const loadavg = execFileSync('sysctl', ['-n', 'vm.loadavg'], { encoding: 'utf8' }).trim();
			const start = Date.now() + warmup * 1000;
			const end = start + seconds * 1000;
			let atStart: Times = [], atEnd: Times = [];
			setTimeout(() => { atStart = cpuTimes(); }, start - Date.now());
			setTimeout(() => { atEnd = cpuTimes(); }, end - Date.now());
			// Both drivers play the same game ids: run r's process i starts at r * 1e6 + i * 1e4.
			const each = await Promise.all(Array.from({ length: p }, (_, i) =>
				bench([driver, run * 1e6 + i * 1e4, start, end, concurrency])));
			const sum = (k: keyof Stats) => each.reduce((a, s) => a + s[k], 0);
			const perProcess = each.map(s => s.driverMs / s.decisions);
			const cpuPerWall = each.map(s => s.cpuMs / s.windowMs);
			const record = {
				run, procs: p, driver, loadavg, seconds, concurrency, waitedS,
				otherBefore, otherCores: busyCores(atStart, atEnd) - each.reduce((a, s) => a + s.cpuMs / s.windowMs, 0),
				msPerDecision: sum('driverMs') / sum('decisions'),
				msPerTurn: sum('driverMs') / sum('turns'),
				choiceMsPerDecision: sum('choiceMs') / sum('decisions'),
				decisionsPerTurn: sum('decisions') / sum('turns'),
				decisionsPerSecond: each.reduce((a, s) => a + 1000 * s.decisions / s.windowMs, 0),
				perProcessMsPerDecision: [Math.min(...perProcess), Math.max(...perProcess)],
				cpuPerWall: [Math.min(...cpuPerWall), Math.max(...cpuPerWall)],
				games: sum('games'),
				processes: each,
			};
			records.push(record);
			writeFileSync(out, JSON.stringify({ node: process.version, records }, null, 1) + '\n');
			console.log(`run ${run}, ${p} procs, ${driver}: ${record.msPerDecision.toFixed(3)} ms/decision ` +
				`(per process ${record.perProcessMsPerDecision.map(x => x.toFixed(3)).join('-')}), ` +
				`${record.msPerTurn.toFixed(3)} ms/turn, choice ${record.choiceMsPerDecision.toFixed(3)} ms/decision, ` +
				`${record.decisionsPerSecond.toFixed(0)} decisions/s, ${record.games} games; other load ` +
				`${otherBefore.toFixed(1)} before (waited ${waitedS} s), ${record.otherCores.toFixed(1)} during; ` +
				`cpu/wall ${record.cpuPerWall.map(x => x.toFixed(2)).join('-')}; load ${loadavg}`);
		}
	}
}

// Median and range over runs, per driver and process count.
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[xs.length >> 1];
const fmt = (xs: number[], d: number) => `${median(xs).toFixed(d)} (${Math.min(...xs).toFixed(d)}–${Math.max(...xs).toFixed(d)})`;
console.log('\n| Driver | Processes | ms/decision | ms/turn | choice ms/decision | decisions/s (all processes) | other cores |');
console.log('|---|---|---|---|---|---|---|');
for (const p of procs) {
	for (const driver of ['direct', 'stream']) {
		const rs = records.filter(r => r.procs === p && r.driver === driver);
		const col = (k: 'msPerDecision' | 'msPerTurn' | 'choiceMsPerDecision' | 'decisionsPerSecond' | 'otherCores',
			d: number) => fmt(rs.map(r => r[k]), d);
		console.log(`| ${driver} | ${p} | ${col('msPerDecision', 3)} | ${col('msPerTurn', 3)} | ` +
			`${col('choiceMsPerDecision', 3)} | ${col('decisionsPerSecond', 0)} | ${col('otherCores', 1)} |`);
	}
}
