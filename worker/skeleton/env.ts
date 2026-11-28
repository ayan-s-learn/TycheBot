// The worker's env: many battles at once, one tracker per player, the calcs, and a record per decision.
// Each step gathers every open decision across the battles, writes their records, and applies one action
// per decision. main.ts and worker/obs/main.ts move the records and actions over the transport.
// Record version 1 (record.ts) is the skeleton's; version 2 (worker/obs/record.ts) is built by worker/obs/builder.ts.
import { Calcs, hpOf } from '../calc/calcs.ts';
import { Builder, type Entry } from '../obs/builder.ts';
import type { Library } from '../obs/prior.ts';
import * as R2 from '../obs/record.ts';
import { type Client, newClient } from '../obs/tracker.ts';
import { drawGame, Game, type GameSpec, SIDES, type Side } from '../sim/battles.ts';
import { choiceOf, kindOf, monName, type Request, SWITCH, writeMask } from './mask.ts';
import { BOOSTS, KIND, OFFSET, RECORD_WORDS, STATUS } from './record.ts';
import { moveId, speciesId } from './vocab.ts';

export interface EnvConfig {
	worker: number;
	battles: number;
	/** Every game's seeds and teams follow from (seed, worker, game). */
	seed: string | number;
	pool: string[];
	/** A game still going when this turn starts is cut off and reported as truncated. */
	turnCap: number;
	log?: (msg: string) => void;
	/** Game `id`'s seed and teams, instead of a draw from the pool. null: no game, and the slot closes. */
	games?: (id: number) => GameSpec | null;
	/** The record version to write: 1 (the default) or 2, which needs `library`. */
	record?: 1 | 2;
	library?: Library;
	/** Version 2: keep each builder's inputs (Builder.transcript), for the leak test. */
	transcripts?: boolean;
	/** Called with each game's slot when it ends, before it is closed. */
	onEnd?: (slot: Slot) => void;
}

interface Player { client: Client, calcs: Calcs | null, builder: Builder | null, queued: string | null }
export interface Slot { id: number, game: Game, players: [Player, Player], invalid: [number, number] }
interface Decision { slot: Slot, side: Side, request: Request }
export interface Ended { game: number, winner: number, truncated: number, turns: number }

export class Times { sim = 0; track = 0; calc = 0; record = 0; }
export class Counts {
	decisions = 0; games = 0; turns = 0; truncated = 0; invalid = 0; unavailable = 0; calcs = 0; calcHits = 0;
	/** Version 2: opposing mons that had no consistent library set at some decision, once per player and game. */
	noPrior = 0;
}

export class Env {
	slots: Slot[] = [];
	decisions: Decision[] = [];
	ended: Ended[] = [];
	times = new Times();
	counts = new Counts();
	private nextGame = 0;
	private calcTally = { calcs: 0, hits: 0 };

	readonly cfg: EnvConfig;
	readonly version: 1 | 2;
	/** Words per record, and the mask's offset in a record, at this env's version. */
	readonly recordWords: number;
	readonly maskOffset: number;

	constructor(cfg: EnvConfig) {
		this.cfg = cfg;
		this.version = cfg.record ?? 1;
		if (this.version === 2 && !cfg.library) throw new Error('record version 2 needs a library');
		this.recordWords = this.version === 2 ? R2.RECORD_WORDS : RECORD_WORDS;
		this.maskOffset = this.version === 2 ? R2.OFFSET.mask : OFFSET.mask;
		const t = performance.now();
		for (let i = 0; i < cfg.battles; i++) {
			const slot = this.open();
			if (slot) this.slots.push(slot);
		}
		this.times.sim += performance.now() - t;
	}

	private open(): Slot | null {
		const id = this.nextGame++;
		const spec = this.cfg.games ? this.cfg.games(id) : drawGame(this.cfg.pool, this.cfg.seed, this.cfg.worker, id);
		if (!spec) return null;
		const game = new Game(spec);
		const player = (side: Side): Player => {
			if (this.version === 1) {
				const calcs = new Calcs(game.sets[side], game.sets[1 - side], this.calcTally);
				return { client: newClient(SIDES[side]), calcs, builder: null, queued: null };
			}
			// The builder gets the player's own sets and the library, never the opponent's sets.
			const builder = new Builder(SIDES[side], game.sets[side], this.cfg.library!, this.calcTally);
			if (this.cfg.transcripts) builder.transcript = [] as Entry[];
			return { client: builder.client, calcs: null, builder, queued: null };
		};
		return { id, game, players: [player(0), player(1)], invalid: [0, 0] };
	}

	resetStats() {
		this.times = new Times();
		this.counts = new Counts();
		this.calcTally.calcs = this.calcTally.hits = 0;
	}

	stats() {
		return { times: this.times, counts: { ...this.counts, calcs: this.calcTally.calcs, calcHits: this.calcTally.hits } };
	}

	/** Feeds each player's new output to its tracker and lists the decisions open now. */
	collect() {
		const t = performance.now();
		this.decisions.length = 0;
		for (const slot of this.slots) {
			for (const side of [0, 1] as const) {
				const json = slot.game.requests[side];
				if (json === null) continue;
				slot.game.requests[side] = null;
				this.feed(slot.players[side], slot.game.chunks[side], SIDES[side]);
				const request: Request = JSON.parse(json);
				if (!request.wait) this.decisions.push({ slot, side, request });
			}
		}
		this.times.track += performance.now() - t;
		return this.decisions.length;
	}

	private feed(p: Player, chunks: string[], side: 'p1' | 'p2') {
		const switchIn = `${side}a: `;
		for (const chunk of chunks) {
			if (chunk.startsWith('|error|')) {
				if (chunk.startsWith('|error|[Unavailable choice]')) this.counts.unavailable++;
				continue;
			}
			if (chunk.startsWith('|request|')) {
				if (p.builder) p.builder.request(chunk);
				else p.client.add(chunk);
				continue;
			}
			for (const line of chunk.split('\n')) {
				if (line.charCodeAt(0) !== 124) continue; // '|'
				if (p.builder) p.builder.line(line);
				else p.client.add(line);
				if (!p.queued) continue;
				// The queued switch is over once its mon comes in, or once the turn's actions are done.
				if (line === '|upkeep') p.queued = null;
				else if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
					const ident = line.slice(line.indexOf('|', 1) + 1, line.indexOf('|', line.indexOf('|', 1) + 1));
					if (ident.startsWith(switchIn) && monName(ident) === p.queued) p.queued = null;
				}
			}
		}
		chunks.length = 0;
	}

	/** Writes the records of the decisions `collect` listed, from word `at` of the two views. */
	encode(ints: Int32Array, floats: Float32Array, at: number) {
		if (this.version === 2) {
			for (const [n, d] of this.decisions.entries()) {
				const p = d.slot.players[d.side];
				p.builder!.build(d.request, p.queued, d.slot.id, ints, floats, at + n * this.recordWords, this.times);
			}
			return;
		}
		for (const [n, d] of this.decisions.entries()) {
			const t0 = performance.now();
			const base = at + n * RECORD_WORDS;
			const p = d.slot.players[d.side];
			const own = p.client[SIDES[d.side]], opp = own.foe;
			const req = d.request;
			const mons = req.side.pokemon as unknown as { details: string, moves: string[], condition: string, active: boolean }[];
			ints[base + OFFSET.game] = d.slot.id;
			ints[base + OFFSET.side] = d.side;
			ints[base + OFFSET.turn] = d.slot.game.battle.turn;
			ints[base + OFFSET.kind] = kindOf(req);
			ints.fill(0, base + OFFSET.species, base + OFFSET.mask + 18);
			floats.fill(0, base + OFFSET.hp, base + OFFSET.boosts + 84);
			for (let i = 0; i < mons.length; i++) {
				const r = mons[i], c = own.team[i];
				ints[base + OFFSET.species + i] = speciesId(r.details.slice(0, (r.details + ',').indexOf(',')));
				for (let j = 0; j < r.moves.length && j < 4; j++) ints[base + OFFSET.moves + 4 * i + j] = moveId(r.moves[j]);
				const fainted = r.condition.endsWith(' fnt');
				ints[base + OFFSET.status + i] = fainted ? 0 : STATUS[c.status ?? ''] ?? 0;
				floats[base + OFFSET.hp + i] = hpOf(c);
				floats[base + OFFSET.fainted + i] = +fainted;
				// The request marks slot 1 active at Team Preview too.
				floats[base + OFFSET.active + i] = +(r.active && !fainted && !req.teamPreview);
				for (let b = 0; b < 7; b++) floats[base + OFFSET.boosts + 7 * i + b] = c.boosts[BOOSTS[b]] ?? 0;
			}
			for (let k = 0; k < opp.team.length && k < 6; k++) {
				const c = opp.team[k];
				ints[base + OFFSET.species + 6 + k] = speciesId(c.speciesForme);
				ints[base + OFFSET.status + 6 + k] = c.fainted ? 0 : STATUS[c.status ?? ''] ?? 0;
				floats[base + OFFSET.hp + 6 + k] = hpOf(c);
				floats[base + OFFSET.fainted + 6 + k] = +c.fainted;
				floats[base + OFFSET.active + 6 + k] = +opp.active.includes(c);
				for (let b = 0; b < 7; b++) floats[base + OFFSET.boosts + 7 * (6 + k) + b] = c.boosts[BOOSTS[b]] ?? 0;
			}
			writeMask(req, p.queued, ints, base + OFFSET.mask);
			const t1 = performance.now();
			p.calcs!.run(p.client, SIDES[d.side], req as any, floats, base + OFFSET.calcs);
			const t2 = performance.now();
			this.times.record += t1 - t0;
			this.times.calc += t2 - t1;
		}
	}

	/** Applies one action per listed decision, checked against the mask written at word `at` of `ints`. */
	apply(actions: Int32Array, ints: Int32Array, at: number) {
		if (actions.length !== this.decisions.length) throw new Error(`${actions.length} actions for ${this.decisions.length} decisions`);
		const t = performance.now();
		this.ended.length = 0;
		for (const [n, d] of this.decisions.entries()) {
			const a = actions[n];
			if (!(a >= 0 && a < 18) || ints[at + n * this.recordWords + this.maskOffset + a] !== 1) {
				throw new Error(`action ${a} is masked for decision ${n} (game ${d.slot.id}, side ${d.side})`);
			}
			// The player's own switch, while it is queued (writeMask). Forcing out the mon it was for cancels it
			// (Showdown's switchIn: queue.cancelAction), so it ends with a forced switch.
			const p = d.slot.players[d.side];
			p.queued = kindOf(d.request) === KIND.move && a >= SWITCH ? monName(d.request.side.pokemon[a - SWITCH].ident) : null;
			d.slot.game.choose(d.side, choiceOf(d.request, a));
		}
		this.counts.decisions += this.decisions.length;
		const closed = new Set<Slot>();
		for (const [i, slot] of this.slots.entries()) {
			const game = slot.game;
			for (const side of [0, 1] as const) {
				if (game.invalid[side] === slot.invalid[side]) continue;
				this.counts.invalid += game.invalid[side] - slot.invalid[side];
				slot.invalid[side] = game.invalid[side];
				this.cfg.log?.(`game ${slot.id} ${SIDES[side]}: ${game.invalidMessage[side]}`);
				if (game.invalid[side] > 100) throw new Error(`game ${slot.id}: 100 invalid choices`);
			}
			const truncated = !game.ended && game.battle.turn >= this.cfg.turnCap;
			if (!game.ended && !truncated) continue;
			this.ended.push({ game: slot.id, winner: truncated ? -1 : game.winner(), truncated: +truncated, turns: game.battle.turn });
			this.counts.games++;
			this.counts.truncated += +truncated;
			this.counts.turns += game.battle.turn;
			for (const p of slot.players) this.counts.noPrior += p.builder?.noPrior.size ?? 0;
			this.cfg.onEnd?.(slot);
			game.destroy();
			const next = this.open();
			if (next) this.slots[i] = next;
			else closed.add(slot);
		}
		if (closed.size) this.slots = this.slots.filter(s => !closed.has(s));
		this.times.sim += performance.now() - t;
	}
}
