// Record version 2's static dex tables (plan.md, Network v0: Static dex features), exported from Showdown's Dex
// at the pin and keyed by the vocab ids (vocab.ts). Row i of a table is id i; rows for the reserved ids are 0.
// The tensorizer (tyche/obs/tensor.py) reads them from tyche/obs/dex/<vocab hash>.json, which this writes:
//   node worker/obs/dex.ts
import { writeFileSync } from 'node:fs';
import { Dex } from '../sim/showdown.ts';
import { PIN } from '../sim/showdown.ts';
import { MOVE_IDS, SPECIES_IDS } from '../skeleton/vocab.ts';
import { typeId, VOCAB2 } from './vocab.ts';

export const SPECIES_COLUMNS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'type1', 'type2'] as const;
const STATUSES = ['brn', 'par', 'slp', 'frz', 'psn', 'tox'] as const;
const BOOSTS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const;
const FLAGS = ['contact', 'sound', 'punch', 'bite', 'slicing', 'bullet', 'pulse', 'wind', 'powder', 'protect', 'bypasssub', 'heal'] as const;
const HAZARDS = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb'] as const;
const REMOVAL = new Set(['rapidspin', 'defog', 'tidyup', 'mortalspin', 'courtchange']);
/**
 * Per move. `accuracy` is a fraction, 1 for a move that can't miss. `category`: 0 physical, 1 special, 2 status.
 * Status inflicted and boosts are expected values: a secondary effect counts at its chance. `heal` is the
 * fraction of max HP healed (Wish's included), `drain` and `recoil` fractions of damage dealt.
 */
export const MOVE_COLUMNS = [
	'basePower', 'accuracy', 'type', 'category', 'priority', 'pp', ...FLAGS.map(f => `flag:${f}`),
	...HAZARDS.map(h => `sets:${h}`), 'removesHazards', 'selfSwitch', 'forceSwitch', ...STATUSES.map(s => `status:${s}`),
	'confusion', 'flinch', 'heal', 'drain', 'recoil', ...BOOSTS.map(b => `self:${b}`), ...BOOSTS.map(b => `target:${b}`),
	'hits', 'critRatio', 'ohko', 'isZ', 'setsWeather', 'setsTerrain', 'protects',
] as const;

function moveRow(id: string): number[] {
	const m = Dex.moves.get(id);
	const row = new Map<string, number>();
	row.set('basePower', m.basePower);
	row.set('accuracy', m.accuracy === true ? 1 : m.accuracy / 100);
	row.set('type', typeId(m.type));
	row.set('category', m.category === 'Physical' ? 0 : m.category === 'Special' ? 1 : 2);
	row.set('priority', m.priority);
	row.set('pp', m.pp);
	for (const f of FLAGS) row.set(`flag:${f}`, +!!(m.flags as any)[f]);
	if (m.sideCondition && (HAZARDS as readonly string[]).includes(m.sideCondition)) row.set(`sets:${m.sideCondition}`, 1);
	row.set('removesHazards', +REMOVAL.has(m.id));
	row.set('selfSwitch', +!!m.selfSwitch);
	row.set('forceSwitch', +!!m.forceSwitch);
	const add = (k: string, v: number) => row.set(k, (row.get(k) ?? 0) + v);
	if (m.status) add(`status:${m.status}`, 1);
	if (m.volatileStatus === 'confusion') add('confusion', 1);
	const toSelf = m.target === 'self' || m.target === 'adjacentAllyOrSelf' || m.target === 'allySide' || m.target === 'allies';
	for (const [b, v] of Object.entries(m.boosts ?? {})) add(`${toSelf ? 'self' : 'target'}:${b}`, v as number);
	for (const [b, v] of Object.entries(m.self?.boosts ?? {})) add(`self:${b}`, v as number);
	for (const [b, v] of Object.entries(m.selfBoost?.boosts ?? {})) add(`self:${b}`, v as number);
	for (const s of m.secondaries ?? []) {
		const p = (s.chance ?? 100) / 100;
		if (s.status) add(`status:${s.status}`, p);
		if (s.volatileStatus === 'confusion') add('confusion', p);
		if (s.volatileStatus === 'flinch') add('flinch', p);
		for (const [b, v] of Object.entries(s.boosts ?? {})) add(`target:${b}`, p * (v as number));
		for (const [b, v] of Object.entries(s.self?.boosts ?? {})) add(`self:${b}`, p * (v as number));
	}
	row.set('heal', m.heal ? m.heal[0] / m.heal[1] : m.id === 'wish' ? 0.5 : 0);
	row.set('drain', m.drain ? m.drain[0] / m.drain[1] : 0);
	row.set('recoil', m.recoil ? m.recoil[0] / m.recoil[1] : m.mindBlownRecoil ? 0.5 : 0);
	row.set('hits', Array.isArray(m.multihit) ? (m.multihit[0] + m.multihit[1]) / 2 : m.multihit ?? 1);
	row.set('critRatio', m.critRatio ?? 1);
	row.set('ohko', +!!m.ohko);
	row.set('isZ', +!!m.isZ);
	row.set('setsWeather', +!!m.weather);
	row.set('setsTerrain', +!!m.terrain);
	row.set('protects', +(m.stallingMove === true));
	for (const k of row.keys()) if (!(MOVE_COLUMNS as readonly string[]).includes(k)) throw new Error(`${id}: column ${k}`);
	return MOVE_COLUMNS.map(c => row.get(c) ?? 0);
}

function speciesRow(id: string): number[] {
	const s = Dex.species.get(id);
	const b = s.baseStats;
	return [b.hp, b.atk, b.def, b.spa, b.spd, b.spe, typeId(s.types[0]), typeId(s.types[1] ?? '')];
}

/** The tables, with the vocab they are keyed by. */
export function dexTables() {
	const pad = (n: number, width: number) => Array.from({ length: n }, () => new Array(width).fill(0));
	return {
		hash: VOCAB2.hash, pin: PIN, vocab: VOCAB2,
		species: { columns: SPECIES_COLUMNS, rows: [...pad(2, SPECIES_COLUMNS.length), ...SPECIES_IDS.map(speciesRow)] },
		moves: { columns: MOVE_COLUMNS, rows: [...pad(2, MOVE_COLUMNS.length), ...MOVE_IDS.map(moveRow)] },
	};
}

export const DEX_PATH = new URL(`../../tyche/obs/dex/${VOCAB2.hash}.json`, import.meta.url).pathname;

if (import.meta.main) {
	writeFileSync(DEX_PATH, JSON.stringify(dexTables()) + '\n');
	console.log(DEX_PATH);
}
