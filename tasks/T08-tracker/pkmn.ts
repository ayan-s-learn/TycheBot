// @pkmn/client as the tracker. Feeds each player's chunks of the recorded games, line by line, to its own
// client Battle, and at each decision (a request the player must answer) writes the tracked state in the
// shared view format (view.md). On public replays (spectator view, no requests) it only counts errors.
// Usage: node pkmn.ts games <games.jsonl> <views.jsonl> [natdex|default]
//        node pkmn.ts replays <replays.jsonl.gz>... [natdex|default]
//        node pkmn.ts time <games.jsonl> [runs=3]   (tracking only, no views: ms per decision in this process)
// `natdex` (the default) builds @pkmn/data's Generations with Past and Unobtainable content kept.
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { Battle } from '@pkmn/client';
import { Generations, type ID } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

type Client = InstanceType<typeof Battle>;
type ClientPokemon = Client['p1']['team'][number];

const NATDEX = new Set([undefined, null, 'Past', 'Unobtainable']);
export function generations(mode: string) {
	if (mode === 'default') return new Generations(Dex);
	return new Generations(Dex, d => !!d.exists && NATDEX.has((d as any).isNonstandard));
}

const nonzero = (o: Record<string, number | undefined>) =>
	Object.fromEntries(Object.entries(o).filter(([, v]) => v));

function viewMon(p: ClientPokemon, own: boolean) {
	// item '' is either unknown or known to be gone (lastItem set); the opponent's unknown item is null.
	const item = p.item ? p.item : (own || p.lastItem) ? '' : null;
	return {
		species: p.speciesForme,
		hp: p.hp, maxhp: p.maxhp, status: p.status ?? '', fainted: p.fainted,
		statusTurns: p.status === 'slp' ? p.statusState.sleepTurns : p.status === 'tox' ? p.statusState.toxicTurns : 0,
		item, ability: p.ability || null, moves: p.moveSlots.map(m => m.id),
		active: p.side.active.includes(p),
		boosts: nonzero(p.boosts), volatiles: Object.keys(p.volatiles).sort(),
	};
}

export function view(b: Client, me: 'p1' | 'p2') {
	const own = b[me], opp = own.foe;
	const mons = (s: typeof own, isOwn: boolean) =>
		Object.fromEntries(s.team.map(p => [p.name, viewMon(p, isOwn)]));
	const conds = (s: typeof own) =>
		Object.fromEntries(Object.entries(s.sideConditions).map(([id, c]) => [id, c.level]));
	// @pkmn/client keeps no Mega or Z flag. Derived here: a Mega forme on the side, or a Z-Move among a mon's
	// moves (it records Z-Moves as moves).
	const flags = (s: typeof own) => ({
		megaUsed: s.team.some(p => p.species?.isMega),
		zUsed: s.team.some(p => p.moveSlots.some(m => b.gen.moves.get(m.id)?.isZ)),
	});
	return {
		turn: b.turn,
		flags: { own: flags(own), opp: flags(opp) },
		field: { weather: b.field.weatherState.id, terrain: b.field.terrain ?? '', pseudo: Object.keys(b.field.pseudoWeather).sort() },
		own: mons(own, true), opp: mons(opp, false), ownConds: conds(own), oppConds: conds(opp),
	};
}

/** Per-tracker error counts: thrown errors (by message) and lines the handler has no method for (by type). */
export class Errors {
	thrown = new Map<string, number>();
	unhandled = new Map<string, number>();
	gamesWithThrow = new Set<string>();
	add(map: Map<string, number>, key: string) { map.set(key, (map.get(key) ?? 0) + 1); }
}

/** Feeds one line, counting what goes wrong. Returns false if it threw. */
function feed(b: Client, line: string, errs: Errors, where: string) {
	if (!line.startsWith('|')) return true;
	const type = line.split('|')[1];
	if (!(`|${type}|` in (b as any).handler) && type !== '') errs.add(errs.unhandled, type);
	try {
		b.add(line);
		return true;
	} catch (e) {
		errs.add(errs.thrown, `${type}: ${(e as Error).message.split('\n')[0].slice(0, 80)}`);
		errs.gamesWithThrow.add(where);
		return false;
	}
}

async function* lines(path: string) {
	const input = path.endsWith('.gz') ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
	yield* createInterface({ input, crlfDelay: Infinity });
}

export function summary(errs: Errors, games: number) {
	const sort = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);
	return {
		games, gamesWithThrow: errs.gamesWithThrow.size,
		thrown: Object.fromEntries(sort(errs.thrown)), unhandled: Object.fromEntries(sort(errs.unhandled)),
	};
}

if (import.meta.main) {
	const [mode, ...rest] = process.argv.slice(2);
	const errs = new Errors();
	let games = 0;
	if (mode === 'games') {
		const [input, output, genMode = 'natdex'] = rest;
		const gens = generations(genMode);
		const out = createWriteStream(output);
		let decisions = 0;
		for await (const line of lines(input)) {
			const g = JSON.parse(line);
			games++;
			const views: unknown[] = [];
			for (const side of ['p1', 'p2'] as const) {
				const b = new Battle(gens, side as ID);
				let ok = true;
				for (const chunk of g[side] as string[]) {
					if (chunk.startsWith('|request|')) {
						const wait = JSON.parse(chunk.slice(9)).wait;
						if (ok) ok = feed(b, chunk, errs, `${g.game}${side}`);
						// After a throw the state is suspect, so later decisions get null.
						if (!wait) { views.push({ side, view: ok ? view(b, side) : null }); decisions++; }
					} else if (!chunk.startsWith('|error|')) {
						for (const l of chunk.split('\n')) if (ok) ok = feed(b, l, errs, `${g.game}${side}`);
					}
				}
			}
			out.write(JSON.stringify({ game: g.game, views }) + '\n');
		}
		out.end();
		console.log(JSON.stringify({ tracker: '@pkmn/client', gens: genMode, decisions, ...summary(errs, games * 2) }, null, 1));
	} else if (mode === 'time') {
		const [input, runs = '3'] = rest;
		const gens = generations('natdex');
		const games: string[][] = [];
		let decisions = 0;
		for await (const line of lines(input)) {
			const g = JSON.parse(line);
			for (const side of ['p1', 'p2']) {
				games.push(g[side]);
				decisions += g[side].filter((c: string) => c.startsWith('|request|') && !c.includes('"wait":true')).length;
			}
		}
		const ms: number[] = [];
		for (let r = 0; r < +runs; r++) {
			const t0 = performance.now();
			for (const [i, chunks] of games.entries()) {
				const b = new Battle(gens, (i % 2 ? 'p2' : 'p1') as ID);
				for (const chunk of chunks) {
					if (chunk.startsWith('|error|')) continue;
					for (const l of chunk.split('\n')) b.add(l);
				}
			}
			ms.push((performance.now() - t0) / decisions);
		}
		console.log(JSON.stringify({ tracker: '@pkmn/client', decisions, msPerDecision: ms.map(x => +x.toFixed(4)) }));
	} else if (mode === 'replays') {
		const genMode = rest.at(-1) === 'default' || rest.at(-1) === 'natdex' ? rest.pop()! : 'natdex';
		const gens = generations(genMode);
		for (const path of rest) {
			for await (const line of lines(path)) {
				const r = JSON.parse(line);
				games++;
				const b = new Battle(gens);
				for (const l of (r.log as string).split('\n')) if (!feed(b, l, errs, r.id)) break;
			}
		}
		console.log(JSON.stringify({ tracker: '@pkmn/client', gens: genMode, ...summary(errs, games) }, null, 1));
	}
}
