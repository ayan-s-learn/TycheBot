// The hidden-content leak test (plan.md, Phase 1 exit: Leak tests), on record version 2. Its three parts:
// - the builder takes no opposing sets: its constructor's types (below, checked by tsc);
// - every record rebuilt from the logged player stream and requests, the player's own team and the library alone
//   is bit-identical to the env's;
// - paired games that differ only in hidden opposing content give bit-identical records until the player's
//   streams differ.
// The tensorizer's part (bit-identical records give bit-identical tensors) is tyche/obs/test_obs.py.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawGame, type GameSpec, loadPool, SIDES, seedOf } from '../sim/battles.ts';
import { Dex, PRNG, Teams, toID } from '../sim/showdown.ts';
import { randomLegal, step } from '../skeleton/drive.ts';
import { Env, type Slot } from '../skeleton/env.ts';
import { Builder, type Entry } from './builder.ts';
import { Library } from './prior.ts';
import { RECORD_WORDS } from './record.ts';

const root = new URL('../../', import.meta.url).pathname;
const POOL = loadPool(root + 'data/pool/v1/teams.jsonl');
const LIBRARY = new Library(root + 'data/priors/v0/species_sets.json');

// The constructor takes the side, the player's own sets, the library and a counter: no opposing sets.
export const _types = (own: PokemonSet[], opp: PokemonSet[]) => {
	// @ts-expect-error: there is no parameter for the opponent's sets.
	new Builder('p1', own, LIBRARY, undefined, opp);
};

/** Replays a builder's inputs into a fresh builder and returns the records it writes. */
function rebuild(side: 0 | 1, own: PokemonSet[], transcript: Entry[]) {
	const b = new Builder(SIDES[side], own, LIBRARY);
	const out: Int32Array[] = [];
	for (const e of transcript) {
		if (typeof e === 'string') {
			if (e.startsWith('|request|')) b.request(e);
			else b.line(e);
			continue;
		}
		const buf = new ArrayBuffer(RECORD_WORDS * 4);
		b.build(JSON.parse(e.request), e.queued, e.game, new Int32Array(buf), new Float32Array(buf), 0);
		out.push(new Int32Array(buf));
	}
	return out;
}
const same = (a: Int32Array, b: Int32Array) => Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;

/** Plays env to the end with actions drawn per (tag, side, nth decision of that side), so equal masks give equal actions. */
function play(env: Env, tag: string, records: Map<string, Int32Array[]>) {
	const nth = new Map<string, number>();
	while (env.slots.length) {
		step(env, (i, mask) => {
			const d = env.decisions[i], key = `${d.slot.id}/${d.side}`;
			const n = nth.get(key) ?? 0;
			nth.set(key, n + 1);
			return randomLegal(mask, k => new PRNG(seedOf(tag, d.slot.id, d.side, n)).random(k));
		}, ({ ints, n }) => {
			for (let i = 0; i < n; i++) {
				const d = env.decisions[i], key = `${d.slot.id}/${d.side}`;
				if (!records.has(key)) records.set(key, []);
				records.get(key)!.push(ints.slice(i * RECORD_WORDS, (i + 1) * RECORD_WORDS));
			}
		});
	}
}

test('every record rebuilds bit for bit from the player stream, own team and library (100 games)', () => {
	const records = new Map<string, Int32Array[]>();
	let games = 0, rebuilt = 0;
	const onEnd = (slot: Slot) => {
		for (const side of [0, 1] as const) {
			const key = `${slot.id}/${side}`;
			const got = rebuild(side, slot.game.sets[side], slot.players[side].builder!.transcript!);
			const want = records.get(key) ?? [];
			assert.equal(got.length, want.length, key);
			for (const [n, r] of got.entries()) assert.ok(same(r, want[n]), `${key}: decision ${n} differs`);
			rebuilt += got.length;
			records.delete(key);
		}
		games++;
	};
	const env = new Env({
		worker: 2, battles: 16, seed: 'leak-rebuild', pool: POOL, turnCap: 300, record: 2, library: LIBRARY, transcripts: true, onEnd,
		games: id => id < 100 ? drawGame(POOL, 'leak-rebuild', 2, id) : null,
	});
	play(env, 'leak-rebuild-actions', records);
	assert.equal(games, 100);
	assert.ok(rebuilt > 10_000, `${rebuilt}`);
	console.log(`rebuilt ${rebuilt} records of 100 games, all bit-identical`);
});

/** A change to one opposing set's hidden content, or null if the set doesn't allow it. */
type Variant = (s: PokemonSet) => boolean;
const swapEVs = (s: PokemonSet, a: StatID, b: StatID) => {
	if (s.evs[a] === s.evs[b]) return false;
	[s.evs[a], s.evs[b]] = [s.evs[b], s.evs[a]];
	return true;
};
const VARIANTS: { [name: string]: Variant } = {
	spread: s => swapEVs(s, 'atk', 'spa') || swapEVs(s, 'def', 'spd') || swapEVs(s, 'hp', 'spe'),
	nature: s => {
		s.nature = toID(s.nature) === 'hardy' ? 'Bashful' : 'Hardy';
		return true;
	},
	move: s => {
		const fresh = ['Protect', 'Rest', 'Substitute', 'Toxic'].find(m => !s.moves.map(toID).includes(toID(m)))!;
		s.moves[s.moves.length - 1] = fresh;
		return true;
	},
	item: s => {
		const item = Dex.items.get(s.item);
		if (item.megaStone || item.zMove) return false;
		s.item = item.id === 'leftovers' ? 'Heavy-Duty Boots' : 'Leftovers';
		return true;
	},
	ability: s => {
		const other = Object.values(Dex.species.get(s.species).abilities).find(a => toID(a) !== toID(s.ability));
		if (!other) return false;
		s.ability = other;
		return true;
	},
	hiddenPowerType: s => {
		const i = s.moves.findIndex(m => toID(m).startsWith('hiddenpower'));
		if (i < 0) return false;
		const type = toID(s.hpType) === 'fire' ? 'Grass' : 'Fire';
		s.moves[i] = `Hidden Power ${type}`;
		s.hpType = type;
		return true;
	},
	forme: s => {
		if (s.species !== 'Urshifu-Rapid-Strike') return false;
		s.species = 'Urshifu';
		s.moves = s.moves.map(m => toID(m) === 'surgingstrikes' ? 'Wicked Blow' : m);
		return true;
	},
};

test('paired games differing only in hidden opposing content give bit-identical records until the streams differ', () => {
	const report: string[] = [];
	for (const [name, variant] of Object.entries(VARIANTS)) {
		let pairs = 0, compared = 0, beyondTurn1 = 0;
		// p1 sees; p2's team gets the variant on one mon. Up to 6 pairs per variant, over the training teams.
		for (let t = 0; t < POOL.length && pairs < 6; t++) {
			const sets = Teams.unpack(POOL[t])!;
			for (let m = 0; m < sets.length && pairs < 6; m++) {
				const changed = Teams.unpack(POOL[t])!;
				if (!variant(changed[m])) continue;
				const p1 = POOL[(t * 7 + m + 3) % POOL.length];
				const specs: GameSpec[] = [POOL[t], Teams.pack(changed)].map(p2 => ({ seed: seedOf('leak-pair', name, pairs), teams: [p1, p2] }));
				const runs = specs.map(spec => {
					const records = new Map<string, Int32Array[]>();
					let transcript: Entry[] = [];
					const env = new Env({
						worker: 0, battles: 1, seed: 0, pool: [], turnCap: 300, record: 2, library: LIBRARY, transcripts: true,
						games: id => id === 0 ? spec : null, onEnd: slot => transcript = slot.players[0].builder!.transcript!,
					});
					play(env, `leak-pair-actions ${name} ${pairs}`, records);
					return { transcript, records: records.get('0/0')! };
				});
				const [a, b] = runs;
				let n = 0;
				for (let i = 0; i < a.transcript.length && i < b.transcript.length; i++) {
					const x = a.transcript[i], y = b.transcript[i];
					if (typeof x === 'string' || typeof y === 'string') {
						if (x !== y) break;
						continue;
					}
					assert.ok(same(a.records[n], b.records[n]), `${name} pair ${pairs}: decision ${n} differs with the streams equal`);
					if (JSON.parse(x.request).active) beyondTurn1 += +(a.records[n][2] > 1);
					n++;
				}
				compared += n;
				pairs++;
			}
		}
		assert.ok(pairs > 0, name);
		report.push(`${name}: ${pairs} pairs, ${compared} decisions compared, ${beyondTurn1} after turn 1`);
	}
	console.log(report.join('\n'));
});
