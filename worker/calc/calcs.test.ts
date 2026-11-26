import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPool, SIDES, seedOf } from '../sim/battles.ts';
import { type Battle, PRNG } from '../sim/showdown.ts';
import { randomLegal, step } from '../skeleton/drive.ts';
import { Env } from '../skeleton/env.ts';
import { OFFSET, RECORD_WORDS } from '../skeleton/record.ts';
import { Calcs, calcSpecies, type FieldState, type MonState, moveName, N_CALCS } from './calcs.ts';

type SimPokemon = Battle['sides'][number]['pokemon'][number];
type SimSide = Battle['sides'][number];
const POOL = loadPool(new URL('../../data/pool/v0/teams.jsonl', import.meta.url).pathname);
const WEATHER: { [id: string]: string } = {
	sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', desolateland: 'Harsh Sunshine',
	primordialsea: 'Heavy Rain', deltastream: 'Strong Winds',
};
const TERRAIN: { [id: string]: string } = {
	electricterrain: 'Electric', grassyterrain: 'Grassy', mistyterrain: 'Misty', psychicterrain: 'Psychic',
};

/** A mon's calc inputs from the sim's own state: the true values the tracker stands in for. */
function simMon(p: SimPokemon, moves: (string | null)[]): MonState | null {
	if (p.fainted) return null;
	const v = p.volatiles, b = p.boosts;
	return {
		species: calcSpecies(p.species.name), level: p.level, gender: p.gender || 'N',
		item: p.getItem().name || undefined, ability: p.getAbility().name || undefined,
		nature: p.set.nature || 'Serious', evs: p.set.evs, ivs: p.set.ivs,
		boosts: { atk: b.atk, def: b.def, spa: b.spa, spd: b.spd, spe: b.spe },
		hp: p.hp / p.maxhp, status: p.status, abilityOn: !!(v.flashfire || v.slowstart),
		boostedStat: (v.protosynthesis ?? v.quarkdrive)?.bestStat,
		alliesFainted: p.side.pokemon.filter(q => q.fainted).length, moves,
	};
}
const simSide = (s: SimSide) => ({
	reflect: !!s.sideConditions.reflect, lightScreen: !!s.sideConditions.lightscreen, auroraVeil: !!s.sideConditions.auroraveil,
});

test('calcs on the tracked state match calcs on the sim state', () => {
	const env = new Env({ worker: 0, battles: 4, seed: 'calc-test', pool: POOL, turnCap: 300 });
	const rng = new PRNG(seedOf('calc-test-actions'));
	const expected = new Float32Array(N_CALCS);
	let calcs = 0, differ = 0;
	const examples: string[] = [];
	while (env.counts.games < 8) {
		step(env, (_i, mask) => randomLegal(mask, k => rng.random(k)), ({ floats, n }) => {
			for (let i = 0; i < n; i++) {
				const d = env.decisions[i];
				const battle = d.slot.game.battle;
				const own = battle.sides[d.side], opp = battle.sides[1 - d.side];
				// Own mons in the request's order, which is the sim's current order; opposing mons in team order.
				const ownStates = own.pokemon.map(p => simMon(p, p.moves.map(id => moveName(id, p.hpType))));
				const oppStates = d.slot.game.sets[1 - d.side].map(set => {
					const p = opp.pokemon.find(q => q.set.name === set.name)!;
					return simMon(p, p.set.moves.map(m => moveName(m.toLowerCase().replace(/[^a-z0-9]/g, ''), p.hpType)));
				});
				const field: FieldState = {
					weather: WEATHER[battle.field.weather], terrain: TERRAIN[battle.field.terrain],
					gravity: !!battle.field.pseudoWeather.gravity, magicRoom: !!battle.field.pseudoWeather.magicroom,
					wonderRoom: !!battle.field.pseudoWeather.wonderroom, sides: [simSide(own), simSide(opp)],
				};
				new Calcs([], []).compute(ownStates, oppStates, field, expected, 0);
				const got = floats.subarray(i * RECORD_WORDS + OFFSET.calcs, i * RECORD_WORDS + OFFSET.calcs + N_CALCS);
				for (let c = 0; c < N_CALCS; c++) {
					if (!expected[c] && !got[c]) continue;
					calcs++;
					if (Math.abs(expected[c] - got[c]) < 1e-6) continue;
					differ++;
					if (examples.length < 10) {
						examples.push(`game ${d.slot.id} ${SIDES[d.side]} turn ${battle.turn} calc ${c}: sim ${expected[c]}, tracked ${got[c]}`);
					}
				}
			}
		});
	}
	assert.ok(calcs > 50_000, `${calcs} calcs`);
	assert.ok(differ / calcs < 0.001, `${differ} of ${calcs} differ:\n${examples.join('\n')}`);
	console.log(`${differ} of ${calcs} nonzero calcs differ`);
});
