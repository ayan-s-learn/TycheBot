// An env worker process writing record version 2, started by tyche/transport/workers.py with `main` set to this
// file. As worker/skeleton/main.ts, with the same frames at version 2: a hello, then a batch of records for every
// open decision across its battles and one action per record back, until a stop frame. The config is JSON in
// argv[2]: `fds` (read, write), `library` (a species_sets.json), and either `pool` (a teams.jsonl, whose training
// teams are drawn) or `games`, a fixed list of {seed, teams}: game i plays games[i], and the worker plays no more
// once the list is done.
import { Env } from '../skeleton/env.ts';
import { FRAME, HEADER_BYTES, Pipe, RESET_STATS } from '../skeleton/frames.ts';
import { type GameSpec, loadPool } from '../sim/battles.ts';
import { PIN } from '../sim/showdown.ts';
import { Library } from './prior.ts';
import { LAYOUT, RECORD_WORDS, VERSION } from './record.ts';
import { VOCAB2 } from './vocab.ts';

interface Config {
	worker: number, battles: number, seed: string | number, pool?: string, games?: GameSpec[], library: string,
	turnCap: number, fds: [number, number],
}
const cfg: Config = JSON.parse(process.argv[2]);
const pipe = new Pipe(cfg.fds[0], cfg.fds[1], VERSION);
const library = new Library(cfg.library);
const { games, ...shown } = cfg;
pipe.sendJSON(FRAME.hello, { layout: LAYOUT, vocab: VOCAB2, pin: PIN, node: process.version, config: { ...shown, games: games?.length } });

const ENDED_WORDS = 4;
let transfer = 0, frames = 0, window0 = performance.now(), cpu0 = process.cpuUsage();

const env = new Env({
	worker: cfg.worker, battles: cfg.battles, seed: cfg.seed, pool: cfg.pool ? loadPool(cfg.pool) : [], turnCap: cfg.turnCap,
	games: games ? id => games[id] ?? null : undefined, record: 2, library,
	log: msg => process.stderr.write(`worker ${cfg.worker}: ${msg}\n`),
});
let ended = env.ended.slice();
for (;;) {
	const records = env.collect();
	const frame = pipe.frame(FRAME.batch, 8 + 4 * (ENDED_WORDS * ended.length + RECORD_WORDS * records));
	frame.writeUInt32LE(records, HEADER_BYTES);
	frame.writeUInt32LE(ended.length, HEADER_BYTES + 4);
	// Buffer.alloc of this size is not pooled, so it starts at offset 0 of its own ArrayBuffer.
	const words = (frame.length - HEADER_BYTES - 8) / 4;
	const ints = new Int32Array(frame.buffer, frame.byteOffset + HEADER_BYTES + 8, words);
	const floats = new Float32Array(frame.buffer, frame.byteOffset + HEADER_BYTES + 8, words);
	for (const [i, e] of ended.entries()) ints.set([e.game, e.winner, e.truncated, e.turns], ENDED_WORDS * i);
	env.encode(ints, floats, ENDED_WORDS * ended.length);

	const t = performance.now();
	pipe.send(frame);
	const reply = pipe.recv();
	transfer += performance.now() - t;
	frames++;
	if (reply.type === FRAME.stop) {
		const cpu = process.cpuUsage(cpu0);
		pipe.sendJSON(FRAME.stats, {
			...env.stats(), transfer, frames, windowMs: performance.now() - window0, cpuMs: (cpu.user + cpu.system) / 1000,
		});
		break;
	}
	if (reply.type !== FRAME.actions) throw new Error(`unexpected frame type ${reply.type}`);
	const flags = reply.payload.readUInt32LE(0), n = reply.payload.readUInt32LE(4);
	if (n !== records) throw new Error(`${n} actions for ${records} records`);
	if (flags & RESET_STATS) {
		env.resetStats();
		transfer = frames = 0;
		window0 = performance.now();
		cpu0 = process.cpuUsage();
	}
	const actions = new Int32Array(reply.payload.buffer.slice(reply.payload.byteOffset + 8, reply.payload.byteOffset + 8 + 4 * n));
	env.apply(actions, ints, ENDED_WORDS * ended.length);
	ended = env.ended.slice();
}
