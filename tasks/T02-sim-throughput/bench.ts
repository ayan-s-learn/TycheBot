// One timing process: plays games from id `first` with `concurrency` battles interleaved, warming up until
// startMs and counting until endMs (Date.now() clock), then prints its Stats as one JSON line.
// Usage: node bench.ts <direct|stream> [first=0] [startMs=now+5s] [endMs=start+20s] [concurrency=32]
import { drivers, gameIds, loadPool, play, PIN, type Driver } from './sim.ts';

const [name, first = 0, start = Date.now() + 5000, end = start + 20000, concurrency = 32] =
	process.argv.slice(2).map((a, i) => i ? Number(a) : a) as [string, number?, number?, number?, number?];
const driver: Driver<any> = drivers[name as keyof typeof drivers];
if (!driver) throw new Error(`driver must be direct or stream, not ${name}`);

const stats = await play(driver, gameIds(first, loadPool()), { concurrency, countFrom: start, stopAt: end });
console.log(JSON.stringify({ driver: name, first, concurrency, node: process.version, pin: PIN, ...stats }));
