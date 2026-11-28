// Record version 2: the first cut of Network v0's observation (plan.md, Network v0), one per decision, fixed size,
// every field 4-byte little-endian. Python's end (tyche/obs/record.py) holds the same layout, and each end refuses
// a version it doesn't know. docs/areas/env-workers.md documents every field. Change VERSION whenever a field or the
// meaning of its values changes (codes, list orders, axis order): the layout check catches only the first.
import type { FieldSpec } from '../skeleton/record.ts';

export const VERSION = 2;

/** `weather` holds the index + 1 of the tracker's weather name (0: none); `terrain` likewise. */
export const WEATHERS = ['Sun', 'Rain', 'Sand', 'Snow', 'Hail', 'Harsh Sunshine', 'Heavy Rain', 'Strong Winds'] as const;
export const TERRAINS = ['Electric', 'Grassy', 'Psychic', 'Misty'] as const;
/** The field-wide abilities, set when an active mon has one: the calcs read them as field flags (Network v0). */
export const FIELD_ABILITIES = [
	'Beads of Ruin', 'Sword of Ruin', 'Tablets of Ruin', 'Vessel of Ruin', 'Fairy Aura', 'Dark Aura', 'Aura Break',
] as const;
/** Durations are the tracker's turns left, its minimum and maximum (5 and 8 when the item extending it is unknown). */
export const FIELD_NUM = [
	'weatherMin', 'weatherMax', 'terrainMin', 'terrainMax', 'trickRoom', 'trickRoomMin', 'trickRoomMax',
	'gravity', 'magicRoom', 'wonderRoom', ...FIELD_ABILITIES,
] as const;
/** Hazards hold their layers. */
export const HAZARDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'] as const;
export const SCREENS = ['reflect', 'lightscreen', 'auroraveil', 'tailwind', 'safeguard', 'mist'] as const;
/** Per side, own then opposing. `megaUsed` and `zUsed`: the side has Mega Evolved or used a Z-Move this battle. */
export const SIDE_NUM = [
	...HAZARDS, ...SCREENS, ...SCREENS.map(s => `${s}Min`), ...SCREENS.map(s => `${s}Max`), 'megaUsed', 'zUsed',
] as const;
/**
 * Volatiles, 0/1 unless noted: `partiallytrapped` is any binding move's volatile, `fallen` the Supreme Overlord
 * count / 5, `stockpile` its layers / 3, `protosynthesis` and `quarkdrive` set while the boost is on.
 */
export const VOLATILES = [
	'substitute', 'leechseed', 'confusion', 'taunt', 'encore', 'torment', 'disable', 'yawn', 'perishsong', 'curse',
	'attract', 'focusenergy', 'magnetrise', 'aquaring', 'ingrain', 'healblock', 'embargo', 'smackdown', 'saltcure',
	'partiallytrapped', 'protosynthesis', 'quarkdrive', 'flashfire', 'slowstart', 'charge', 'typechange', 'roost',
	'protect', 'destinybond', 'endure', 'airballoon', 'itemremoved', 'fallen', 'transform', 'gastroacid', 'stockpile',
	'mustrecharge', 'noretreat', 'tarshot', 'octolock', 'glaiverush', 'throatchop', 'syrupbomb',
] as const;
/**
 * `canMega`: own active, the request's `canMegaEvo`; else the mon holds its Mega Stone (own: the request's item;
 * opposing: the revealed one) and its side hasn't Mega Evolved. `isMega`: its current forme is a Mega.
 * `holdsZ`: it holds a Z-Crystal (own: the request's item; opposing: revealed). `formeHidden`: opposing, still
 * shown as `-*`. `priorConfidence` and `noPrior`: opposing, the prior's confidence, and 1 if no library set is
 * consistent with what it has revealed (the prior then gives no calcs). Own mons hold 1 and 0.
 */
export const MON_FLAGS = ['canMega', 'isMega', 'holdsZ', 'formeHidden', 'priorConfidence', 'noPrior'] as const;
/**
 * Per move: `revealed` (own: 1; opposing: 1 if the protocol showed it, 0 if assumed from the prior), `pp` (the
 * fraction left; opposing: 1 - the tracker's PP used over the move's PP with PP Ups), `disabled` and `zEligible`
 * (own active: the request's; own bench: `zEligible` if it holds a matching Z-Crystal and its side hasn't used a Z).
 */
export const MOVE_NUM = ['revealed', 'pp', 'disabled', 'zEligible'] as const;

/** Event types, `type` = index + 1 (0: no event). Each lists the protocol messages it stands for. */
export const EVENTS: readonly [string, readonly string[]][] = [
	['turn', ['turn']], ['move', ['move']], ['switch', ['switch', 'drag', 'replace']], ['faint', ['faint']],
	['cant', ['cant']], ['damage', ['-damage']], ['heal', ['-heal']], ['sethp', ['-sethp']],
	['status', ['-status']], ['curestatus', ['-curestatus', '-cureteam']], ['boost', ['-boost']], ['unboost', ['-unboost']],
	['clearboost', ['-clearboost', '-clearallboost', '-clearpositiveboost', '-clearnegativeboost', '-setboost', '-swapboost', '-copyboost', '-invertboost']],
	['weather', ['-weather']], ['fieldstart', ['-fieldstart']], ['fieldend', ['-fieldend']],
	['sidestart', ['-sidestart']], ['sideend', ['-sideend']], ['swapsideconditions', ['-swapsideconditions']],
	['start', ['-start']], ['end', ['-end']], ['activate', ['-activate']], ['singleturn', ['-singleturn', '-singlemove']],
	['item', ['-item']], ['enditem', ['-enditem']], ['ability', ['-ability']], ['endability', ['-endability']],
	['formechange', ['detailschange', '-formechange']], ['transform', ['-transform']], ['mega', ['-mega']],
	['zpower', ['-zpower']], ['prepare', ['-prepare']], ['mustrecharge', ['-mustrecharge']],
	['crit', ['-crit']], ['supereffective', ['-supereffective']], ['resisted', ['-resisted']],
	['immune', ['-immune']], ['miss', ['-miss']], ['fail', ['-fail', '-block']], ['hitcount', ['-hitcount']],
];
/** An event's `side`: relative to the player. */
export const EVENT_SIDE = { own: 0, opposing: 1, none: 2 } as const;
/** An event's `kind` names the vocab its `id` is in. */
export const ID_KIND = { none: 0, species: 1, move: 2, item: 3, ability: 4 } as const;
export const N_EVENTS = 16;
/** Columns of `events`. `slot` is the mon's index in this record (0-11), or -1. `turn` is the turn it happened in. */
export const EVENT_COLS = ['type', 'side', 'slot', 'kind', 'id', 'turn'] as const;

/**
 * Own mons (0-5) are in the request's order (switch action j is own mon j), the active first once the battle
 * starts. Opposing mons (6-11) are the opposing active first, if there is one, then the rest in Team Preview
 * order; `oppSlot` gives each one's Team Preview slot. So calcs keep the opposing active in column 0.
 */
export const FIELDS: FieldSpec[] = [
	{ name: 'game', dtype: 'i4', shape: [] },
	{ name: 'side', dtype: 'i4', shape: [] },
	{ name: 'turn', dtype: 'i4', shape: [] }, // the tracker's turn
	{ name: 'kind', dtype: 'i4', shape: [] }, // KIND (worker/skeleton/record.ts)
	{ name: 'mask', dtype: 'i4', shape: [18] }, // as version 1: worker/skeleton/mask.ts
	{ name: 'oppSlot', dtype: 'i4', shape: [6] }, // Team Preview slot of opposing mon 6 + i; -1 for an empty slot
	{ name: 'weather', dtype: 'i4', shape: [] }, // WEATHERS
	{ name: 'terrain', dtype: 'i4', shape: [] }, // TERRAINS
	{ name: 'species', dtype: 'i4', shape: [12] }, // vocab.ts; opposing as shown, a hidden forme as its base species
	{ name: 'item', dtype: 'i4', shape: [12] }, // vocab.ts: NONE, OUTSIDE, UNREVEALED or an item
	{ name: 'ability', dtype: 'i4', shape: [12] },
	{ name: 'types', dtype: 'i4', shape: [12, 2] }, // the tracker's types as shown, 0 for a second type it lacks
	{ name: 'moves', dtype: 'i4', shape: [12, 4] }, // own: the request's; opposing: the prior set's (MOVE_NUM.revealed)
	{ name: 'status', dtype: 'i4', shape: [12] }, // STATUS (worker/skeleton/record.ts)
	{ name: 'events', dtype: 'i4', shape: [N_EVENTS, EVENT_COLS.length] }, // newest first; type 0 for none
	{ name: 'fieldNum', dtype: 'f4', shape: [FIELD_NUM.length] },
	{ name: 'sideNum', dtype: 'f4', shape: [2, SIDE_NUM.length] },
	{ name: 'hp', dtype: 'f4', shape: [12] }, // fraction of max HP (opposing: as the protocol shows it)
	{ name: 'fainted', dtype: 'f4', shape: [12] },
	{ name: 'active', dtype: 'f4', shape: [12] },
	{ name: 'boosts', dtype: 'f4', shape: [12, 7] }, // BOOSTS, in stages
	{ name: 'stats', dtype: 'f4', shape: [12, 6] }, // own: max HP then the request's atk def spa spd spe; opposing 0
	{ name: 'level', dtype: 'f4', shape: [12] },
	{ name: 'statusTurns', dtype: 'f4', shape: [12, 2] }, // the tracker's sleep and toxic turns
	{ name: 'volatiles', dtype: 'f4', shape: [12, VOLATILES.length] },
	{ name: 'monFlags', dtype: 'f4', shape: [12, MON_FLAGS.length] },
	{ name: 'moveNum', dtype: 'f4', shape: [12, 4, MOVE_NUM.length] },
	{ name: 'calcs', dtype: 'f4', shape: [2, 6, 4, 6] }, // as version 1, opposing mons in this record's order
	{ name: 'eventHp', dtype: 'f4', shape: [N_EVENTS] }, // HP change of the event's mon, as a fraction; boosts: stages
];

const size = (shape: number[]) => shape.reduce((a, b) => a * b, 1);

export const OFFSET: { [name: string]: number } = {};
let words = 0;
for (const f of FIELDS) {
	OFFSET[f.name] = words;
	words += size(f.shape);
}
export const RECORD_WORDS = words;
export const RECORD_BYTES = words * 4;

export const LAYOUT = {
	version: VERSION,
	recordBytes: RECORD_BYTES,
	fields: FIELDS.map(f => ({ ...f, offset: OFFSET[f.name] * 4 })),
};
