// An env worker process. Python (tyche/transport/workers.py) starts it with two pipes, and the config as
// JSON in argv[2], which names the pipes' fds (`fds`: read, write). It sends a hello frame, then loops: a batch of records
// for every open decision across its battles, then one action per record back, until a stop frame.
// With `echo`, it sends the same batch of `echo` blank records every step and plays no battles: that
// times the transport alone.
import { PIN } from '../sim/showdown.ts';
import { loadPool } from '../sim/battles.ts';
import { Env } from './env.ts';
import { FRAME, HEADER_BYTES, Pipe, RESET_STATS } from './frames.ts';
import { LAYOUT, OFFSET, RECORD_WORDS } from './record.ts';
import { VOCAB } from './vocab.ts';

interface Config {
	worker: number, battles: number, seed: string | number, pool: string, turnCap: number, fds: [number, number], echo?: number,
}
const cfg: Config = JSON.parse(process.argv[2]);
const pipe = new Pipe(...cfg.fds);
pipe.sendJSON(FRAME.hello, { layout: LAYOUT, vocab: VOCAB, pin: PIN, node: process.version, config: cfg });

const ENDED_WORDS = 4;
let transfer = 0, frames = 0, window0 = performance.now(), cpu0 = process.cpuUsage();

function batchFrame(records: number, ended: number) {
	const frame = Pipe.frame(FRAME.batch, 8 + 4 * (ENDED_WORDS * ended + RECORD_WORDS * records));
	frame.writeUInt32LE(records, HEADER_BYTES);
	frame.writeUInt32LE(ended, HEADER_BYTES + 4);
	const words = (frame.length - HEADER_BYTES - 8) / 4;
	// Buffer.alloc of this size is not pooled, so it starts at offset 0 of its own ArrayBuffer.
	const ints = new Int32Array(frame.buffer, frame.byteOffset + HEADER_BYTES + 8, words);
	const floats = new Float32Array(frame.buffer, frame.byteOffset + HEADER_BYTES + 8, words);
	return { frame, ints, floats, at: ENDED_WORDS * ended };
}

/** Sends a batch and waits for the reply: the actions, or null after a stop frame. */
function exchange(frame: Buffer, records: number, stats: () => object) {
	const t = performance.now();
	pipe.send(frame);
	const reply = pipe.recv();
	transfer += performance.now() - t;
	frames++;
	if (reply.type === FRAME.stop) {
		const cpu = process.cpuUsage(cpu0);
		pipe.sendJSON(FRAME.stats, {
			...stats(), transfer, frames, windowMs: performance.now() - window0, cpuMs: (cpu.user + cpu.system) / 1000,
		});
		return null;
	}
	if (reply.type !== FRAME.actions) throw new Error(`unexpected frame type ${reply.type}`);
	const flags = reply.payload.readUInt32LE(0), n = reply.payload.readUInt32LE(4);
	if (n !== records) throw new Error(`${n} actions for ${records} records`);
	const actions = new Int32Array(reply.payload.buffer.slice(reply.payload.byteOffset + 8, reply.payload.byteOffset + 8 + 4 * n));
	return { actions, reset: !!(flags & RESET_STATS) };
}

function resetWindow() {
	transfer = frames = 0;
	window0 = performance.now();
	cpu0 = process.cpuUsage();
}

if (cfg.echo) {
	const { frame, ints } = batchFrame(cfg.echo, 0);
	for (let n = 0; n < cfg.echo; n++) ints.fill(1, n * RECORD_WORDS + OFFSET.mask, n * RECORD_WORDS + OFFSET.mask + 18);
	for (;;) {
		const reply = exchange(frame, cfg.echo, () => ({ counts: { decisions: frames * cfg.echo! } }));
		if (!reply) break;
		if (reply.reset) resetWindow();
	}
} else {
	const env = new Env({
		worker: cfg.worker, battles: cfg.battles, seed: cfg.seed, pool: loadPool(cfg.pool), turnCap: cfg.turnCap,
		log: msg => process.stderr.write(`worker ${cfg.worker}: ${msg}\n`),
	});
	let ended = env.ended.slice();
	for (;;) {
		const records = env.collect();
		const batch = batchFrame(records, ended.length);
		for (const [i, e] of ended.entries()) batch.ints.set([e.game, e.winner, e.truncated, e.turns], ENDED_WORDS * i);
		env.encode(batch.ints, batch.floats, batch.at);
		const reply = exchange(batch.frame, records, () => env.stats());
		if (!reply) break;
		if (reply.reset) {
			env.resetStats();
			resetWindow();
		}
		env.apply(reply.actions, batch.ints, batch.at);
		ended = env.ended.slice();
	}
}
