// Integer ids for species and moves: every id in Showdown's Dex at the pin, sorted, from 2 up. 0 is an
// empty slot and 1 an id outside the vocab. The hash names the vocab, for checkpoints (plan.md, Versioning).
import { createHash } from 'node:crypto';
import { Dex, toID } from '../sim/showdown.ts';

export const NONE = 0;
export const UNKNOWN = 1;

function vocab(ids: string[]) {
	const sorted = [...new Set(ids)].sort();
	return { ids: sorted, index: new Map(sorted.map((id, i) => [id, i + 2])), size: sorted.length + 2 };
}

const species = vocab(Dex.species.all().map(s => s.id));
const moves = vocab(Dex.moves.all().map(m => m.id));

export const VOCAB = {
	species: species.size,
	moves: moves.size,
	hash: createHash('sha256').update(species.ids.join(',') + '|' + moves.ids.join(',')).digest('hex').slice(0, 16),
};

/** A species name or forme, as shown (`Zamazenta-*` is Zamazenta until it switches in). */
export const speciesId = (name: string) => species.index.get(toID(name)) ?? UNKNOWN;

/**
 * A request move id. Ids carry Hidden Power's type and power and Return's power (T08). The Dex has one
 * Hidden Power, so its type is dropped here.
 */
export const moveId = (id: string) =>
	moves.index.get(id.replace(/^(hiddenpower)[a-z]*\d*$|^(return|frustration)\d+$/, (_m, a, b) => a ?? b)) ?? UNKNOWN;
