// Scenario harness: drives Showdown's Battle directly with chosen inputs, feeds each player's chunks to
// @pkmn/client (T08's NatDex Generations), and compares against the sim after every turn.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Battle as Client } from '@pkmn/client';
import { generations } from '../pkmn.ts';

const require = createRequire(import.meta.url);
const dist = '../../../vendor/pokemon-showdown/dist/';
const { Teams } = require(dist + 'sim/index.js');
const { Battle } = require(dist + 'sim/battle.js');
const { extractChannelMessages } = require(dist + 'sim/battle.js');

export const gens = generations('natdex');
export const team = (txt: string) => Teams.pack(Teams.import(txt.trim().replace(/^[ \t]+/gm, '')));
export type Step = [string | null, string | null];

export interface Run {
	b: any; chunks: [string[], string[]]; clients: [Client, Client]; marks: [number, number][]; errors: string[];
	req: [any, any];
}

export function start(t1: string, t2: string, seed = 1, formatid = 'gen9nationaldex', mkClient?: (side: 'p1' | 'p2') => Client): Run {
	const chunks: [string[], string[]] = [[], []];
	const req: [any, any] = [null, null];
	const clients: [Client, Client] = [mkClient ? mkClient('p1') : new Client(gens, 'p1' as any), mkClient ? mkClient('p2') : new Client(gens, 'p2' as any)];
	const errors: string[] = [];
	const run: Run = { b: null, chunks, clients, marks: [], errors, req };
	const fed = [0, 0];
	const feedAll = () => {
		for (const i of [0, 1]) {
			for (; fed[i] < chunks[i].length; fed[i]++) {
				const c = chunks[i][fed[i]];
				if (c.startsWith('|error|')) { errors.push(`p${i + 1} ${c}`); continue; }
				for (const l of c.split('\n')) {
					if (!l.startsWith('|')) continue;
					try { clients[i].add(l); } catch (e) { errors.push(`p${i + 1} THROW on ${l}: ${(e as Error).message.split('\n')[0]}`); }
				}
			}
		}
	};
	(run as any).feedAll = feedAll;
	const b = new Battle({
		formatid, seed: `sodium,${seed.toString(16).padStart(64, '0')}`,
		send: (type: string, data: any) => {
			const text = Array.isArray(data) ? data.join('\n') : data;
			if (type === 'update') {
				const ch = extractChannelMessages(text, [1, 2]);
				chunks[0].push(ch[1].join('\n')); chunks[1].push(ch[2].join('\n'));
			} else if (type === 'sideupdate') {
				const i = text.startsWith('p1\n') ? 0 : 1;
				const m = text.slice(3);
				chunks[i].push(m);
				if (m.startsWith('|request|')) req[i] = JSON.parse(m.slice(9));
			}
		},
	});
	b.setPlayer('p1', { name: 'P1', team: t1 });
	b.setPlayer('p2', { name: 'P2', team: t2 });
	b.sendUpdates();
	run.b = b;
	feedAll();
	return run;
}

export function go(r: Run, ...steps: Step[]) {
	for (const [a, c] of steps) {
		if (a) r.b.choose('p1', a);
		if (c) r.b.choose('p2', c);
		r.b.sendUpdates();
		(r as any).feedAll();
		r.marks.push([r.chunks[0].length, r.chunks[1].length]);
	}
}

const sid = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Prints what the player's client holds against the sim, for the side `me` ('p1'|'p2'). */
export function show(r: Run, me: 'p1' | 'p2', opts: { own?: boolean } = {}) {
	const c = r.clients[me === 'p1' ? 0 : 1];
	const out: string[] = [];
	const fmt = (p: any) => `${p.name}[${p.speciesForme}] hp=${p.hp}/${p.maxhp} st=${p.status ?? ''}${p.fainted ? ' FNT' : ''} item=${p.item || (p.lastItem ? `(was ${p.lastItem})` : '?')} abil=${p.ability || '?'} base=${p.baseAbility || '?'} tera=${p.terastallized || ''} boosts=${JSON.stringify(Object.fromEntries(Object.entries(p.boosts).filter(([, v]) => v)))} vol=[${Object.keys(p.volatiles).join(',')}] moves=[${p.moveSlots.map((m: any) => m.id + (m.virtual === undefined ? '' : m.virtual ? '~' : '')).join(',')}]`;
	for (const [label, side] of [['own', c[me]], ['opp', c[me].foe]] as const) {
		if (label === 'own' && !opts.own) continue;
		out.push(`  ${me}.${label} conds=${JSON.stringify(Object.fromEntries(Object.entries(side.sideConditions).map(([k, v]: any) => [k, v.level])))} active=${side.active.map((p: any) => p?.name).join('/')}`);
		for (const p of side.team) out.push('    ' + fmt(p));
	}
	return out.join('\n');
}

export function simShow(r: Run, side: 'p1' | 'p2') {
	const s = r.b.sides[side === 'p1' ? 0 : 1];
	const out = [`  SIM ${side} conds=${JSON.stringify(Object.keys(s.sideConditions))} slotconds=${JSON.stringify(s.slotConditions.flatMap((x: any) => Object.keys(x)))}`];
	for (const p of s.pokemon) {
		out.push(`    ${p.name}[${p.species.name}${p.illusion ? ' as ' + p.illusion.name : ''}] hp=${p.hp}/${p.maxhp} st=${p.status}${p.fainted ? ' FNT' : ''} item=${p.item || ''} abil=${p.ability} base=${p.baseAbility} tera=${p.terastallized || ''} boosts=${JSON.stringify(Object.fromEntries(Object.entries(p.boosts).filter(([, v]) => v)))} vol=[${Object.keys(p.volatiles).join(',')}] moves=[${p.moveSlots.map((m: any) => m.id).join(',')}]`);
	}
	return out.join('\n');
}

export function dump(name: string, r: Run) {
	mkdirSync(new URL('./scen/', import.meta.url), { recursive: true });
	writeFileSync(new URL(`./scen/${name}.json`, import.meta.url), JSON.stringify({ p1: r.chunks[0], p2: r.chunks[1], marks: r.marks }));
}

export function log(r: Run, from = 0) {
	return r.b.log.slice(from).join('\n');
}
export { sid };

/** Diffs of the client's state against the sim for player `me`, for own and opposing sides. */
export function cmp(r: Run, me: 'p1' | 'p2', label = '') {
	const c = r.clients[me === 'p1' ? 0 : 1];
	const diffs: string[] = [];
	for (const [who, cs, ss] of [['own', c[me], r.b.sides[me === 'p1' ? 0 : 1]], ['opp', c[me].foe, r.b.sides[me === 'p1' ? 1 : 0]]] as const) {
		for (const cp of cs.team) {
			const sp = ss.pokemon.find((p: any) => p.name === cp.name);
			if (!sp) { diffs.push(`${who} ${cp.name}: no sim mon`); continue; }
			if (who === 'opp' && !cp.maxhp) continue;
			const d = (k: string, a: any, b: any) => { if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${who} ${cp.name}.${k}: client=${JSON.stringify(a)} sim=${JSON.stringify(b)}`); };
			const disguised = sp.illusion;
			if (who === 'opp' && disguised) continue;
			d('species', sid(cp.speciesForme), sid(sp.species.name));
			if (who === 'own') d('hp', cp.hp, sp.hp); else if (cp.maxhp === 100 || who === 'opp') d('hp%', cp.hp, sp.fainted ? 0 : Math.max(1, Math.round(sp.hp * 100 / sp.maxhp)));
			d('status', cp.status ?? '', sp.status === 'fnt' ? '' : sp.status);
			d('fainted', !!cp.fainted, !!sp.fainted);
			if (cp.item || who === 'own') d('item', cp.item || '', sp.item);
			if (cp.ability) d('ability', sid(cp.ability), sid(sp.ability));
			if (sp.isActive) {
				d('boosts', Object.fromEntries(Object.entries(cp.boosts).filter(([, v]) => v)), Object.fromEntries(Object.entries(sp.boosts).filter(([, v]) => v)));
				const IGN = new Set(['choicelock','stall','lockedmove','chillyreception','counter','mirrorcoat','pursuit','transform','formechange','typechange','typeadd','itemremoved','airballoon','trapped']); d('vol', Object.keys(cp.volatiles).filter(k => !IGN.has(k)).sort(), Object.keys(sp.volatiles).filter(k => !IGN.has(k)).sort());
			}
			d('tera', cp.terastallized || '', sp.terastallized ? sid(sp.terastallized) : '');
			if (who === 'own' && !cp.volatiles.transform) { d('moves', [...new Set(cp.moveSlots.map((m: any) => m.id))], sp.moveSlots.map((m: any) => m.id)); }
			else { const known = cp.moveSlots.map((m: any) => m.id); const real = new Set(sp.moveSlots.map((m: any) => m.id)); const bad = known.filter((m: string) => !real.has(m)); if (bad.length) diffs.push(`${who} ${cp.name}.moves not in sim: ${bad}`); }
		}
		const cc = Object.keys(cs.sideConditions).sort(), sc = Object.keys(ss.sideConditions).map(sid).sort();
		if (JSON.stringify(cc) !== JSON.stringify(sc)) diffs.push(`${who} sideconds client=${cc} sim=${sc}`);
	}
	return diffs.length ? `[${label}] ${me} DIFFS:\n   ` + diffs.join('\n   ') : `[${label}] ${me} ok`;
}
export const both = (r: Run, label = '') => { console.log(cmp(r, 'p1', label)); console.log(cmp(r, 'p2', label)); if (r.errors.length) console.log('ERRORS', r.errors); };
