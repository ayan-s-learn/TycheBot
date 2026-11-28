// The 288 damage calcs per decision (plan.md, Network v0: Damage calcs), on one player's tracked state.
// Own mons come from the player's request and tracker; opposing mons from the tracker. What the player
// can't see (opposing items, abilities and moves until revealed, and every spread) comes from the true sets.
// That leaks hidden information and is the walking skeleton's stand-in until the set library exists (D7).
// Fainted mons and status moves get no calcs (as T06 ran them), so their entries stay 0.
import { calculate, Field, Generations, Move, Pokemon, toID } from '@smogon/calc';
import type { Battle as Client } from '@pkmn/client';
import { Dex } from '../sim/showdown.ts';

type ClientPokemon = Client['p1']['team'][number];
type ClientSide = Client['p1'];
type Gen = ReturnType<typeof Generations.get>;
export const gen: Gen = Generations.get(9);

/** [direction][attacker][move][defender]: 0 = own mon i's move j against opposing mon k, 1 = opposing k's move j against own mon i. */
export const CALC_SHAPE = [2, 6, 4, 6] as const;
export const N_CALCS = 288;
/** A calc's value is its mean damage as a fraction of the defender's max HP, capped here. */
export const MAX_DAMAGE = 2;

/**
 * The calc's name for a Showdown species. Its gen 9 data lacks cosmetic formes (Vivillon-*, Alcremie-*),
 * which calc as their base species, and calls Aegislash Aegislash-Shield (T06).
 */
const speciesNames = new Map<string, string>([['Aegislash', 'Aegislash-Shield']]);
export function calcSpecies(name: string) {
	let out = speciesNames.get(name);
	if (out === undefined) {
		const species = Dex.species.get(name);
		out = gen.species.get(toID(name)) ? name : species.isCosmeticForme ? species.baseSpecies : '';
		if (!out || !gen.species.get(toID(out))) throw new Error(`no calc species for ${name}`);
		speciesNames.set(name, out);
	}
	return out;
}

/** A move id as a calc move name, or null for a status move. Request ids carry Hidden Power's type and Return's power (T08). */
export function moveName(id: string, hpType?: string): string | null {
	const hp = /^hiddenpower([a-z]*?)\d*$/.exec(id);
	if (hp) {
		const type = hp[1] || toID(hpType ?? '');
		if (!type) throw new Error(`Hidden Power without a type: ${id}`);
		return `Hidden Power ${type[0].toUpperCase()}${type.slice(1)}`;
	}
	const move = gen.moves.get(toID(id.replace(/^(return|frustration)\d+$/, '$1')));
	if (!move) throw new Error(`no calc move for ${id}`);
	return move.category === 'Status' ? null : move.name;
}

/** Everything a calc reads about one mon. `hp` is a fraction of max HP; `moves` are calc names, null for none. */
export interface MonState {
	species: string, level: number, gender: string, item?: string, ability?: string,
	nature: string, evs: StatsTable, ivs: StatsTable,
	boosts: { atk: number, def: number, spa: number, spd: number, spe: number },
	hp: number, status: string, abilityOn: boolean, boostedStat?: string, alliesFainted: number,
	moves: (string | null)[],
}
export interface SideState { reflect: boolean, lightScreen: boolean, auroraVeil: boolean }
/** Field-wide abilities an active mon has, as the calc's field flags take them (record version 2 sets them). */
export const FIELD_FLAGS = {
	'Beads of Ruin': 'isBeadsOfRuin', 'Sword of Ruin': 'isSwordOfRuin', 'Tablets of Ruin': 'isTabletsOfRuin',
	'Vessel of Ruin': 'isVesselOfRuin', 'Fairy Aura': 'isFairyAura', 'Dark Aura': 'isDarkAura', 'Aura Break': 'isAuraBreak',
} as const;
/** The field; `sides` is [own, opposing]. `abilities` lists the field-wide abilities in play (FIELD_FLAGS). */
export interface FieldState {
	weather?: string, terrain?: string, gravity: boolean, magicRoom: boolean, wonderRoom: boolean,
	sides: [SideState, SideState], abilities?: (keyof typeof FIELD_FLAGS)[],
}

interface Mon { state: MonState, options: any, key: string, obj?: Pokemon }

function mon(s: MonState): Mon {
	const options = {
		level: s.level, gender: s.gender, item: s.item, ability: s.ability, abilityOn: s.abilityOn,
		nature: s.nature, evs: s.evs, ivs: s.ivs, boosts: s.boosts, status: s.status,
		// The calc reads this only for Supreme Overlord.
		alliesFainted: toID(s.ability ?? '') === 'supremeoverlord' ? Math.min(5, s.alliesFainted) : 0,
		boostedStat: s.boostedStat,
	};
	const e = s.evs, iv = s.ivs, b = s.boosts;
	const key = [s.species, s.level, s.gender, s.item, s.ability, s.abilityOn, s.nature,
		e.hp, e.atk, e.def, e.spa, e.spd, e.spe, iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe,
		b.atk, b.def, b.spa, b.spd, b.spe, s.hp, s.status, options.alliesFainted, s.boostedStat].join(',');
	return { state: s, options, key };
}

function pokemon(m: Mon) {
	if (!m.obj) {
		m.obj = new Pokemon(gen, m.state.species, m.options);
		m.obj.originalCurHP = Math.max(1, Math.round(m.state.hp * m.obj.maxHP()));
	}
	return m.obj;
}

/** Mean damage over the rolls (summed over hits where the calc gives one array per hit). */
function meanDamage(d: number | number[] | number[][]): number {
	if (typeof d === 'number') return d;
	if (!d.length) return 0;
	if (typeof d[0] === 'number') return (d as number[]).reduce((a, b) => a + b, 0) / d.length;
	return (d as number[][]).reduce((a, hit) => a + meanDamage(hit), 0);
}

/** A tracked mon's HP as a fraction. The tracker holds 0/0 for a mon not yet seen, which is at full HP. */
export const hpOf = (p: ClientPokemon) => p.maxhp ? p.hp / p.maxhp : 1;

const boostsOf = (p: ClientPokemon) =>
	({ atk: p.boosts.atk ?? 0, def: p.boosts.def ?? 0, spa: p.boosts.spa ?? 0, spd: p.boosts.spd ?? 0, spe: p.boosts.spe ?? 0 });

export function trackedMon(p: ClientPokemon, species: string, item: string | undefined, ability: string | undefined,
	set: PokemonSet, moves: (string | null)[], alliesFainted: number): MonState {
	const v = p.volatiles;
	return {
		species: calcSpecies(species), level: p.level, gender: p.gender || 'N', item, ability,
		nature: set.nature || 'Serious', evs: set.evs, ivs: set.ivs, boosts: boostsOf(p),
		hp: hpOf(p), status: p.status ?? '', abilityOn: !!(v.flashfire || v.slowstart),
		boostedStat: (v.protosynthesis ?? v.quarkdrive)?.stat, alliesFainted, moves,
	};
}

export const sideState = (s: ClientSide): SideState => ({
	reflect: !!s.sideConditions.reflect, lightScreen: !!s.sideConditions.lightscreen, auroraVeil: !!s.sideConditions.auroraveil,
});

export interface RequestPokemon { ident: string, details: string, moves: string[], condition: string }
export interface Tally { calcs: number, hits: number }

/** One player's calcs over a game, with a cache keyed on every calc input (T06), kept for that game. */
export class Calcs {
	private cache = new Map<string, number>();
	private own: PokemonSet[];
	private opp: PokemonSet[];
	private tally: Tally;

	/** The player's true sets and the opponent's, each in team order. `tally` counts calcs and cache hits. */
	constructor(own: PokemonSet[], opp: PokemonSet[], tally: Tally = { calcs: 0, hits: 0 }) {
		this.own = own;
		this.opp = opp;
		this.tally = tally;
	}

	/** Writes the CALC_SHAPE array for the player's decision at `request` into `out` from `offset`. */
	run(client: Client, side: 'p1' | 'p2', request: { side: { pokemon: RequestPokemon[] } }, out: Float32Array, offset: number) {
		const ownSide = client[side], oppSide = ownSide.foe;
		const reqMons = request.side.pokemon;
		if (ownSide.team.length !== reqMons.length) throw new Error(`tracker has ${ownSide.team.length} own mons, request ${reqMons.length}`);
		const ownFainted = reqMons.filter(p => p.condition.endsWith(' fnt')).length;
		const oppFainted = oppSide.team.filter(p => p.fainted).length;

		// The tracker orders own mons as the request does.
		const own = reqMons.map((r, i): MonState | null => {
			if (r.condition.endsWith(' fnt')) return null;
			const p = ownSide.team[i];
			const set = this.own.find(s => (s.name || s.species) === p.name);
			if (!set) throw new Error(`no own set named ${p.name}`);
			return trackedMon(p, p.speciesForme, gen.items.get(p.item)?.name, gen.abilities.get(p.ability)?.name,
				set, r.moves.map(id => moveName(id, set.hpType)), ownFainted);
		});
		// The tracker orders opposing mons as Team Preview shows them, which is their team order.
		const opp = oppSide.team.map((p, k): MonState | null => {
			if (p.fainted) return null;
			const set = this.opp[k];
			if (Dex.species.get(p.speciesForme).baseSpecies !== Dex.species.get(set.species).baseSpecies) {
				throw new Error(`opposing mon ${k} is ${p.speciesForme}, its set ${set.species}`);
			}
			// A forme Team Preview hides (`Zamazenta-*`) is the set's until it switches in.
			const forme = p.speciesForme.endsWith('-*') ? set.species : p.speciesForme;
			// The item: tracked if revealed, none if known gone, else the set's.
			const item = p.item ? gen.items.get(p.item)?.name : p.lastItem ? undefined : set.item || undefined;
			// The ability: tracked if revealed; after a forme change (Mega Evolution), the calc's default
			// for the new forme; else the set's.
			const ability = p.ability ? gen.abilities.get(p.ability)?.name : forme !== set.species ? undefined : set.ability;
			return trackedMon(p, forme, item, ability, set, set.moves.map(m => moveName(toID(m), set.hpType)), oppFainted);
		});
		// The tracker names weather and terrain as the calc does ('Sand', 'Psychic').
		const f = client.field;
		this.compute(own, opp, {
			weather: f.weather, terrain: f.terrain,
			gravity: !!f.pseudoWeather.gravity, magicRoom: !!f.pseudoWeather.magicroom, wonderRoom: !!f.pseudoWeather.wonderroom,
			sides: [sideState(ownSide), sideState(oppSide)],
		}, out, offset);
	}

	/** The calcs between `own` and `opp` (null: fainted or empty), as `run` writes them. */
	compute(ownStates: (MonState | null)[], oppStates: (MonState | null)[], field: FieldState, out: Float32Array, offset: number) {
		out.fill(0, offset, offset + N_CALCS);
		const own = ownStates.map(s => s && mon(s)), opp = oppStates.map(s => s && mon(s));
		for (const dir of [0, 1] as const) {
			const [attackers, defenders] = dir === 0 ? [own, opp] : [opp, own];
			const a = field.sides[dir], d = field.sides[1 - dir];
			const fieldOpts = {
				gameType: 'Singles', weather: field.weather, terrain: field.terrain,
				isGravity: field.gravity, isMagicRoom: field.magicRoom, isWonderRoom: field.wonderRoom,
				attackerSide: { isReflect: a.reflect, isLightScreen: a.lightScreen, isAuroraVeil: a.auroraVeil },
				defenderSide: { isReflect: d.reflect, isLightScreen: d.lightScreen, isAuroraVeil: d.auroraVeil },
			} as { [k: string]: unknown };
			for (const ability of field.abilities ?? []) fieldOpts[FIELD_FLAGS[ability]] = true;
			const fieldKey = [field.weather, field.terrain, field.gravity, field.magicRoom, field.wonderRoom,
				a.reflect, a.lightScreen, a.auroraVeil, d.reflect, d.lightScreen, d.auroraVeil, field.abilities?.join('+')].join(',');
			let fieldObj: Field | undefined;
			for (const [ai, atk] of attackers.entries()) {
				if (!atk) continue;
				for (const [j, name] of atk.state.moves.entries()) {
					if (!name || j >= 4) continue;
					let move: Move | undefined;
					for (const [di, def] of defenders.entries()) {
						if (!def) continue;
						this.tally.calcs++;
						const key = `${atk.key}|${def.key}|${name}|${fieldKey}`;
						let value = this.cache.get(key);
						if (value !== undefined) {
							this.tally.hits++;
						} else {
							move ??= new Move(gen, name, { ability: atk.options.ability, item: atk.options.item, species: atk.state.species });
							fieldObj ??= new Field(fieldOpts as any);
							const defObj = pokemon(def);
							const result = calculate(gen, pokemon(atk), defObj, move, fieldObj);
							value = Math.min(MAX_DAMAGE, meanDamage(result.damage) / defObj.maxHP());
							this.cache.set(key, value);
						}
						// own i, move j, opp k: [0][i][j][k]; opp k, move j, own i: [1][k][j][i].
						out[offset + ((dir * 6 + ai) * 4 + j) * 6 + di] = value;
					}
				}
			}
		}
	}
}
