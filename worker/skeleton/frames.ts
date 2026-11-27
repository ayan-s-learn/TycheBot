// The Node end of the transport: length-prefixed binary frames over two pipes Python opens for the worker,
// read and written with blocking calls, since the worker waits for each reply anyway.
// Frame: magic u32, version u16, type u16, payload length u32, then the payload. All little-endian.
import { readSync, writeSync } from 'node:fs';
import { endianness } from 'node:os';
import { VERSION } from './record.ts';

export const MAGIC = 0x54594348; // 'TYCH'
export const HEADER_BYTES = 12;
export const FRAME = {
	// worker -> Python
	hello: 1, // JSON: version, layout, vocab, pin
	batch: 2, // n records u32, n ended u32, ended (game, winner, truncated, turns: i32 each), records
	stats: 3, // JSON
	// Python -> worker
	actions: 16, // flags u32, n u32, n actions i32 (one per record of the last batch, in order)
	stop: 17, // empty: the worker answers with stats and exits
} as const;
/** In an actions frame: reset the worker's counters, which opens a timing window. */
export const RESET_STATS = 1;

if (endianness() !== 'LE') throw new Error('the record format is little-endian');

export class Pipe {
	private header = Buffer.alloc(HEADER_BYTES);
	private readFd: number;
	private writeFd: number;
	constructor(readFd: number, writeFd: number) {
		this.readFd = readFd;
		this.writeFd = writeFd;
	}

	/** A frame's buffer with its header written, for the caller to fill from HEADER_BYTES. */
	static frame(type: number, payloadBytes: number) {
		const buf = Buffer.alloc(HEADER_BYTES + payloadBytes);
		buf.writeUInt32LE(MAGIC, 0);
		buf.writeUInt16LE(VERSION, 4);
		buf.writeUInt16LE(type, 6);
		buf.writeUInt32LE(payloadBytes, 8);
		return buf;
	}

	send(frame: Buffer) {
		for (let at = 0; at < frame.length;) at += writeSync(this.writeFd, frame, at, frame.length - at);
	}

	sendJSON(type: number, value: unknown) {
		const json = Buffer.from(JSON.stringify(value));
		const buf = Pipe.frame(type, json.length);
		json.copy(buf, HEADER_BYTES);
		this.send(buf);
	}

	private readExact(buf: Buffer) {
		for (let at = 0; at < buf.length;) {
			const n = readSync(this.readFd, buf, at, buf.length - at, null);
			if (n === 0) throw new Error('transport closed');
			at += n;
		}
	}

	/** The next frame. Refuses a frame with another magic or a version this worker doesn't know. */
	recv(): { type: number, payload: Buffer } {
		this.readExact(this.header);
		const magic = this.header.readUInt32LE(0), version = this.header.readUInt16LE(4);
		if (magic !== MAGIC) throw new Error(`bad frame magic ${magic.toString(16)}`);
		if (version !== VERSION) throw new Error(`record version ${version}, but this worker knows ${VERSION}`);
		const payload = Buffer.alloc(this.header.readUInt32LE(8));
		this.readExact(payload);
		return { type: this.header.readUInt16LE(6), payload };
	}
}
