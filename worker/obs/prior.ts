// D7's species-level prior over an opposing mon's set, from T12's library (data/priors/<ver>/species_sets.json,
// docs/areas/team-pool.md): the first library set, in file order, consistent with what the protocol has revealed.
// While Team Preview hides a forme, every library key of its base species is consistent, and the consistent
// combination with the most summed weight across those keys is taken, then its first set.
import { readFileSync } from 'node:fs';
import { Dex, Teams, toID } from '../sim/showdown.ts';

/** A library set, with what consistency and the prior's confidence compare. */
export interface LibSet {
	key: string;
	/** The full set: EVs and IVs filled in as the sim fills them. */
	set: PokemonSet;
	item: string;
	ability: string;
	/** Move ids, Hidden Power without its type (normalMove). */
	moves: ReadonlySet<string>;
	/** The Mega forme its item makes of its species, or ''. */
	mega: string;
	weight: number;
	/** Its combination's summed weight (team-pool.md, species_sets.json). */
	comboWeight: number;
	combo: number;
}

/** What the protocol has shown of one opposing mon's starting set. Empty strings and lists: nothing shown. */
export interface Reveal {
	/** Library keys its shown species allows (Library.keysFor). */
	keys: readonly string[];
	/** The item it started with. */
	item: string;
	/** Its base ability: not a Mega's, nor one copied or swapped in. */
	ability: string;
	/** The Mega forme it Mega Evolved into. */
	mega: string;
	moves: readonly string[];
}

export interface Prior {
	/** null when no library set is consistent: the mon then gets no calcs (D7's 1760 fallback is left to later). */
	set: LibSet | null;
	/** The chosen combination's share of the consistent sets' weight; 0 with no set. */
	confidence: number;
}

/** A move id as consistency compares it: Hidden Power's type and Return's power dropped. */
export const normalMove = (id: string) => id.replace(/^(hiddenpower)[a-z]*\d*$|^(return|frustration)\d+$/, (_m, a, b) => a ?? b);

/** Protocol species the library files under another key (team-pool.md: Keys the protocol doesn't show). */
const ALIASES: { [shown: string]: string } = { Greninja: 'Greninja-Bond' };

export class Library {
	readonly path: string;
	readonly sets = new Map<string, LibSet[]>();
	private byBase = new Map<string, string[]>();
	private cache = new Map<string, Prior>();

	constructor(path: string) {
		this.path = path;
		const file = JSON.parse(readFileSync(path, 'utf8'));
		let combos = 0;
		for (const [key, entries] of Object.entries(file.species) as [string, any[]][]) {
			const comboOf = new Map<string, { n: number, weight: number }>();
			const sets: (LibSet & { comboKey: string })[] = entries.map(e => {
				const set = Teams.unpack(e.set)![0];
				set.evs = Object.assign({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, set.evs);
				set.ivs = Object.assign({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, set.ivs);
				const item = Dex.items.get(set.item);
				const mega = (item.megaStone as any)?.[Dex.species.get(set.species).baseSpecies] ?? '';
				const moves = new Set(set.moves.map(m => normalMove(toID(m))));
				// A Mega set's combination is keyed on the Mega's own ability (team-pool.md, species_sets.json).
				const comboAbility = mega ? Dex.species.get(mega).abilities[0] : set.ability;
				const comboKey = [e.statsSpecies, item.id, toID(comboAbility), [...moves].sort().join(',')].join('|');
				const c = comboOf.get(comboKey) ?? { n: combos++, weight: 0 };
				c.weight += e.weight;
				comboOf.set(comboKey, c);
				return { key, set, item: item.id, ability: toID(set.ability), moves, mega, weight: e.weight, comboWeight: 0, combo: c.n, comboKey };
			});
			for (const s of sets) s.comboWeight = comboOf.get(s.comboKey)!.weight;
			this.sets.set(key, sets);
			const base = toID(Dex.species.get(key).baseSpecies);
			this.byBase.set(base, [...(this.byBase.get(base) ?? []), key]);
		}
	}

	/**
	 * The library keys a species as the protocol shows it allows. `X-*` (a forme Team Preview hides): every key of
	 * base species X. A battle-only forme (a Mega, Palafin-Hero): the forme it changes from. Greninja: Greninja-Bond.
	 */
	keysFor(shown: string): string[] {
		if (shown.endsWith('-*')) return this.byBase.get(toID(shown.slice(0, -2))) ?? [];
		const species = Dex.species.get(shown);
		let name = typeof species.battleOnly === 'string' ? species.battleOnly : species.name;
		if (!this.sets.has(name) && ALIASES[name]) name = ALIASES[name];
		return this.sets.has(name) ? [name] : [];
	}

	static consistent(s: LibSet, r: Reveal) {
		return (!r.item || s.item === r.item) && (!r.ability || s.ability === r.ability) && (!r.mega || s.mega === r.mega) &&
			r.moves.every(m => s.moves.has(m));
	}

	/** D7's prior for a mon that has revealed `r`, with its confidence. */
	prior(r: Reveal): Prior {
		const sig = `${r.keys.join(',')}|${r.item}|${r.ability}|${r.mega}|${r.moves.join(',')}`;
		let out = this.cache.get(sig);
		if (out) return out;
		let best: LibSet | null = null, total = 0, n = 0;
		const consistent: LibSet[] = [];
		for (const key of r.keys) {
			for (const s of this.sets.get(key)!) {
				if (!Library.consistent(s, r)) continue;
				consistent.push(s);
				total += s.weight;
				n++;
				if (!best || s.comboWeight > best.comboWeight) best = s;
			}
		}
		let confidence = 0;
		if (best) {
			const same = consistent.filter(s => s.combo === best!.combo);
			// All of a species' weights 0 (none are in v0): draw uniformly, so the share is by count.
			confidence = total > 0 ? same.reduce((a, s) => a + s.weight, 0) / total : same.length / n;
		}
		out = { set: best, confidence };
		this.cache.set(sig, out);
		return out;
	}
}
