import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { drawGame, Game, loadPool } from './battles.ts';

const POOL = loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname);

test('a pool loads its training teams only', () => {
	const v1 = new URL('../../data/pool/v1/', import.meta.url).pathname;
	const lines = readFileSync(v1 + 'teams.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
	const held = new Set(readFileSync(v1 + 'holdout.txt', 'utf8').split('\n').filter(Boolean));
	const train = loadPool(v1 + 'teams.jsonl');
	assert.equal(held.size, 10);
	assert.deepEqual(train, lines.filter(t => !held.has(t.id)).map(t => t.team));
	assert.equal(train.length, 40);
	assert.equal(POOL.length, 20); // v0 has no holdout.txt
});

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
