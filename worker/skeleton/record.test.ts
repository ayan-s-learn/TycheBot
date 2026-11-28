import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPool, seedOf } from '../sim/battles.ts';
import { PRNG } from '../sim/showdown.ts';
import { randomLegal, step } from './drive.ts';
import { Env } from './env.ts';
import { kindOf } from './mask.ts';
import { BOOSTS, FIELDS, LAYOUT, OFFSET, RECORD_BYTES, RECORD_WORDS, STATUS, VERSION } from './record.ts';
import { speciesId } from './vocab.ts';

const POOL = loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname);

test('layout: fields packed in order, 4 bytes each', () => {
	assert.ok(Number.isInteger(VERSION) && VERSION > 0);
	let words = 0;
	for (const [i, f] of FIELDS.entries()) {
		assert.equal(OFFSET[f.name], words);
		assert.equal(LAYOUT.fields[i].offset, 4 * words);
		words += f.shape.reduce((a, b) => a * b, 1);
	}
	assert.equal(RECORD_WORDS, words);
	assert.equal(RECORD_BYTES, 4 * words);
	assert.equal(LAYOUT.recordBytes, RECORD_BYTES);
});

test('records match the request and the sim', () => {
	const env = new Env({ worker: 3, battles: 4, seed: 'record-test', pool: POOL, turnCap: 300 });
	const rng = new PRNG(seedOf('record-test-actions'));
	let records = 0;
	while (env.counts.games < 6) {
		step(env, (_i, mask) => randomLegal(mask, k => rng.random(k)), ({ ints, floats, n }) => {
			for (let i = 0; i < n; i++) {
				const d = env.decisions[i], b = i * RECORD_WORDS;
				const battle = d.slot.game.battle;
				const at = (name: string, j = 0) => b + OFFSET[name] + j;
				assert.deepEqual([ints[at('game')], ints[at('side')], ints[at('turn')], ints[at('kind')]],
					[d.slot.id, d.side, battle.turn, kindOf(d.request)]);
				// Own mons: the request's order is the sim's.
				const own = battle.sides[d.side].pokemon;
				for (const [j, p] of own.entries()) {
					assert.equal(ints[at('species', j)], speciesId(p.species.name));
					assert.equal(floats[at('hp', j)], Math.fround(p.hp / p.maxhp));
					assert.equal(floats[at('fainted', j)], +p.fainted);
					assert.equal(floats[at('active', j)], +(p.isActive && !p.fainted));
					assert.equal(ints[at('status', j)], p.fainted ? 0 : STATUS[p.status] ?? 0);
					for (const [k, s] of BOOSTS.entries()) assert.equal(floats[at('boosts', 7 * j + k)], p.boosts[s], `${p.name} ${s}`);
				}
				// Opposing mons in team order, as Team Preview shows them; HP as the protocol rounds it.
				const opp = battle.sides[1 - d.side];
				for (const [k, set] of d.slot.game.sets[1 - d.side].entries()) {
					const p = opp.pokemon.find(q => q.set.name === set.name)!;
					const shown = [speciesId(p.species.name), speciesId(p.species.baseSpecies)];
					assert.ok(shown.includes(ints[at('species', 6 + k)]), `${p.species.name}`);
					assert.equal(floats[at('fainted', 6 + k)], +p.fainted);
					if (p.isActive && !p.fainted) {
						assert.equal(floats[at('active', 6 + k)], 1);
						assert.ok(Math.abs(floats[at('hp', 6 + k)] - p.hp / p.maxhp) <= 0.01, `${p.name} hp`);
					}
				}
				for (let w = b + OFFSET.hp; w < b + RECORD_WORDS; w++) assert.ok(Number.isFinite(floats[w]), `word ${w - b}`);
				records++;
			}
		});
	}
	assert.ok(records > 500);
});
