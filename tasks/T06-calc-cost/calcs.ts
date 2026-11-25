// Damage-calc inputs read from the sim's state, and the two per-decision calc sets of plan.md (Network v0):
// 'all' = every mon's moves against every opposing mon, both directions (≤ 6 × 4 × 6 × 2 = 288);
// 'active' = only the two active mons' moves against the six opposing mons (≤ 2 × 4 × 6 = 48).
// Fainted mons and status moves get no calcs. Opponents are at their true sets (the brief's stand-in for D7's prior).
import { createRequire } from 'node:module';
import type { Battle } from './sim.ts';
import { Dex } from './sim.ts';

type Calc = typeof import('../../node_modules/@smogon/calc/dist/index.js');
type SimPokemon = Battle['sides'][number]['pokemon'][number];
type SimSide = Battle['sides'][number];
type CalcPokemon = InstanceType<Calc['Pokemon']>;
type CalcMove = InstanceType<Calc['Move']>;
type CalcField = InstanceType<Calc['Field']>;

const require = createRequire(import.meta.url);
export const calc: Calc = require('../../node_modules/@smogon/calc/dist/index.js');
export const gen = calc.Generations.get(9);

/**
 * The calc's name for a Showdown species. The calc's gen 9 data has no cosmetic formes (Vivillon-*,
 * Alcremie-*, …; support.ts lists them), and they calc as their base species. Aegislash is the only
 * other NatDex-legal species it names differently (support.ts).
 */
const speciesNames = new Map<string, string>([['Aegislash', 'Aegislash-Shield']]);
export function calcSpecies(name: string) {
	let out = speciesNames.get(name);
	if (out === undefined) {
		const species = Dex.species.get(name);
		out = gen.species.get(calc.toID(name)) ? name : species.isCosmeticForme ? species.baseSpecies : '';
		if (!out || !gen.species.get(calc.toID(out))) throw new Error(`no calc species for ${name}`);
		speciesNames.set(name, out);
	}
	return out;
}

const WEATHER: { [id: string]: string } = {
	sunnyday: 'Sun', raindance: 'Rain', sandstorm: 'Sand', snowscape: 'Snow', hail: 'Hail',
	desolateland: 'Harsh Sunshine', primordialsea: 'Heavy Rain', deltastream: 'Strong Winds',
};
const TERRAIN: { [id: string]: string } = {
	electricterrain: 'Electric', grassyterrain: 'Grassy', mistyterrain: 'Misty', psychicterrain: 'Psychic',
};

/** A mon's calc inputs, and a key holding every one of them. */
export interface Mon { species: string, options: any, key: string, moves: string[], sim: SimPokemon }

export function readMon(p: SimPokemon): Mon {
	const v = p.volatiles;
	const b = p.boosts;
	const boosted = (v.protosynthesis ?? v.quarkdrive)?.bestStat;
	const options = {
		level: p.level,
		gender: p.gender || 'N',
		ability: p.getAbility().name,
		abilityOn: !!(v.flashfire || v.slowstart),
		item: p.getItem().name || undefined,
		nature: p.set.nature || 'Serious',
		evs: p.set.evs,
		ivs: p.set.ivs,
		boosts: { atk: b.atk, def: b.def, spa: b.spa, spd: b.spd, spe: b.spe },
		curHP: p.hp,
		status: p.status,
		// The calc reads this only for Supreme Overlord, which counts fainted allies once, on switch-in.
		alliesFainted: p.ability !== 'supremeoverlord' ? 0 :
			p.isActive ? (p.abilityState.fallen ?? 0) : Math.min(5, p.side.totalFainted),
		boostedStat: boosted,
	};
	const species = calcSpecies(p.species.name);
	const e = p.set.evs, iv = p.set.ivs;
	const key = [
		species, options.level, options.gender, options.ability, options.abilityOn, options.item, options.nature,
		e.hp, e.atk, e.def, e.spa, e.spd, e.spe, iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe,
		b.atk, b.def, b.spa, b.spd, b.spe, options.curHP, options.status, options.alliesFainted, boosted,
	].join(',');
	const moves = [];
	for (const slot of p.moveSlots) {
		const move = Dex.moves.get(slot.id);
		if (move.category === 'Status') continue;
		moves.push(slot.id === 'hiddenpower' ? `Hidden Power ${p.hpType}` : move.name);
	}
	return { species, options, key, moves, sim: p };
}

function readSide(s: SimSide) {
	const c = s.sideConditions;
	return { isReflect: !!c.reflect, isLightScreen: !!c.lightscreen, isAuroraVeil: !!c.auroraveil };
}

/** The field as `atk`'s side attacking `def`'s side. */
export function readField(battle: Battle, atk: SimSide, def: SimSide) {
	const pw = battle.field.pseudoWeather;
	const options = {
		gameType: 'Singles' as const,
		weather: WEATHER[battle.field.weather] as any,
		terrain: TERRAIN[battle.field.terrain] as any,
		isGravity: !!pw.gravity, isMagicRoom: !!pw.magicroom, isWonderRoom: !!pw.wonderroom,
		attackerSide: readSide(atk), defenderSide: readSide(def),
	};
	const a = options.attackerSide, d = options.defenderSide;
	const key = [options.weather, options.terrain, options.isGravity, options.isMagicRoom, options.isWonderRoom,
		a.isReflect, a.isLightScreen, a.isAuroraVeil, d.isReflect, d.isLightScreen, d.isAuroraVeil].join(',');
	return { options, key };
}

export const makePokemon = (m: Mon): CalcPokemon => new calc.Pokemon(gen, m.species, m.options);
export const makeMove = (m: Mon, name: string, useZ = false): CalcMove =>
	new calc.Move(gen, name, { ability: m.options.ability, item: m.options.item, species: m.species, useZ });

export type Mode = 'all' | 'active';
export interface Tally { decisions: number, calcs: number, hits: number }
export const newTally = (): Tally => ({ decisions: 0, calcs: 0, hits: 0 });

/**
 * Runs one decision's calc set for player `side`. With `cache`, a calc whose key (both mons', the move's
 * and the field's inputs) was seen before in this cache is a hit and isn't recomputed; calc objects are
 * built only for misses.
 */
export function runDecision(battle: Battle, side: 0 | 1, mode: Mode, tally: Tally, cache?: Map<string, number[]>) {
	const own = battle.sides[side], opp = battle.sides[1 - side];
	const ownMons = own.pokemon.filter(p => !p.fainted).map(readMon);
	const oppMons = opp.pokemon.filter(p => !p.fainted).map(readMon);
	const isActive = (m: Mon) => m.sim.isActive;
	tally.decisions++;
	for (const [attackers, defenders, atkSide, defSide] of [
		[ownMons, oppMons, own, opp], [oppMons, ownMons, opp, own],
	] as const) {
		const field = readField(battle, atkSide, defSide);
		let fieldObj: CalcField | undefined;
		const defObjs = new Map<Mon, CalcPokemon>();
		for (const a of mode === 'all' ? attackers : attackers.filter(isActive)) {
			let atkObj: CalcPokemon | undefined;
			for (const moveName of a.moves) {
				let moveObj: CalcMove | undefined;
				for (const d of defenders) {
					tally.calcs++;
					let key = '';
					if (cache) {
						key = `${a.key}|${d.key}|${moveName}|${field.key}`;
						if (cache.has(key)) {
							tally.hits++;
							continue;
						}
					}
					atkObj ??= makePokemon(a);
					moveObj ??= makeMove(a, moveName);
					fieldObj ??= new calc.Field(field.options);
					let defObj = defObjs.get(d);
					if (!defObj) defObjs.set(d, defObj = makePokemon(d));
					const damage = calc.calculate(gen, atkObj, defObj, moveObj, fieldObj).damage;
					cache?.set(key, damage as number[]);
				}
			}
		}
	}
}
