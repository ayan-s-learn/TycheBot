// One timed run: seeded games with `Battle` driven directly, and at each decision both calc sets, uncached
// and cached, for the deciding player. Prints one JSON line. Run it under the timing lock (README, Outputs).
// Usage: node bench.ts [games=200] [warmup=20]
import { execSync } from 'node:child_process';
import { PIN, gameIds, loadPool, play } from './sim.ts';
import { newTally, runDecision, type Mode, type Tally } from './calcs.ts';

const games = Number(process.argv[2] ?? 200);
const warmup = Number(process.argv[3] ?? 20);
const pool = loadPool();
const loadavg = () => execSync('sysctl -n vm.loadavg', { encoding: 'utf8' }).trim();
const MODES: Mode[] = ['all', 'active'];

interface Timed { uncachedMs: number, cachedMs: number, uncached: Tally, cached: Tally }
const timed = (): Timed => ({ uncachedMs: 0, cachedMs: 0, uncached: newTally(), cached: newTally() });
let results = { all: timed(), active: timed() };
// One cache per player per game: each player's calcs use its own view of the battle (D7), so the two
// players can't share entries once opponents are at prior sets.
let caches: Map<string, number[]>[][] = [];

function run(first: number, count: number) {
	results = { all: timed(), active: timed() };
	const sim = play(gameIds(first, count, pool), {
		created() {
			caches = MODES.map(() => [new Map(), new Map()]);
		},
		decision(battle, side) {
			for (const [m, mode] of MODES.entries()) {
				const r = results[mode];
				let t0 = performance.now();
				runDecision(battle, side, mode, r.uncached);
				const t1 = performance.now();
				runDecision(battle, side, mode, r.cached, caches[m][side]);
				r.uncachedMs += t1 - t0;
				r.cachedMs += performance.now() - t1;
			}
		},
	});
	return sim;
}

const before = loadavg();
run(1_000_000, warmup); // other games than the timed ones, so JIT warm-up isn't timed
const start = performance.now();
const sim = run(0, games);
const wallMs = performance.now() - start;
// The same games again with no calcs: the calc passes above leave garbage and cold caches that slow the
// sim steps between them, so `sim` is the sim's cost next to calcs and `simAlone` its cost without them.
const simAlone = play(gameIds(0, games, pool));
console.log(JSON.stringify({
	date: new Date().toISOString(), node: process.version, pin: PIN, games, warmup, wallMs: Math.round(wallMs),
	loadavgBefore: before, loadavgAfter: loadavg(), sim, simAlone, calcs: results,
}));
