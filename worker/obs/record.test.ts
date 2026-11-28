import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPool, SIDES, seedOf } from '../sim/battles.ts';
import { type Battle, PRNG } from '../sim/showdown.ts';
import { randomLegal, step } from '../skeleton/drive.ts';
import { Env } from '../skeleton/env.ts';
import { kindOf } from '../skeleton/mask.ts';
import { BOOSTS, STATUS } from '../skeleton/record.ts';
import { Library, normalMove } from './prior.ts';
import { EVENT_COLS, EVENTS, FIELDS, ID_KIND, LAYOUT, MON_FLAGS, MOVE_NUM, N_EVENTS, OFFSET, RECORD_BYTES, RECORD_WORDS, VERSION } from './record.ts';
import { abilityId, itemId, moveId, NONE, speciesId, UNREVEALED, VOCAB2 } from './vocab.ts';

type SimPokemon = Battle['sides'][number]['pokemon'][number];
const root = new URL('../../', import.meta.url).pathname;
const POOL = loadPool(root + 'data/pool/v1/teams.jsonl');
const LIBRARY = new Library(root + 'data/priors/v0/species_sets.json');
const FLAG = Object.fromEntries(MON_FLAGS.map((f, i) => [f, i]));

test('layout: fields packed in order, 4 bytes each', () => {
	assert.equal(VERSION, 2);
	let words = 0;
	for (const [i, f] of FIELDS.entries()) {
		assert.equal(OFFSET[f.name], words);
		assert.equal(LAYOUT.fields[i].offset, 4 * words);
		words += f.shape.reduce((a, b) => a * b, 1);
	}
	assert.equal(RECORD_WORDS, words);
	assert.equal(RECORD_BYTES, 4 * words);
	// Integer fields come first, so a record splits into an i4 part and an f4 part at fieldNum.
	assert.ok(FIELDS.slice(0, FIELDS.findIndex(f => f.name === 'fieldNum')).every(f => f.dtype === 'i4'));
	assert.ok(FIELDS.slice(FIELDS.findIndex(f => f.name === 'fieldNum')).every(f => f.dtype === 'f4'));
});

test('version 2 records against the request, the sim and the tracker', () => {
	const env = new Env({ worker: 5, battles: 8, seed: 'record2-test', pool: POOL, turnCap: 300, record: 2, library: LIBRARY });
	const rng = new PRNG(seedOf('record2-test-actions'));
	let records = 0, revealedItems = 0, revealedAbilities = 0, revealedMoves = 0, ppChecked = 0;
	while (env.counts.games < 12) {
		step(env, (_i, mask) => randomLegal(mask, k => rng.random(k)), ({ ints, floats, n }) => {
			for (let i = 0; i < n; i++) {
				const d = env.decisions[i], b = i * RECORD_WORDS;
				const battle = d.slot.game.battle;
				const at = (name: string, j = 0) => b + OFFSET[name] + j;
				const msg = `game ${d.slot.id} ${SIDES[d.side]} turn ${battle.turn}`;
				assert.deepEqual([ints[at('game')], ints[at('side')], ints[at('turn')], ints[at('kind')]],
					[d.slot.id, d.side, battle.turn, kindOf(d.request)], msg);
				assert.ok(ints.subarray(at('mask'), at('mask', 18)).some(x => x === 1));

				// Own mons: the request's order is the sim's.
				const active = (d.request as any).active?.[0];
				for (const [j, p] of battle.sides[d.side].pokemon.entries()) {
					const m = `${msg} own ${p.name}`;
					assert.equal(ints[at('species', j)], speciesId(p.species.name), m);
					assert.equal(ints[at('item', j)], itemId(p.item), m);
					assert.equal(ints[at('ability', j)], abilityId(p.ability), m);
					assert.equal(floats[at('hp', j)], Math.fround(p.hp / p.maxhp), m);
					assert.equal(floats[at('fainted', j)], +p.fainted, m);
					assert.equal(floats[at('active', j)], +(p.isActive && !p.fainted && !d.request.teamPreview), m);
					assert.equal(ints[at('status', j)], p.fainted ? 0 : STATUS[p.status] ?? 0, m);
					for (const [k, s] of BOOSTS.entries()) assert.equal(floats[at('boosts', 7 * j + k)], p.boosts[s], m);
					const st = p.baseStoredStats;
					assert.deepEqual([...floats.subarray(at('stats', 6 * j), at('stats', 6 * j + 6))], [p.maxhp, st.atk, st.def, st.spa, st.spd, st.spe], m);
					for (const [k, slot] of p.moveSlots.entries()) {
						assert.equal(ints[at('moves', 4 * j + k)], moveId(slot.id), m);
						// PP is exact for the active at a move request, whose request lists it.
						if (j === 0 && active?.moves.some((x: any) => normalMove(x.id) === normalMove(slot.id) && 'pp' in x)) {
							assert.equal(floats[at('moveNum', MOVE_NUM.length * (4 * j + k) + 1)], Math.fround(slot.pp / slot.maxpp), `${m} ${slot.id} pp`);
							ppChecked++;
						}
					}
				}

				// Opposing mons: the active first, then Team Preview order (oppSlot).
				const sets = d.slot.game.sets[1 - d.side];
				const opp = battle.sides[1 - d.side];
				const slots = [...ints.subarray(at('oppSlot'), at('oppSlot', 6))];
				assert.deepEqual([...slots].sort(), [0, 1, 2, 3, 4, 5], msg);
				if (floats[at('active', 6)]) assert.equal(slots.slice(1).join(), [0, 1, 2, 3, 4, 5].filter(k => k !== slots[0]).join(), msg);
				else assert.deepEqual(slots, [0, 1, 2, 3, 4, 5], msg);
				for (let r = 0; r < 6; r++) {
					const set = sets[slots[r]];
					const p: SimPokemon = opp.pokemon.find(q => q.set.name === set.name)!;
					const j = 6 + r, m = `${msg} opp ${p.name}`;
					assert.ok([speciesId(p.species.name), speciesId(p.species.baseSpecies)].includes(ints[at('species', j)]), m);
					assert.equal(floats[at('fainted', j)], +p.fainted, m);
					if (floats[at('active', j)]) {
						assert.equal(r, 0, m);
						assert.ok(p.isActive, m);
						if (!p.fainted) assert.ok(Math.abs(floats[at('hp', j)] - p.hp / p.maxhp) <= 0.01, `${m} hp`);
					}
					// What the record calls revealed is what the sim holds.
					const item = ints[at('item', j)];
					if (item !== UNREVEALED) {
						assert.equal(item, item === NONE ? NONE : itemId(p.item), `${m} item`);
						if (item === NONE) assert.equal(p.item, '', `${m} item`);
						revealedItems++;
					}
					const ability = ints[at('ability', j)];
					// A fainted Mega reverts (`detailschange ... [silent]`), and the tracker then takes its base
					// species' first ability (env-workers.md, Gotchas).
					if (ability !== UNREVEALED && !p.fainted) {
						assert.ok([abilityId(p.ability), abilityId(p.baseAbility)].includes(ability), `${m} ability`);
						revealedAbilities++;
					}
					const own = p.moveSlots.map(s => moveId(s.id));
					for (let k = 0; k < 4; k++) {
						if (!floats[at('moveNum', MOVE_NUM.length * (4 * j + k))]) continue;
						assert.ok(own.includes(ints[at('moves', 4 * j + k)]), `${m} move ${ints[at('moves', 4 * j + k)]}`);
						revealedMoves++;
					}
					// Every training-team set is a library set (team-pool.md), so a prior always exists.
					assert.equal(floats[at('monFlags', MON_FLAGS.length * j + FLAG.noPrior)], 0, m);
				}

				for (let e = 0; e < N_EVENTS; e++) {
					const [type, side, slot, kind, id] = ints.subarray(at('events', EVENT_COLS.length * e), at('events', EVENT_COLS.length * e + 5));
					assert.ok(type >= 0 && type <= EVENTS.length && side >= 0 && side <= 2 && slot >= -1 && slot < 12, `${msg} event ${e}`);
					assert.ok(kind >= 0 && kind <= ID_KIND.ability && id >= 0, `${msg} event ${e}`);
					const size = [0, VOCAB2.species, VOCAB2.moves, VOCAB2.items, VOCAB2.abilities][kind];
					assert.ok(kind === 0 ? id === 0 : id < size, `${msg} event ${e}`);
				}
				for (let w = b + OFFSET.fieldNum; w < b + RECORD_WORDS; w++) assert.ok(Number.isFinite(floats[w]), `${msg} word ${w - b}`);
				records++;
			}
		});
	}
	assert.ok(records > 1000 && revealedItems > 100 && revealedAbilities > 100 && revealedMoves > 1000 && ppChecked > 1000,
		`${records} records, ${revealedItems} items, ${revealedAbilities} abilities, ${revealedMoves} moves, ${ppChecked} PP`);
	assert.equal(env.counts.invalid, 0);
	console.log(`${records} records: ${revealedItems} opposing items, ${revealedAbilities} abilities and ${revealedMoves} moves shown; ${ppChecked} PP checked`);
});
