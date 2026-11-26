// Ground truth: replays each recorded game in-process (sim.ts, Battle driven directly) and snapshots the sim's
// Battle whenever a player gets a request it must answer (a decision). Checks that the replay gives the
// recorded chunks, then writes one line per game: {game, decisions: [{side, chunk, state}]}, where `chunk` is
// how many of that player's chunks (the request included) it has received at that decision.
// Usage: node truth.ts <games.jsonl> <out.jsonl>
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Battle, Collector, direct, freezeClock, play, recorderGame, recorderTeams, FORMAT, type Driver } from './sim.ts';

type SimBattle = InstanceType<typeof Battle>;
type SimPokemon = SimBattle['sides'][number]['pokemon'][number];

export interface TrueMon {
	name: string, species: string, hp: number, maxhp: number, status: string,
	/** Sleep: turns slept so far (startTime - time). Toxic: the damage stage. */
	statusTurns: number,
	item: string, ability: string, moves: string[], active: boolean, fainted: boolean,
	boosts: Record<string, number>, volatiles: string[],
	/** The team member this mon is disguised as, while its Illusion holds. */
	illusion: string | null,
	/** Pokemon.details: what the protocol shows of it (`species, L.., gender`), under Illusion the disguise's. */
	details: string,
	/** Which of its species, item and moves are Past content (isNonstandard 'Past' at the pin). */
	past: string[],
}
export interface TrueState {
	turn: number,
	field: { weather: string, terrain: string, pseudo: string[] },
	sides: {
		conds: Record<string, number>, slotConds: string[], mons: TrueMon[],
		/** Whether the side has used its Z-Move, and whether one of its mons has Mega Evolved. */
		zUsed: boolean, megaUsed: boolean,
	}[],
}

function mon(p: SimPokemon): TrueMon {
	const active = p.isActive;
	const st = p.statusState as any;
	return {
		name: p.name, species: p.species.name, hp: p.hp, maxhp: p.maxhp, status: p.status,
		statusTurns: p.status === 'slp' ? st.startTime - st.time : p.status === 'tox' ? st.stage ?? 0 : 0,
		item: p.item, ability: p.ability, moves: p.moveSlots.map(m => m.id), active, fainted: p.fainted,
		boosts: active ? Object.fromEntries(Object.entries(p.boosts).filter(([, v]) => v)) : {},
		volatiles: active ? Object.keys(p.volatiles).sort() : [],
		illusion: p.illusion ? p.illusion.name : null,
		details: (p.illusion ?? p).details,
		past: [
			...p.baseSpecies.isNonstandard === 'Past' || p.species.isNonstandard === 'Past' ? ['species'] : [],
			...p.getItem().isNonstandard === 'Past' ? ['item'] : [],
			...p.baseMoveSlots.some(m => p.battle.dex.moves.get(m.id).isNonstandard === 'Past') ? ['moves'] : [],
		],
	};
}

// Sides that have Mega Evolved, from the sim's own log: a fainted Mega reverts to its base forme
// (sim/battle.ts, faint handling), so the species alone doesn't say.
const megas = new WeakMap<SimBattle, { pos: number, sides: Set<string> }>();
function megaSides(b: SimBattle) {
	let m = megas.get(b);
	if (!m) megas.set(b, m = { pos: 0, sides: new Set() });
	for (; m.pos < b.log.length; m.pos++) {
		if (b.log[m.pos].startsWith('|-mega|')) m.sides.add(b.log[m.pos].slice(7, 9));
	}
	return m.sides;
}

export function snapshot(b: SimBattle): TrueState {
	const mega = megaSides(b);
	return {
		turn: b.turn,
		field: { weather: b.field.weather, terrain: b.field.terrain, pseudo: Object.keys(b.field.pseudoWeather).sort() },
		sides: b.sides.map(s => ({
			conds: Object.fromEntries(Object.entries(s.sideConditions).map(([id, c]) => [id, (c as any).layers ?? 1])),
			slotConds: s.slotConditions.flatMap(c => Object.keys(c)).sort(),
			zUsed: s.zMoveUsed, megaUsed: mega.has(s.id),
			// Team order as at the start, so the list doesn't reorder with switching.
			mons: [...s.pokemon].sort((a, b) => a.fullname < b.fullname ? -1 : 1).map(mon),
		})),
	};
}

interface Decision { side: 'p1' | 'p2', chunk: number, state: TrueState }

/** Battle direct, plus a snapshot at each request a player must answer. */
function truthDriver(decisions: Map<number, Decision[]>): Driver<SimBattle> {
	return {
		...direct,
		start(game, out: Collector) {
			const list: Decision[] = [];
			decisions.set(game.id, list);
			const battle: SimBattle = new Battle({
				formatid: FORMAT, seed: game.seed,
				send: (type, data) => {
					const text = Array.isArray(data) ? data.join('\n') : data;
					out.receive(type, text);
					if (type !== 'sideupdate' || !text.slice(3).startsWith('|request|')) return;
					if (JSON.parse(text.slice(12)).wait) return;
					const side = text.slice(0, 2) as 'p1' | 'p2';
					list.push({ side, chunk: out.chunks[side === 'p1' ? 0 : 1].length, state: snapshot(battle) });
				},
			});
			battle.setPlayer('p1', { name: 'Bot 1', team: game.teams[0] });
			battle.setPlayer('p2', { name: 'Bot 2', team: game.teams[1] });
			battle.sendUpdates();
			return battle;
		},
	};
}

if (import.meta.main) {
	const [input, output] = process.argv.slice(2);
	freezeClock();
	const teams = recorderTeams();
	const recorded = new Map<number, { p1: string[], p2: string[], inputLog: string[] }>();
	for await (const line of createInterface({ input: createReadStream(input) })) {
		const g = JSON.parse(line);
		recorded.set(g.game, { p1: g.p1, p2: g.p2, inputLog: g.inputLog });
	}
	const decisions = new Map<number, Decision[]>();
	const lines: string[] = [];
	let count = 0;
	await play(truthDriver(decisions), [...recorded.keys()].map(id => recorderGame(id, teams)).values(), {
		concurrency: 1,
		onEnd({ game, battle, chunks }) {
			const rec = recorded.get(game.id)!;
			const same = JSON.stringify([chunks, battle.inputLog]) === JSON.stringify([[rec.p1, rec.p2], rec.inputLog]);
			if (!same) throw new Error(`game ${game.id}: the replay differs from the recording`);
			count += decisions.get(game.id)!.length;
			lines.push(JSON.stringify({ game: game.id, decisions: decisions.get(game.id) }));
			decisions.delete(game.id);
		},
	});
	writeFileSync(output, lines.join('\n') + '\n');
	console.log(`${output}: ${lines.length} games, ${count} decisions`);
}
