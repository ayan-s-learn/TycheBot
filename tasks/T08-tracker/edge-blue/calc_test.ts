// Calc step in practice: at each decision of T08's recorded games, builds @smogon/calc inputs (own active vs opposing active, both
// directions, every known damaging move) twice: from the sim's state (truth.jsonl) and from the @pkmn/client view (views-pkmn.jsonl, T08's
// view format), filling what a tracker can't know (the opposing item and ability, spreads) from the sim in BOTH builds, so differences
// come only from tracked state. Spreads: 0 EVs, neutral nature, in both. Reads T08's out/ files (read-only).
// Usage: node calc_test.ts [games=100]
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { calculate, Pokemon, Move, Field, Generations } from '@smogon/calc';

const gen = Generations.get(9);
const toID = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const names = (it: Iterable<{ name: string }>) => new Map([...it].map(x => [toID(x.name), x.name]));
const SPECIES = names(gen.species), ITEMS = names(gen.items), ABILITIES = names(gen.abilities), MOVES = names(gen.moves);
const WEATHER: Record<string, any> = { raindance: 'Rain', sunnyday: 'Sun', sandstorm: 'Sand', snowscape: 'Snow', snow: 'Snow', hail: 'Hail', rain: 'Rain', sun: 'Sun', sand: 'Sand',
	primordialsea: 'Heavy Rain', desolateland: 'Harsh Sunshine', deltastream: 'Strong Winds', heavyrain: 'Heavy Rain', harshsunshine: 'Harsh Sunshine', strongwinds: 'Strong Winds' };
const TERRAIN: Record<string, any> = { electricterrain: 'Electric', electric: 'Electric', grassyterrain: 'Grassy', grassy: 'Grassy', mistyterrain: 'Misty', misty: 'Misty', psychicterrain: 'Psychic', psychic: 'Psychic' };

interface M { species: string, hp: number, maxhp: number, opp: boolean, status: string, boosts: Record<string, number>, item: string, ability: string, moves: string[], statusTurns: number }
interface In { mon: M, conds: Record<string, number> }
interface FieldIn { weather: string, terrain: string, pseudo: string[] }

function mkMon(m: M) {
	const sp = SPECIES.get(toID(m.species));
	if (!sp) throw new Error('species ' + m.species);
	const curHP = m.opp ? undefined : m.hp;
	const p = new Pokemon(gen, sp, {
		level: 100, item: ITEMS.get(toID(m.item)) as any, ability: ABILITIES.get(toID(m.ability)) as any,
		status: (m.status as any) || '', boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...Object.fromEntries(Object.entries(m.boosts).filter(([k]) => !['accuracy', 'evasion'].includes(k))) },
		toxicCounter: m.status === 'tox' ? m.statusTurns : 0,
	});
	p.originalCurHP = m.opp ? Math.max(1, Math.round(m.hp / m.maxhp * p.maxHP())) : Math.max(1, Math.round(m.hp / m.maxhp * p.maxHP()));
	void curHP;
	return p;
}
function mkField(f: FieldIn, atk: In, def: In) {
	const side = (c: Record<string, number>) => ({
		spikes: c.spikes ?? 0, isSR: !!c.stealthrock, isReflect: !!c.reflect, isLightScreen: !!c.lightscreen, isAuroraVeil: !!c.auroraveil, isTailwind: !!c.tailwind,
	});
	return new Field({
		gameType: 'Singles', weather: WEATHER[toID(f.weather)], terrain: TERRAIN[toID(f.terrain)],
		isGravity: f.pseudo.includes('gravity'), isMagicRoom: f.pseudo.includes('magicroom'), isWonderRoom: f.pseudo.includes('wonderroom'),
		attackerSide: side(atk.conds), defenderSide: side(def.conds),
	} as any);
}
const rng = (r: any): [number, number] => { try { const x = r.range(); return [x[0], x[1]]; } catch { return [0, 0]; } };

/** Damage ranges (% of the defender's max HP) for each of the attacker's moves. */
function run(att: In, def: In, f: FieldIn, moves: string[]) {
	const out: Record<string, [number, number]> = {};
	const a = mkMon(att.mon), d = mkMon(def.mon);
	const field = mkField(f, att, def);
	for (const id of moves) {
		const name = MOVES.get(id);
		if (!name) { out[id] = [-1, -1]; continue; }
		const move = new Move(gen, name);
		if (move.category === 'Status') continue;
		const r = calculate(gen, a, d, move, field);
		const [lo, hi] = rng(r);
		out[id] = [Math.round(lo / d.maxHP() * 1000) / 10, Math.round(hi / d.maxHP() * 1000) / 10];
	}
	return out;
}
const norm = (m: string) => toID(m).replace(/^(hiddenpower)[a-z]*\d*$|^(return|frustration)\d+$/, (x, a, b) => a || b);

const limit = +(process.argv[2] ?? 100);
const read = async (p: string) => { const a: any[] = []; for await (const l of createInterface({ input: createReadStream(p) })) { a.push(JSON.parse(l)); if (a.length >= limit) break; } return a; };
const truths = await read('../out/truth.jsonl'), views = await read('../out/views-pkmn.jsonl');

const stats = { decisions: 0, built: 0, skipped: {} as Record<string, number>, calcs: 0, differ: 0, errors: {} as Record<string, number>,
	unknown: { oppItem: 0, oppAbility: 0, oppActive: 0, oppMovesKnown: 0, oppMovesTrue: 0, oppNames: 0 } };
const causes: Record<string, number> = {}, examples: Record<string, any[]> = {};
const bump = (o: Record<string, number>, k: string) => o[k] = (o[k] ?? 0) + 1;

for (let gi = 0; gi < truths.length; gi++) {
	for (const side of ['p1', 'p2'] as const) {
		const td = truths[gi].decisions.filter((d: any) => d.side === side);
		const vd = views[gi].views.filter((v: any) => v.side === side);
		const mi = side === 'p1' ? 0 : 1;
		td.forEach((d: any, i: number) => {
			stats.decisions++;
			const v = vd[i].view;
			if (!v || d.state.turn === 0) return bump(stats.skipped, v ? 'preview' : 'no view');
			const S = d.state.sides[mi], O = d.state.sides[1 - mi];
			const ta = S.mons.find((m: any) => m.active), to = O.mons.find((m: any) => m.active);
			if (!ta || !to || ta.fainted || to.fainted) return bump(stats.skipped, 'no active');
			if (O.mons.some((m: any) => m.illusion && m.active) || S.mons.some((m: any) => m.illusion && m.active)) return bump(stats.skipped, 'illusion');
			const va = Object.values<any>(v.own).find(m => m.active), vo = Object.values<any>(v.opp).find(m => m.active && !m.fainted);
			if (!va || !vo) return bump(stats.skipped, 'tracker has no active');
			stats.built++;
			stats.unknown.oppActive++;
			if (vo.item === null) stats.unknown.oppItem++;
			if (!vo.ability) stats.unknown.oppAbility++;
			const trueOppMoves = new Set<string>(to.moves.map(norm));
			stats.unknown.oppMovesTrue += trueOppMoves.size;
			stats.unknown.oppMovesKnown += new Set<string>(vo.moves.map(norm)).size;
			const mkT = (t: any, opp: boolean): M => ({ species: t.species, hp: t.hp, maxhp: t.maxhp, opp, status: t.status, boosts: t.boosts, item: t.item, ability: t.ability, moves: t.moves.map(norm), statusTurns: t.statusTurns });
			// Tracker build: tracked species, HP, status, boosts and moves; hidden item and ability filled from the sim.
			const mkV = (x: any, t: any, opp: boolean): M => ({ species: x.species, hp: x.hp, maxhp: x.maxhp, opp, status: x.status, boosts: x.boosts, item: opp ? t.item : x.item ?? t.item, ability: opp ? t.ability : x.ability ?? t.ability, moves: x.moves.map(norm), statusTurns: x.statusTurns });
			const tfield: FieldIn = { weather: d.state.field.weather, terrain: d.state.field.terrain, pseudo: d.state.field.pseudo.filter((p: string) => p !== 'sleepclausemod') };
			const vfield: FieldIn = { weather: v.field.weather, terrain: v.field.terrain, pseudo: v.field.pseudo };
			const tc = (s: any) => ({ ...s.conds, ...Object.fromEntries(s.slotConds.map((c: string) => [c, 1])) });
			const vc = (c: Record<string, number>) => Object.fromEntries(Object.entries(c).map(([k, x]) => [toID(k), x]));
			const T = { own: { mon: mkT(ta, false), conds: tc(S) }, opp: { mon: mkT(to, true), conds: tc(O) } };
			const V = { own: { mon: mkV(va, ta, false), conds: vc(v.ownConds) }, opp: { mon: mkV(vo, to, true), conds: vc(v.oppConds) } };
			if (process.env.EXAMPLE && !(globalThis as any).__ex && Object.keys(vo.boosts).length && Object.keys(v.ownConds).length && vo.item === null && d.state.turn > 5) {
				(globalThis as any).__ex = 1;
				const mv = [...new Set<string>(T.own.mon.moves)];
				console.error(JSON.stringify({ at: `${truths[gi].game}:${side}:${i}:t${d.state.turn}`, turn: d.state.turn,
					own: { tracker: { ...V.own.mon, conds: V.own.conds }, ranges: run(V.own, V.opp, vfield, mv) },
					opp: { tracker: { ...V.opp.mon, conds: V.opp.conds }, hiddenInTracker: { item: vo.item, ability: vo.ability, trueItem: to.item, trueAbility: to.ability, revealedMoves: vo.moves, trueMoves: to.moves }, ranges: run(V.opp, V.own, vfield, V.opp.mon.moves.filter((m: string) => trueOppMoves.has(m))) },
					field: vfield }, null, 1));
			}
			for (const [attK, defK] of [['own', 'opp'], ['opp', 'own']] as const) {
				// Moves: own side from the sim's set (which the request lists); opposing side the moves the tracker has seen, as the builder would have.
				const moveIds = [...new Set<string>(attK === 'own' ? T.own.mon.moves : V.opp.mon.moves.filter(m => trueOppMoves.has(m)))];
				let a: any, b: any;
				try {
					a = run(T[attK], T[defK], tfield, moveIds);
					b = run(V[attK], V[defK], vfield, moveIds);
				} catch (e) { bump(stats.errors, (e as Error).message.slice(0, 70)); continue; }
				for (const id of Object.keys(a)) {
					stats.calcs++;
					if (JSON.stringify(a[id]) === JSON.stringify(b[id])) continue;
					stats.differ++;
					// Attribute: which tracked input differs from the sim's.
					const why: string[] = [];
					const [tA, tD, vA, vD] = [T[attK], T[defK], V[attK], V[defK]];
					if (tA.mon.species !== vA.mon.species || tD.mon.species !== vD.mon.species) why.push('species');
					if (JSON.stringify(tA.mon.boosts) !== JSON.stringify(vA.mon.boosts) || JSON.stringify(tD.mon.boosts) !== JSON.stringify(vD.mon.boosts)) why.push('boosts');
					if (tA.mon.status !== vA.mon.status || tD.mon.status !== vD.mon.status) why.push('status');
					if (tD.mon.hp !== vD.mon.hp || tA.mon.hp !== vA.mon.hp) why.push('hp');
					if (JSON.stringify(tfield) !== JSON.stringify(vfield)) why.push('field');
					if (JSON.stringify(Object.entries(tA.conds).filter(([k]) => ['stealthrock', 'spikes', 'reflect', 'lightscreen', 'auroraveil', 'tailwind'].includes(k))) !== JSON.stringify(Object.entries(vA.conds).filter(([k]) => ['stealthrock', 'spikes', 'reflect', 'lightscreen', 'auroraveil', 'tailwind'].includes(k)))
						|| JSON.stringify(Object.entries(tD.conds).filter(([k]) => ['reflect', 'lightscreen', 'auroraveil'].includes(k))) !== JSON.stringify(Object.entries(vD.conds).filter(([k]) => ['reflect', 'lightscreen', 'auroraveil'].includes(k)))) why.push('side conds');
					const key = why.join('+') || 'other';
					bump(causes, key);
					(examples[key] ??= []).length < 3 && examples[key].push({ at: `${truths[gi].game}:${side}:${i}:t${d.state.turn}`, att: attK, move: id, truth: a[id], tracker: b[id], tA: tA.mon.species, tD: tD.mon.species, vA: vA.mon.species, vD: vD.mon.species, hp: [tA.mon.hp, vA.mon.hp, tD.mon.hp, vD.mon.hp], tBoosts: [tA.mon.boosts, tD.mon.boosts], vBoosts: [vA.mon.boosts, vD.mon.boosts], tfield, vfield });
				}
			}
		});
	}
}
console.log(JSON.stringify({ games: truths.length, stats, causes, examples }, null, 1));
