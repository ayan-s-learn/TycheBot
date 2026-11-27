// Battles driven directly through `Battle` (T02 picked it), many per process. Each game keeps each player's
// output, chunked as Showdown's getPlayerStreams chunks it, until the env takes it at that player's next
// decision. strictChoices stays off (Showdown's default): under it a rejected choice throws (plan.md,
// Network v0: Action head).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Battle, extractChannelMessages, FORMAT, PRNG } from './showdown.ts';

export const SIDES = ['p1', 'p2'] as const;
export type Side = 0 | 1;
const NAMES = ['Bot 1', 'Bot 2'];

/** A pool file's packed teams (docs/areas/team-pool.md: teams.jsonl). */
export function loadPool(path: string): string[] {
	return readFileSync(path, 'utf8').trim().split('\n').map(l => JSON.parse(l).team);
}

/** A PRNG seed derived from any parts, so every game's seed follows from (run seed, worker, game). */
export function seedOf(...parts: (string | number)[]): PRNGSeed {
	return `sodium,${createHash('sha256').update(parts.join('/')).digest('hex')}`;
}

export interface GameSpec { seed: PRNGSeed, teams: [string, string] }
/** Both seats draw a pool team independently and uniformly (D4), from their own seeded draw. */
export function drawGame(pool: string[], ...parts: (string | number)[]): GameSpec {
	const draw = new PRNG(seedOf('teams', ...parts));
	return { seed: seedOf('battle', ...parts), teams: [draw.sample(pool), draw.sample(pool)] };
}

export class Game {
	readonly battle: Battle;
	/** The true sets in team order, with the sim's defaults filled in (EVs, IVs, Hidden Power's type). */
	readonly sets: [PokemonSet[], PokemonSet[]];
	/** Each player's chunks not yet taken: a view of one update, or a `|request|` or `|error|` line. */
	chunks: [string[], string[]] = [[], []];
	/** Each side's newest request JSON, until the env takes it. */
	requests: [string | null, string | null] = [null, null];
	private last: [string | null, string | null] = [null, null];
	/** `[Invalid choice]` rejections per side, each answered by posing the same request again. */
	invalid: [number, number] = [0, 0];
	/** The last `[Invalid choice]` message per side, for logging. */
	invalidMessage: [string, string] = ['', ''];
	ended = false;

	constructor(spec: GameSpec) {
		this.battle = new Battle({
			formatid: FORMAT, seed: spec.seed,
			send: (type, data) => this.receive(type, Array.isArray(data) ? data.join('\n') : data),
		});
		this.battle.setPlayer('p1', { name: NAMES[0], team: spec.teams[0] });
		this.battle.setPlayer('p2', { name: NAMES[1], team: spec.teams[1] });
		const sets = (i: Side) => this.battle.sides[i].pokemon.map(p => ({ ...p.set, hpType: p.hpType }));
		this.sets = [sets(0), sets(1)];
		this.battle.sendUpdates();
	}

	private receive(type: string, data: string) {
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
				// [Unavailable choice] comes with an updated request; [Invalid choice] doesn't. A mask that
				// let an illegal choice through shows up here, so the caller logs it and asks again.
				this.invalid[i]++;
				this.invalidMessage[i] = message;
				this.requests[i] = this.last[i];
			}
		} else if (type === 'end') {
			this.ended = true;
		}
	}

	choose(side: Side, choice: string) {
		this.battle.choose(SIDES[side], choice);
		this.battle.sendUpdates(); // as BattleStream does after each write
	}

	/** 0 or 1 for the winning side, -1 for a tie. Only once ended. */
	winner(): -1 | 0 | 1 {
		const w = this.battle.winner;
		return w === NAMES[0] ? 0 : w === NAMES[1] ? 1 : -1;
	}

	destroy() {
		this.battle.destroy();
	}
}
