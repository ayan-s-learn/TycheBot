import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawGame, Game, loadPool } from './battles.ts';

const POOL = loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname);

test('a game follows from its seed parts', () => {
	assert.deepEqual(drawGame(POOL, 'run', 0, 5), drawGame(POOL, 'run', 0, 5));
	assert.notDeepEqual(drawGame(POOL, 'run', 0, 5).seed, drawGame(POOL, 'run', 1, 5).seed);
	const play = () => {
		const game = new Game(drawGame(POOL, 'run', 0, 5));
		for (let i = 0; i < 40 && !game.ended; i++) {
			for (const side of [0, 1] as const) {
				const r = game.requests[side];
				game.requests[side] = null;
				if (r && !JSON.parse(r).wait) game.choose(side, 'default');
			}
		}
		// The sim stamps `|t:|` lines with the clock.
		return game.chunks.map(cs => cs.map(c => c.replace(/\|t:\|\d+/g, '')));
	};
	assert.deepEqual(play(), play());
});
