// Copied from T02 (tasks/T02-sim-throughput/sim.ts at d0ab75e), changed only to export Battle for truth.ts.
// Shared code: Showdown at the pin, the team pool, seeds, and the two drivers. Each driver runs
// many battles interleaved in one process and collects what the training env needs at each decision:
// both players' protocol lines and request JSON, with strictChoices off (Showdown's default).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type BattleModule = typeof import('../../vendor/pokemon-showdown/dist/sim/battle.js');
type AIModule = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/random-player-ai.js');
type RunnerModule = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/runner.js');
type Battle = InstanceType<BattleModule['Battle']>;
type BattleStream = InstanceType<PS['BattleStream']>;
type RandomPlayerAI = InstanceType<AIModule['RandomPlayerAI']>;
export type Seed = `sodium,${string}`;

// Showdown's dist/ is CommonJS without ESM export annotations, so load it with require.
const require = createRequire(import.meta.url);
const dist = '../../vendor/pokemon-showdown/dist/';
export const { Teams, TeamValidator, Dex, BattleStream, getPlayerStreams, PRNG }: PS = require(dist + 'sim/index.js');
export const { Battle, extractChannelMessages }: BattleModule = require(dist + 'sim/battle.js');
const { RandomPlayerAI }: AIModule = require(dist + 'sim/tools/random-player-ai.js');
const { Runner }: RunnerModule = require(dist + 'sim/tools/runner.js');

export const FORMAT = 'gen9nationaldex' as ID;
export const PIN = readFileSync(new URL('../../showdown.pin', import.meta.url), 'utf8').trim();
export const SIDES = ['p1', 'p2'] as const;
const here = (f: string) => new URL(f, import.meta.url);

/** Validated packed teams: Smogon's NatDex sample teams (teams.ts builds the file). */
export function loadPool(): string[] {
	return readFileSync(here('teams/pool.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l).team);
}
export const illusionTeam = () => Teams.pack(Teams.import(readFileSync(here('teams/illusion.txt'), 'utf8')));
/** The recorder's teams: the Illusion team, then the pool in order. */
export const recorderTeams = () => [illusionTeam(), ...loadPool()];

/** The sim writes `|t:|` timestamps from Date.now(). Freezing it makes output reproducible byte for byte. */
export function freezeClock() {
	Date.now = () => 0;
}

const seed = (n: number): Seed => `sodium,${n.toString(16).padStart(64, '0')}`;
export interface Game { id: number, seed: Seed, aiSeeds: [Seed, Seed], teams: [string, string] }
/** Game `id` gets its own seeds for the battle, both players and the team draw. */
export function makeGame(id: number, pool: string[], p1team?: string): Game {
	const draw = new PRNG(seed(4 * id + 3));
	const p1 = p1team ?? draw.sample(pool);
	return { id, seed: seed(4 * id), aiSeeds: [seed(4 * id + 1), seed(4 * id + 2)], teams: [p1, draw.sample(pool)] };
}
/** The recorder's game `id`: p1 plays team id mod T of `teams`, p2 a seeded draw from them. */
export const recorderGame = (id: number, teams: string[]) => makeGame(id, teams, teams[id % teams.length]);

/**
 * One battle's output for each player, chunked as getPlayerStreams chunks it: a player's view of one
 * update (protocol lines joined by \n), or a `|request|` or `|error|` line from a sideupdate.
 */
export class Collector {
	chunks: [string[], string[]] = [[], []];
	/** Each side's newest request JSON, until the env takes it. */
	requests: [string | null, string | null] = [null, null];
	last: [string | null, string | null] = [null, null];
	invalid = 0;
	ended = false;

	receive(type: string, data: string) {
		if (type === 'update') {
			const channels = extractChannelMessages(data, [1, 2]);
			this.chunks[0].push(channels[1].join('\n'));
			this.chunks[1].push(channels[2].join('\n'));
		} else if (type === 'sideupdate') {
			const i = data.startsWith('p1\n') ? 0 : 1;
			const message = data.slice(3);
			this.chunks[i].push(message);
			if (message.startsWith('|request|')) {
				this.requests[i] = this.last[i] = message.slice(9);
			} else if (message.startsWith('|error|[Invalid choice]')) {
				// [Unavailable choice] (hidden trapping) comes with an updated request; [Invalid choice]
				// doesn't. The request can allow a choice the sim rejects: when Eject Pack forces a switch
				// mid-turn, switching to the Pokémon already queued to switch in. So offer it again.
				if (++this.invalid > 100) throw new Error(`${SIDES[i]}: 100 invalid choices, the last ${message}`);
				this.requests[i] = this.last[i];
			}
		} else if (type === 'end') {
			this.ended = true;
		}
	}
}

export interface Driver<H> {
	name: string;
	start(game: Game, out: Collector): H;
	choose(h: H, side: 0 | 1, choice: string): void;
	/** Resolves once every choice sent so far has reached its Collector. */
	flush(): void | Promise<void>;
	battle(h: H): Battle;
	end(h: H): void;
}

function fatal(err: unknown) {
	console.error(err);
	process.exit(1);
}

/** `Battle` driven directly: synchronous calls, with output through the `send` callback. */
export const direct: Driver<Battle> = {
	name: 'direct',
	start(game, out) {
		const battle = new Battle({
			formatid: FORMAT, seed: game.seed,
			send: (type, data) => out.receive(type, Array.isArray(data) ? data.join('\n') : data),
		});
		battle.setPlayer('p1', { name: 'Bot 1', team: game.teams[0] });
		battle.setPlayer('p2', { name: 'Bot 2', team: game.teams[1] });
		battle.sendUpdates();
		return battle;
	},
	choose(battle, side, choice) {
		battle.choose(SIDES[side], choice);
		battle.sendUpdates(); // as BattleStream does after each write
	},
	flush() {},
	battle: battle => battle,
	end: battle => battle.destroy(),
};

/** `BattleStream`: text commands in, `${type}\n${data}` chunks out, read by an async loop per battle. */
export const stream: Driver<BattleStream> = {
	name: 'stream',
	start(game, out) {
		const s = new BattleStream();
		void (async () => {
			for await (const chunk of s) {
				const nl = chunk.indexOf('\n');
				out.receive(chunk.slice(0, nl), chunk.slice(nl + 1));
			}
		})().catch(fatal);
		void s.write(`>start ${JSON.stringify({ formatid: FORMAT, seed: game.seed })}\n` +
			`>player p1 ${JSON.stringify({ name: 'Bot 1', team: game.teams[0] })}\n` +
			`>player p2 ${JSON.stringify({ name: 'Bot 2', team: game.teams[1] })}`);
		return s;
	},
	choose(s, side, choice) {
		void s.write(`>${SIDES[side]} ${choice}`);
	},
	// The reader loops run as microtasks, which all finish before the next macrotask.
	flush: () => new Promise(resolve => setImmediate(resolve)),
	battle: s => s.battle!,
	end: s => void s.writeEnd(),
};
export const drivers = { direct, stream };

/** Showdown's RandomPlayerAI with Runner.AI_OPTIONS (move 0.7, mega 0.6), answering synchronously. */
export class Player {
	choice = '';
	ai: RandomPlayerAI;
	constructor(seed: Seed) {
		const capture = { write: (c: string) => { this.choice = c; } } as any;
		this.ai = new RandomPlayerAI(capture, { ...Runner.AI_OPTIONS, seed });
	}
	/** The choice for a request, or null for a wait request. */
	answer(request: string) {
		const parsed = JSON.parse(request);
		if (parsed.wait) return null;
		this.choice = '';
		this.ai.receiveRequest(parsed);
		if (!this.choice) throw new Error(`no choice for ${request}`);
		return this.choice;
	}
}

export interface Ended { game: Game, battle: Battle, chunks: [string[], string[]] }
export interface Stats {
	games: number, turns: number, decisions: number, steps: number, driverMs: number, choiceMs: number,
	/** Choices rejected as [Invalid choice] and answered again (Collector). */
	invalid: number,
	/** Wall time from the first counted step to the end. */
	windowMs: number,
	/** This process's CPU time (user + system, all threads) over the same window. */
	cpuMs: number,
}
export interface PlayOptions {
	concurrency: number;
	/** Called as each game ends. Without it, output is dropped after every step, as if sent to Python. */
	onEnd?: (e: Ended) => void;
	/** Counting starts at the first step boundary after this time (ms, Date.now() clock)... */
	countFrom?: number;
	/** ...and play stops at the first step boundary after this one. */
	stopAt?: number;
}

/**
 * Plays games with `concurrency` battles interleaved. Each step answers every open request (choice
 * time), then sends all the choices, collects each player's output, and replaces ended games (driver
 * time). A decision is a request a player must answer, so wait requests don't count.
 */
export async function play<H>(driver: Driver<H>, games: Iterator<Game>, opts: PlayOptions): Promise<Stats> {
	interface Slot { game: Game, out: Collector, h: H, players: [Player, Player], turn0: number, invalid0: number }
	const stats: Stats = {
		games: 0, turns: 0, decisions: 0, steps: 0, driverMs: 0, choiceMs: 0, invalid: 0, windowMs: 0, cpuMs: 0,
	};
	const clock = Date.now; // freezeClock() may replace Date.now later
	let counting = opts.countFrom === undefined;
	const open = (): Slot | null => {
		const next = games.next();
		if (next.done) return null;
		const out = new Collector();
		return {
			game: next.value, out, h: driver.start(next.value, out),
			players: [new Player(next.value.aiSeeds[0]), new Player(next.value.aiSeeds[1])], turn0: 0, invalid0: 0,
		};
	};
	let slots: Slot[] = [];
	const choices: [Slot, 0 | 1, string][] = [];
	let t0 = performance.now();
	let countStart = t0;
	let cpu0 = process.cpuUsage();
	for (let i = 0; i < opts.concurrency; i++) {
		const slot = open();
		if (slot) slots.push(slot);
	}
	for (;;) {
		await driver.flush();
		for (const [i, slot] of slots.entries()) {
			if (!slot.out.ended) continue;
			const battle = driver.battle(slot.h);
			if (counting) {
				stats.games++;
				stats.turns += battle.turn - slot.turn0;
				stats.invalid += slot.out.invalid - slot.invalid0;
			}
			opts.onEnd?.({ game: slot.game, battle, chunks: slot.out.chunks });
			driver.end(slot.h);
			slots[i] = open()!;
		}
		slots = slots.filter(Boolean);
		await driver.flush(); // output from games just opened
		const t1 = performance.now();
		if (counting) stats.driverMs += t1 - t0;
		if (!opts.onEnd) for (const slot of slots) slot.out.chunks = [[], []];
		if (!slots.length) break;

		const now = clock();
		if (counting && opts.stopAt !== undefined && now >= opts.stopAt) {
			for (const slot of slots) {
				stats.turns += driver.battle(slot.h).turn - slot.turn0;
				stats.invalid += slot.out.invalid - slot.invalid0;
			}
			break;
		}
		if (!counting && now >= opts.countFrom!) {
			counting = true;
			countStart = t1;
			cpu0 = process.cpuUsage();
			for (const slot of slots) {
				slot.turn0 = driver.battle(slot.h).turn;
				slot.invalid0 = slot.out.invalid;
			}
		}

		choices.length = 0;
		for (const slot of slots) {
			for (const i of [0, 1] as const) {
				const request = slot.out.requests[i];
				if (request === null) continue;
				slot.out.requests[i] = null;
				const choice = slot.players[i].answer(request);
				if (choice !== null) choices.push([slot, i, choice]);
			}
		}
		if (!choices.length) throw new Error('games are open but no player has a request to answer');
		t0 = performance.now();
		if (counting) {
			stats.choiceMs += t0 - t1;
			stats.decisions += choices.length;
			stats.steps++;
		}
		for (const [slot, i, choice] of choices) driver.choose(slot.h, i, choice);
	}
	stats.windowMs = performance.now() - countStart;
	const cpu = process.cpuUsage(cpu0);
	stats.cpuMs = (cpu.user + cpu.system) / 1000;
	return stats;
}

/** Game ids first, first + 1, ... */
export function* gameIds(first: number, pool: string[], count = Infinity) {
	for (let id = first; id < first + count; id++) yield makeGame(id, pool);
}
