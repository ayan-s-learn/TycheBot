import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Calcs, calcSpecies, FIELD_FLAGS, type FieldState, hpOf, type MonState, moveName, N_CALCS } from '../calc/calcs.ts';
import { loadPool, SIDES, seedOf } from '../sim/battles.ts';
import { type Battle, PRNG, toID } from '../sim/showdown.ts';
import { randomLegal, step } from '../skeleton/drive.ts';
import { Env } from '../skeleton/env.ts';
import { Library, normalMove } from './prior.ts';
import { OFFSET, RECORD_WORDS } from './record.ts';

type SimPokemon = Battle['sides'][number]['pokemon'][number];
type SimSide = Battle['sides'][number];
const root = new URL('../../', import.meta.url).pathname;
const POOL = loadPool(root + 'data/pool/v1/teams.jsonl');
const LIBRARY = new Library(root + 'data/priors/v0/species_sets.json');
const WEATHER: { [id: string]: string } = {
	sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', desolateland: 'Harsh Sunshine',
	primordialsea: 'Heavy Rain', deltastream: 'Strong Winds',
};
const TERRAIN: { [id: string]: string } = {
	electricterrain: 'Electric', grassyterrain: 'Grassy', mistyterrain: 'Misty', psychicterrain: 'Psychic',
};
const simSide = (s: SimSide) => ({
	reflect: !!s.sideConditions.reflect, lightScreen: !!s.sideConditions.lightscreen, auroraVeil: !!s.sideConditions.auroraveil,
});
const sameSet = (a: PokemonSet, b: PokemonSet) => {
	const moves = (s: PokemonSet) => s.moves.map(m => normalMove(toID(m))).sort().join();
	const hp = (s: PokemonSet) => s.moves.some(m => toID(m).startsWith('hiddenpower')) ? toID(s.hpType ?? '') : '';
	return a.species === b.species && toID(a.item) === toID(b.item) && toID(a.ability) === toID(b.ability) && moves(a) === moves(b) &&
		(a.nature || 'Serious') === (b.nature || 'Serious') && JSON.stringify(a.evs) === JSON.stringify(b.evs) &&
		JSON.stringify(a.ivs) === JSON.stringify(b.ivs) && hp(a) === hp(b);
};

/**
 * The calcs on D7's prior, against @smogon/calc run on the prior set the builder chose for each opposing mon
 * (Builder.prior), with every input the player sees taken from the sim instead of the tracker.
 */
test('calcs on the prior match the calc run on the prior set, on the sim state', () => {
	const env = new Env({ worker: 1, battles: 4, seed: 'calc2-test', pool: POOL, turnCap: 300, record: 2, library: LIBRARY });
	const rng = new PRNG(seedOf('calc2-test-actions'));
	const expected = new Float32Array(N_CALCS);
	let calcs = 0, differ = 0, mons = 0, notTrue = 0;
	const last = new Map<string, boolean>();
	const examples: string[] = [];
	while (env.counts.games < 8) {
		step(env, (_i, mask) => randomLegal(mask, k => rng.random(k)), ({ ints, floats, n }) => {
			for (let i = 0; i < n; i++) {
				const d = env.decisions[i], b = i * RECORD_WORDS;
				const battle = d.slot.game.battle, builder = d.slot.players[d.side].builder!;
				const own = battle.sides[d.side], opp = battle.sides[1 - d.side];
				const tracked = builder.client[SIDES[1 - d.side]];
				const sim = (p: SimPokemon, species: string, item: string | undefined, ability: string | undefined, set: PokemonSet,
					hp: number, moves: (string | null)[]): MonState => {
					const v = p.volatiles, bo = p.boosts;
					return {
						species: calcSpecies(species), level: p.level, gender: p.gender || 'N', item, ability,
						nature: set.nature || 'Serious', evs: set.evs, ivs: set.ivs,
						boosts: { atk: bo.atk, def: bo.def, spa: bo.spa, spd: bo.spd, spe: bo.spe }, hp, status: p.status,
						abilityOn: !!(v.flashfire || v.slowstart), boostedStat: (v.protosynthesis ?? v.quarkdrive)?.bestStat,
						alliesFainted: p.side.pokemon.filter(q => q.fainted).length, moves,
					};
				};
				const ownStates = own.pokemon.map(p => p.fainted ? null :
					sim(p, p.species.name, p.getItem().name || undefined, p.getAbility().name || undefined, p.set, p.hp / p.maxhp,
						p.moves.map(id => moveName(id, p.hpType))));
				let oppAbility: string | undefined;
				const oppStates = [...ints.subarray(b + OFFSET.oppSlot, b + OFFSET.oppSlot + 6)].map((k, r) => {
					const set = d.slot.game.sets[1 - d.side][k];
					const p = opp.pokemon.find(q => q.set.name === set.name)!, c = tracked.team[k];
					const prior = builder.prior(k).prior.set;
					if (!prior) return null;
					const key = `${d.slot.id} ${d.side} ${k}`;
					if (!p.fainted) {
						mons++;
						const wrong = !sameSet(prior.set, set);
						notTrue += +wrong;
						last.set(key, wrong);
					}
					const ps = prior.set;
					const species = c.speciesForme.endsWith('-*') || p.species.name === ps.species ? ps.species : p.species.name;
					const item = c.item ? p.getItem().name || undefined : c.lastItem ? undefined : ps.item || undefined;
					const ability = c.ability ? p.getAbility().name : species !== ps.species ? undefined : ps.ability;
					if (r === 0 && p.isActive && !p.fainted) oppAbility = ability;
					if (p.fainted) return null;
					return sim(p, species, item, ability, ps, hpOf(c), ps.moves.map(m => moveName(toID(m), ps.hpType)));
				});
				const ownActive = own.active[0] && !own.active[0].fainted && !d.request.teamPreview ? own.active[0].getAbility().name : undefined;
				const field: FieldState = {
					weather: WEATHER[battle.field.weather], terrain: TERRAIN[battle.field.terrain],
					gravity: !!battle.field.pseudoWeather.gravity, magicRoom: !!battle.field.pseudoWeather.magicroom,
					wonderRoom: !!battle.field.pseudoWeather.wonderroom, sides: [simSide(own), simSide(opp)],
					abilities: (Object.keys(FIELD_FLAGS) as (keyof typeof FIELD_FLAGS)[]).filter(a => a === ownActive || a === oppAbility),
				};
				new Calcs([], []).compute(ownStates, oppStates, field, expected, 0);
				const got = floats.subarray(b + OFFSET.calcs, b + OFFSET.calcs + N_CALCS);
				for (let c = 0; c < N_CALCS; c++) {
					if (!expected[c] && !got[c]) continue;
					calcs++;
					if (Math.abs(expected[c] - got[c]) < 1e-6) continue;
					differ++;
					if (examples.length < 10) examples.push(`game ${d.slot.id} ${SIDES[d.side]} turn ${battle.turn} calc ${c}: sim ${expected[c]}, record ${got[c]}`);
				}
			}
		});
	}
	assert.ok(calcs > 50_000, `${calcs} calcs`);
	assert.ok(differ / calcs < 0.001, `${differ} of ${calcs} differ:\n${examples.join('\n')}`);
	const lastWrong = [...last.values()].filter(x => x).length;
	console.log(`${differ} of ${calcs} nonzero calcs differ; the prior set isn't the true set for ${notTrue} of ${mons} ` +
		`(opposing mon, decision) pairs (${(100 * notTrue / mons).toFixed(1)}%), and for ${lastWrong} of ${last.size} mons at their last decision`);
});
