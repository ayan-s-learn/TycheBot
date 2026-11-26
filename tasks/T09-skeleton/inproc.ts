// The worker's env in one process with no transport: random legal actions chosen in Node. A smoke test,
// and a breakdown of env time without transfer.
// Usage: node inproc.ts [games=200] [battles=32] [seed=inproc]
import { loadPool } from '../../worker/sim/battles.ts';
import { PRNG } from '../../worker/sim/showdown.ts';
import { randomLegal, step } from '../../worker/skeleton/drive.ts';
import { Env } from '../../worker/skeleton/env.ts';

const [games = '200', battles = '32', seed = 'inproc'] = process.argv.slice(2);
const env = new Env({
	worker: 0, battles: +battles, seed, pool: loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname),
	turnCap: 300, log: msg => console.error(msg),
});
const rng = new PRNG(`sodium,${'0'.repeat(64)}`);
const winners = [0, 0, 0];
const t0 = performance.now();
while (env.counts.games < +games) {
	step(env, (_i, mask) => randomLegal(mask, n => rng.random(n)));
	for (const e of env.ended) winners[e.winner + 1]++;
}
const ms = performance.now() - t0;
const { times, counts } = env.stats();
const per = (x: number) => +(x / counts.decisions).toFixed(4);
console.log(JSON.stringify({
	games: counts.games, decisions: counts.decisions, turns: counts.turns, truncated: counts.truncated,
	invalid: counts.invalid, unavailable: counts.unavailable, ties: winners[0], p1: winners[1], p2: winners[2],
	hitRate: +(counts.calcHits / counts.calcs).toFixed(3), calcsPerDecision: +(counts.calcs / counts.decisions).toFixed(1),
	msPerDecision: { total: per(ms), sim: per(times.sim), track: per(times.track), calc: per(times.calc), record: per(times.record) },
}));
