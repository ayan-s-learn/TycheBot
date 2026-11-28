// Record version 2's ids. Species and moves are version 1's (worker/skeleton/vocab.ts: 0 empty, 1 outside the
// vocab, ids from 2). Items and abilities: 0 none (or an empty slot), 1 outside the vocab, 2 not yet revealed, ids
// from 3. Types: 0 none, 1 outside the vocab, ids from 2. Each list is every id in Showdown's Dex at the pin,
// sorted. The hash names all five lists; the static tables (dex.ts) are keyed by it.
import { createHash } from 'node:crypto';
import { Dex, toID } from '../sim/showdown.ts';
import { MOVE_IDS, moveId, SPECIES_IDS, speciesId } from '../skeleton/vocab.ts';

export { moveId, speciesId };
export const NONE = 0;
export const OUTSIDE = 1;
export const UNREVEALED = 2;

function vocab(ids: string[], from: number) {
	const sorted = [...new Set(ids)].sort();
	return { ids: sorted, index: new Map(sorted.map((id, i) => [id, i + from])), size: sorted.length + from };
}

const items = vocab(Dex.items.all().map(i => i.id), 3);
const abilities = vocab(Dex.abilities.all().map(a => a.id), 3);
const types = vocab(Dex.types.all().map(t => t.id), 2);
export const ITEM_IDS: readonly string[] = items.ids;
export const ABILITY_IDS: readonly string[] = abilities.ids;
export const TYPE_IDS: readonly string[] = types.ids;

export const VOCAB2 = {
	species: SPECIES_IDS.length + 2,
	moves: MOVE_IDS.length + 2,
	items: items.size,
	abilities: abilities.size,
	types: types.size,
	hash: createHash('sha256')
		.update([SPECIES_IDS, MOVE_IDS, items.ids, abilities.ids, types.ids].map(l => l.join(',')).join('|'))
		.digest('hex').slice(0, 16),
};

/** An item's id, or NONE for no item. */
export const itemId = (name: string) => name ? items.index.get(toID(name)) ?? OUTSIDE : NONE;
export const abilityId = (name: string) => name ? abilities.index.get(toID(name)) ?? OUTSIDE : NONE;
export const typeId = (name: string) => name ? types.index.get(toID(name)) ?? OUTSIDE : NONE;
