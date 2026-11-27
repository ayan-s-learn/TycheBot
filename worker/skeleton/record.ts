// The skeleton's record: one per decision, fixed size, every field 4-byte little-endian. Python's end
// (tyche/transport/record.py) holds the same layout, and each end refuses a version it doesn't know.
// docs/areas/env-workers.md documents it. Change VERSION whenever a field or the meaning of its values changes
// (codes, action indices, axis order): the layout check catches only the first.

export const VERSION = 1;

export interface FieldSpec { name: string, dtype: 'i4' | 'f4', shape: number[] }

/**
 * Own mons are in the request's order (switch action j is own mon j); opposing mons in Team Preview order.
 * Mons are indexed 0-5 own, 6-11 opposing, where a field has 12 entries.
 */
export const FIELDS: FieldSpec[] = [
	{ name: 'game', dtype: 'i4', shape: [] }, // the worker's game counter
	{ name: 'side', dtype: 'i4', shape: [] }, // 0 = p1, 1 = p2
	{ name: 'turn', dtype: 'i4', shape: [] },
	{ name: 'kind', dtype: 'i4', shape: [] }, // KIND
	{ name: 'species', dtype: 'i4', shape: [12] }, // vocab.ts
	{ name: 'moves', dtype: 'i4', shape: [6, 4] }, // own mons' moves, in their request order; vocab.ts
	{ name: 'status', dtype: 'i4', shape: [12] }, // STATUS
	{ name: 'mask', dtype: 'i4', shape: [18] }, // 1 = legal: mask.ts
	{ name: 'hp', dtype: 'f4', shape: [12] }, // fraction of max HP (opposing: as the protocol shows it)
	{ name: 'fainted', dtype: 'f4', shape: [12] },
	{ name: 'active', dtype: 'f4', shape: [12] },
	{ name: 'boosts', dtype: 'f4', shape: [12, 7] }, // atk def spa spd spe accuracy evasion, in stages
	{ name: 'calcs', dtype: 'f4', shape: [2, 6, 4, 6] }, // worker/calc/calcs.ts
];

export const KIND = { preview: 0, move: 1, switch: 2 } as const;
export const STATUS: { [s: string]: number } = { brn: 1, par: 2, slp: 3, frz: 4, psn: 5, tox: 6 };
export const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const;

const size = (shape: number[]) => shape.reduce((a, b) => a * b, 1);

/** Each field's offset in 4-byte words from the record's start. */
export const OFFSET: { [name: string]: number } = {};
let words = 0;
for (const f of FIELDS) {
	OFFSET[f.name] = words;
	words += size(f.shape);
}
export const RECORD_WORDS = words;
export const RECORD_BYTES = words * 4;

/** The layout as the hello frame sends it, with byte offsets. */
export const LAYOUT = {
	version: VERSION,
	recordBytes: RECORD_BYTES,
	fields: FIELDS.map(f => ({ ...f, offset: OFFSET[f.name] * 4 })),
};
