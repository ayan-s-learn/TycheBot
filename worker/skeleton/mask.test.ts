import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadPool, SIDES, seedOf } from '../sim/battles.ts';
import { type Battle, PRNG, Teams } from '../sim/showdown.ts';
import { randomLegal, step } from './drive.ts';
import { Env } from './env.ts';
import { choiceOf, type Request, writeMask } from './mask.ts';
import { KIND } from './record.ts';

type StateModule = typeof import('../../vendor/pokemon-showdown/dist/sim/state.js');
const { State }: StateModule = createRequire(import.meta.url)('../../vendor/pokemon-showdown/dist/sim/state.js');
const POOL = loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname);

const legal = (r: Request, queued: string | null = null) => {
	const out = new Int32Array(18);
	writeMask(r, queued, out, 0);
	return [...out.keys()].filter(a => out[a]);
};
const mon = (name: string, active = false, condition = '100/100') => ({ ident: `p1: ${name}`, active, condition });
const bench = [mon('A', true), mon('B', false, '0 fnt'), mon('C'), mon('D'), mon('E', false, '0 fnt'), mon('F')];

test('Team Preview: a lead per team slot', () => {
	assert.deepEqual(legal({ teamPreview: true, side: { pokemon: bench } }), [12, 13, 14, 15, 16, 17]);
	assert.equal(choiceOf({ teamPreview: true, side: { pokemon: bench } }, 14), 'team 3');
});

test('move request: disabled moves, Mega, Z-Moves and switches', () => {
	const r: Request = {
		active: [{
			moves: [{ id: 'a' }, { id: 'b', disabled: true }, { id: 'c' }, { id: 'd' }],
			canMegaEvo: true, canZMove: [null, { move: 'Z' }, null, null],
		}],
		side: { pokemon: bench },
	};
	// b is disabled but its Z-Move isn't; B and E are fainted and A is active.
	assert.deepEqual(legal(r), [0, 1, 5, 6, 7, 9, 10, 14, 15, 17]);
	assert.deepEqual([0, 1, 5, 14].map(a => choiceOf(r, a)), ['move 1', 'move 1 mega', 'move 2 zmove', 'switch 3']);
	r.active![0].trapped = true;
	assert.deepEqual(legal(r), [0, 1, 5, 6, 7, 9, 10]);
});

test('a locked move is the only move', () => {
	const r: Request = { active: [{ moves: [{ id: 'outrage' }], trapped: true }], side: { pokemon: bench } };
	assert.deepEqual(legal(r), [0]);
});

test('forced switch: not fainted, active, or the mon already queued to switch in', () => {
	const r: Request = { forceSwitch: [true], side: { pokemon: bench } };
	assert.deepEqual(legal(r), [14, 15, 17]);
	assert.deepEqual(legal(r, 'D'), [14, 17]);
});

/**
 * What the sim does with `choice` for `side`, tried on a copy of the battle: null if it rejects it, else
 * the action it queues. A locked move accepts `mega` and `zmove` and ignores them, so the effect counts.
 */
function effect(serialized: object, side: 0 | 1, choice: string) {
	const copy = State.deserializeBattle(structuredClone(serialized));
	const ok = copy.sides[side].choose(choice);
	const action = copy.sides[side].choice.actions[0];
	copy.destroy();
	if (!ok) return null;
	if (action.choice === 'instaswitch') return 'switch'; // a forced switch mid-turn
	if (action.choice !== 'move') return action.choice;
	return action.zmove ? 'zmove' : action.mega ? 'mega' : 'move';
}
/** The effect action `a` asks for. */
const intended = (r: Request, a: number) =>
	a >= 12 ? (r.teamPreview ? 'team' : 'switch') : ['move', 'mega', 'zmove'][a % 3];

test('forced switch mid-turn: the queued mon is masked, and the sim rejects it', () => {
	// Both players switch on turn 1. p1's Dragapult is faster, so Landorus-T comes in first and its
	// Intimidate sets off Great Tusk's Eject Pack while p2's switch to Diancie is still queued (T02).
	const p1 = 'Dragapult\nAbility: Infiltrator\n- Shadow Ball\n\nLandorus-Therian\nAbility: Intimidate\n- Earthquake';
	const p2 = 'Great Tusk @ Eject Pack\nAbility: Protosynthesis\n- Earthquake\n\nDiancie\nAbility: Clear Body\n- Diamond Storm\n\n' +
		'Garchomp\nAbility: Rough Skin\n- Earthquake';
	const teams: [string, string] = [Teams.pack(Teams.import(p1)), Teams.pack(Teams.import(p2))];
	const env = new Env({ worker: 0, battles: 1, seed: 0, pool: [], turnCap: 300, games: () => ({ seed: seedOf('eject'), teams }) });
	step(env, () => 12); // both lead with slot 1
	step(env, () => 13); // both switch to slot 2
	const { ints, n } = step(env, (i, mask) => {
		const d = env.decisions[i];
		assert.equal(d.side, 1);
		assert.equal(d.request.forceSwitch?.[0], true);
		assert.deepEqual([...mask.keys()].filter(a => mask[a]), [14]); // Garchomp; Diancie (13) is queued
		const saved = State.serializeBattle(d.slot.game.battle);
		assert.equal(effect(saved, 1, 'switch 2'), null);
		assert.equal(effect(saved, 1, 'switch 3'), 'switch');
		return 14;
	});
	assert.equal(n, 1);
	assert.equal(ints[3], KIND.switch);
	// Forcing out Great Tusk cancelled the queued switch, so Diancie can come in next turn.
	step(env, (i, mask) => {
		if (env.decisions[i].side === 1) assert.equal(mask[13], 1);
		return 0;
	});
	assert.equal(env.counts.invalid, 0);
});

test('on random games, the mask allows exactly the choices the sim carries out', () => {
	const env = new Env({ worker: 0, battles: 4, seed: 'mask-test', pool: POOL, turnCap: 300 });
	const rng = new PRNG(seedOf('mask-test-actions'));
	let decisions = 0;
	while (env.counts.games < 6) {
		const saved = new Map<Battle, object>();
		step(env, (i, mask) => {
			const d = env.decisions[i];
			const battle = d.slot.game.battle;
			if (!saved.has(battle)) saved.set(battle, State.serializeBattle(battle));
			for (let a = 0; a < 18; a++) {
				const did = effect(saved.get(battle)!, d.side, choiceOf(d.request, a));
				// A switch while maybe trapped is offered: the sim answers [Unavailable choice] with an updated request.
				if (mask[a] && did === null && a >= 12 && (d.request.active?.[0] as any)?.maybeTrapped) continue;
				assert.equal(!!mask[a], did === intended(d.request, a),
					`game ${d.slot.id} ${SIDES[d.side]} turn ${battle.turn}: action ${a} (${choiceOf(d.request, a)}) masked ${!mask[a]}, sim ${did}`);
			}
			decisions++;
			return randomLegal(mask, k => rng.random(k));
		});
	}
	assert.ok(decisions > 500, `${decisions} decisions`);
	assert.equal(env.counts.invalid, 0);
});
