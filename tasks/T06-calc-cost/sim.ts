// Showdown at the pin, the team pool, seeded games between RandomPlayerAIs with `Battle` driven directly.
// Game setup follows T02's sim.ts (makeGame, Player) so the two tasks play the same games.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');
type BattleModule = typeof import('../../vendor/pokemon-showdown/dist/sim/battle.js');
type AIModule = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/random-player-ai.js');
type RunnerModule = typeof import('../../vendor/pokemon-showdown/dist/sim/tools/runner.js');
export type Battle = InstanceType<BattleModule['Battle']>;
type RandomPlayerAI = InstanceType<AIModule['RandomPlayerAI']>;
type Seed = `sodium,${string}`;

// Showdown's dist/ is CommonJS without ESM export annotations, so load it with require.
const require = createRequire(import.meta.url);
const dist = '../../vendor/pokemon-showdown/dist/';
export const { Teams, TeamValidator, Dex, PRNG }: PS = require(dist + 'sim/index.js');
const { Battle, extractChannelMessages }: BattleModule = require(dist + 'sim/battle.js');
const { RandomPlayerAI }: AIModule = require(dist + 'sim/tools/random-player-ai.js');
const { Runner }: RunnerModule = require(dist + 'sim/tools/runner.js');

export const FORMAT = 'gen9nationaldex' as ID;
export const PIN = readFileSync(new URL('../../showdown.pin', import.meta.url), 'utf8').trim();
export const SIDES = ['p1', 'p2'] as const;

/** Smogon's 25 NatDex sample teams, packed (copied from T02's teams/pool.jsonl at 4664b14). */
export function loadPool(): string[] {
	return readFileSync(new URL('teams/pool.jsonl', import.meta.url), 'utf8').trim().split('\n')
		.map(l => JSON.parse(l).team);
}

const seed = (n: number): Seed => `sodium,${n.toString(16).padStart(64, '0')}`;
export interface Game { id: number, seed: Seed, aiSeeds: [Seed, Seed], teams: [string, string] }
export function makeGame(id: number, pool: string[]): Game {
	const draw = new PRNG(seed(4 * id + 3));
	return { id, seed: seed(4 * id), aiSeeds: [seed(4 * id + 1), seed(4 * id + 2)], teams: [draw.sample(pool), draw.sample(pool)] };
}

/** Showdown's RandomPlayerAI with Runner.AI_OPTIONS (move 0.7, mega 0.6), answering synchronously. */
class Player {
	choice = '';
	ai: RandomPlayerAI;
	constructor(s: Seed) {
		const capture = { write: (c: string) => { this.choice = c; } } as any;
		this.ai = new RandomPlayerAI(capture, { ...Runner.AI_OPTIONS, seed: s });
	}
	answer(request: any) {
		this.choice = '';
		this.ai.receiveRequest(request);
		if (!this.choice) throw new Error(`no choice for ${JSON.stringify(request)}`);
		return this.choice;
	}
}

export interface Hooks {
	/** Called at each decision (a non-wait request), before the player answers it. */
	decision?(battle: Battle, side: 0 | 1): void;
	/** Called once the battle exists, before any turn runs. */
	created?(battle: Battle): void;
	ended?(battle: Battle): void;
}
export interface SimStats { games: number, turns: number, decisions: number, simMs: number }

/**
 * Plays games one after another. Sim time covers what the env's sim does per step: creating the battle,
 * `choose` and `sendUpdates`, and splitting each update into per-player streams with
 * extractChannelMessages. It leaves out the AI's choices and the hooks.
 */
export function play(games: Iterable<Game>, hooks: Hooks = {}): SimStats {
	const stats: SimStats = { games: 0, turns: 0, decisions: 0, simMs: 0 };
	const requests: [any, any] = [null, null];
	const send = (type: string, data: string | string[]) => {
		const text = Array.isArray(data) ? data.join('\n') : data;
		if (type === 'update') {
			extractChannelMessages(text, [1, 2]);
		} else if (type === 'sideupdate') {
			const message = text.slice(3);
			if (message.startsWith('|request|')) requests[text.startsWith('p1\n') ? 0 : 1] = message.slice(9);
			if (message.startsWith('|error|[Invalid choice]')) throw new Error(message);
		}
	};
	for (const game of games) {
		let t0 = performance.now();
		const battle = new Battle({ formatid: FORMAT, seed: game.seed, send });
		hooks.created?.(battle);
		battle.setPlayer('p1', { name: 'Bot 1', team: game.teams[0] });
		battle.setPlayer('p2', { name: 'Bot 2', team: game.teams[1] });
		battle.sendUpdates();
		stats.simMs += performance.now() - t0;
		const players = [new Player(game.aiSeeds[0]), new Player(game.aiSeeds[1])];
		while (!battle.ended) {
			const choices: [0 | 1, string][] = [];
			for (const i of [0, 1] as const) {
				if (requests[i] === null) continue;
				const request = JSON.parse(requests[i]);
				requests[i] = null;
				if (request.wait) continue;
				stats.decisions++;
				hooks.decision?.(battle, i);
				choices.push([i, players[i].answer(request)]);
			}
			if (!choices.length) throw new Error(`game ${game.id}: no request to answer`);
			t0 = performance.now();
			for (const [i, choice] of choices) {
				battle.choose(SIDES[i], choice);
				battle.sendUpdates();
			}
			stats.simMs += performance.now() - t0;
		}
		stats.games++;
		stats.turns += battle.turn;
		hooks.ended?.(battle);
		t0 = performance.now();
		battle.destroy();
		stats.simMs += performance.now() - t0;
		requests[0] = requests[1] = null;
	}
	return stats;
}

export function* gameIds(first: number, count: number, pool: string[]) {
	for (let id = first; id < first + count; id++) yield makeGame(id, pool);
}
