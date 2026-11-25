// NatDex support in @smogon/calc's gen 9 data.
//   1. Names: every species, item, ability and move on the pool teams (plus Mega formes and Z-Moves),
//      and every one gen9nationaldex allows at the pin, looked up in the calc's gen 9 data.
//   2. Calcs: each pool set's moves (as Z-Moves for Z-Crystal holders, and from the Mega forme for
//      Mega Stone holders) against each set of the next pool team; throws are listed.
//   3. Range check: in seeded in-process games, every single-hit, non-crit hit of a damaging move between
//      the two actives, the sim's damage (BattleActions.getDamage) against the calc's 16 rolls for the
//      same state. Mismatches are listed with their state.
// Usage: node support.ts [games=60] > support.json   (summary on stderr)
import type { Battle } from './sim.ts';
import { Dex, FORMAT, Teams, gameIds, loadPool, play } from './sim.ts';
import { calc, gen, calcSpecies, makeMove, makePokemon, readField, readMon } from './calcs.ts';

const games = Number(process.argv[2] ?? 60);
const pool = loadPool();
const out: any = {};
const log = (...a: unknown[]) => console.error(...a);

// 1. Names
const format = Dex.formats.get(FORMAT);
const ruleTable = Dex.formats.getRuleTable(format);
const allowed = (x: { isNonstandard: string | null }) => !x.isNonstandard || ['Past', 'Unobtainable'].includes(x.isNonstandard);
const legal = {
	species: Dex.species.all().filter(s => allowed(s) && !['Illegal', 'Unreleased'].includes(s.natDexTier) &&
		!ruleTable.isBannedSpecies(s)).map(s => s.name),
	items: Dex.items.all().filter(i => allowed(i) && !ruleTable.isBanned(`item:${i.id}`)).map(i => i.name),
	abilities: Dex.abilities.all().filter(a => allowed(a) && a.id !== 'noability' &&
		!ruleTable.isBanned(`ability:${a.id}`)).map(a => a.name),
	moves: Dex.moves.all().filter(m => allowed(m) && !m.isMax && !ruleTable.isBanned(`move:${m.id}`))
		.map(m => m.id === 'hiddenpower' ? 'Hidden Power Bug' : m.name),
};
const inCalc = {
	species: (n: string) => {
		try {
			return !!calcSpecies(n);
		} catch {
			return false;
		}
	},
	items: (n: string) => !!gen.items.get(calc.toID(n)),
	abilities: (n: string) => !!gen.abilities.get(calc.toID(n)),
	moves: (n: string) => !!gen.moves.get(calc.toID(n)),
};
type Kind = keyof typeof inCalc;
const poolNames: { [k in Kind]: Set<string> } = { species: new Set(), items: new Set(), abilities: new Set(), moves: new Set() };
const teams = pool.map(t => Teams.unpack(t)!);
/** The Mega forme a set's item gives, if any. */
const megaOf = (s: { species: string, item: string }) =>
	Dex.items.get(s.item).megaStone?.[Dex.species.get(s.species).baseSpecies];
for (const set of teams.flat()) {
	const species = Dex.species.get(set.species);
	const item = Dex.items.get(set.item);
	poolNames.species.add(species.name);
	const mega = megaOf(set);
	if (mega) poolNames.species.add(mega);
	if (item.exists) poolNames.items.add(item.name);
	poolNames.abilities.add(Dex.abilities.get(set.ability).name);
	if (mega) poolNames.abilities.add(Dex.species.get(mega).abilities[0]);
	for (const id of set.moves) {
		const move = Dex.moves.get(id);
		poolNames.moves.add(move.id === 'hiddenpower' ? `Hidden Power ${set.hpType || 'Dark'}` : move.name);
		if (item.zMoveType === move.type && move.category !== 'Status') {
			poolNames.moves.add(Dex.moves.all().find(m => m.isZ === item.id)!.name);
		}
	}
}
const nonstandard = (kind: Kind, n: string) =>
	({ species: Dex.species, items: Dex.items, abilities: Dex.abilities, moves: Dex.moves })[kind].get(n).isNonstandard;
out.names = {};
for (const kind of Object.keys(inCalc) as Kind[]) {
	const poolList = [...poolNames[kind]].sort();
	out.names[kind] = {
		pool: poolList.length,
		poolPast: poolList.filter(n => nonstandard(kind, n) === 'Past'),
		poolMissing: poolList.filter(n => !inCalc[kind](n)),
		legal: legal[kind].length,
		legalMissing: legal[kind].filter(n => !inCalc[kind](n)),
		...kind === 'species' ? { legalAsBase: legal.species.filter(n => inCalc.species(n) && calcSpecies(n) !== n) } : {},
	};
	log(`${kind}: pool ${poolList.length} (${out.names[kind].poolPast.length} Past), missing in calc ` +
		`${JSON.stringify(out.names[kind].poolMissing)}; legal ${legal[kind].length}, missing ${out.names[kind].legalMissing.length}`);
}

// 2. Calcs on the pool sets
function setMon(set: ReturnType<typeof Teams.unpack> & {}, i: number, mega = false) {
	const s = set[i];
	const item = Dex.items.get(s.item);
	const megaForme = mega ? megaOf(s) : undefined;
	const species = megaForme ?? Dex.species.get(s.species).name;
	const ability = megaForme ? Dex.species.get(megaForme).abilities[0] : s.ability;
	return {
		species: calcSpecies(species),
		options: { level: s.level || 100, ability, item: s.item || undefined, nature: s.nature || 'Serious',
			evs: s.evs, ivs: s.ivs, gender: s.gender || undefined },
		moves: s.moves.map(id => Dex.moves.get(id)).filter(m => m.category !== 'Status')
			.map(m => m.id === 'hiddenpower' ? `Hidden Power ${s.hpType || 'Dark'}` : m.name),
		zType: item.zMoveType, isMega: !!megaForme,
	};
}
const calcRuns = { calcs: 0, z: 0, mega: 0, errors: [] as string[], zBp: [] as string[] };
for (const [t, team] of teams.entries()) {
	const foes = teams[(t + 1) % teams.length];
	for (let i = 0; i < team.length; i++) {
		const variants = [setMon(team, i)];
		if (megaOf(team[i])) variants.push(setMon(team, i, true));
		for (const a of variants) {
			for (const name of a.moves) {
				const simMove = Dex.moves.get(name.startsWith('Hidden Power') ? 'hiddenpower' : name);
				const useZs = a.zType === simMove.type ? [false, true] : [false];
				for (const useZ of useZs) {
					for (let j = 0; j < foes.length; j++) {
						const d = setMon(foes, j);
						calcRuns.calcs++;
						if (useZ) calcRuns.z++;
						if (a.isMega) calcRuns.mega++;
						try {
							const r = calc.calculate(gen, makePokemon(a as any), makePokemon(d as any),
								makeMove(a as any, name, useZ), new calc.Field());
							if (useZ && j === 0 && r.move.bp !== simMove.zMove?.basePower) {
								calcRuns.zBp.push(`${name}: calc ${r.move.name} ${r.move.bp} BP, sim ${simMove.zMove?.basePower}`);
							}
						} catch (e) {
							calcRuns.errors.push(`${a.species} ${name}${useZ ? ' (Z)' : ''} vs ${d.species}: ${(e as Error).message}`);
						}
					}
				}
			}
		}
	}
}
out.calcRuns = calcRuns;
log(`calcs on pool sets: ${calcRuns.calcs} (${calcRuns.z} Z, ${calcRuns.mega} Mega), ${calcRuns.errors.length} threw, ` +
	`${calcRuns.zBp.length} Z BP differences`);

// 3. Range check
interface Hit {
	cause?: string, lastDamageTaken: number, atkVolatiles: string[], defVolatiles: string[], game: number, turn: number, attacker: string, defender: string, move: string, z: boolean,
	sim: number, rolls: number[], exact: boolean, inRange: boolean, atk: any, def: any, field: any,
}
const hits: Hit[] = [];
const skipped = { crit: 0, multihit: 0, notNumber: 0, notActivePair: {} as { [move: string]: number } };
let gameId = 0;
function instrument(battle: Battle) {
	const actions = battle.actions;
	let lastBase: { id: string, z: boolean } = { id: '', z: false };
	const useMoveInner = actions.useMoveInner;
	actions.useMoveInner = function (this: typeof actions, move: any, pokemon: any, options?: any) {
		lastBase = { id: Dex.moves.get(move).id, z: !!options?.zMove };
		return useMoveInner.call(this, move, pokemon, options);
	} as typeof useMoveInner;
	const getDamage = actions.getDamage;
	actions.getDamage = function (this: typeof actions, source: any, target: any, move: any, suppress?: boolean) {
		if (typeof move !== 'object' || move.category === 'Status' || source.side === target.side) {
			return getDamage.call(this, source, target, move, suppress);
		}
		const atk = readMon(source), def = readMon(target);
		const atkVolatiles = Object.keys(source.volatiles), defVolatiles = Object.keys(target.volatiles);
		const lastDamageTaken = source.attackedBy.at(-1)?.damage ?? 0;
		const field = readField(battle, source.side, target.side);
		const turn = battle.turn;
		const result = getDamage.call(this, source, target, move, suppress);
		if (move.multihit) return skipped.multihit++, result;
		if (typeof result !== 'number') return skipped.notNumber++, result;
		if (target.getMoveHitData(move).crit) return skipped.crit++, result;
		if (!source.isActive || !target.isActive) {
			skipped.notActivePair[move.name] = (skipped.notActivePair[move.name] ?? 0) + 1;
			return result;
		}
		const z = !!move.isZOrMaxPowered;
		const baseId = z ? lastBase.id : move.id;
		const name = baseId === 'hiddenpower' ? `Hidden Power ${source.hpType}` : Dex.moves.get(baseId).name;
		const r = calc.calculate(gen, makePokemon(atk), makePokemon(def), makeMove(atk, name, z), new calc.Field(field.options));
		const rolls = (typeof r.damage === 'number' ? [r.damage] : r.damage) as number[];
		hits.push({
			lastDamageTaken, atkVolatiles, defVolatiles, game: gameId, turn, attacker: atk.species, defender: def.species, move: name, z, sim: result, rolls,
			exact: rolls.includes(result), inRange: result >= rolls[0] && result <= rolls[rolls.length - 1],
			atk: atk.options, def: def.options, field: field.options,
		});
		return result;
	} as typeof getDamage;
}
play(gameIds(0, games, pool), {
	created: battle => instrument(battle),
	ended: () => gameId++,
});
/** The calc rerun on a hit's state with one change; true if that gives the sim's damage as one of its rolls. */
function rerun(h: Hit, change: { def?: any, move?: any, moveName?: string, defSide?: any }) {
	const field = { ...h.field, defenderSide: { ...h.field.defenderSide, ...change.defSide } };
	const r = calc.calculate(gen, makePokemon({ species: h.attacker, options: h.atk } as any),
		makePokemon({ species: h.defender, options: { ...h.def, ...change.def } } as any),
		new calc.Move(gen, change.moveName ?? h.move, { ability: h.atk.ability, item: h.atk.item, species: h.attacker, useZ: h.z, ...change.move }),
		new calc.Field(field));
	return ([] as number[]).concat(r.damage as any).includes(h.sim);
}
/**
 * Known causes. Each is confirmed on the hit's own state: the sim's number follows from the rule, or the
 * calc rerun with the input it lacks gives the sim's damage exactly.
 */
function cause(h: Hit): string | undefined {
	if (h.move === 'Ruination' || h.move === 'Super Fang') {
		if (h.sim === Math.max(1, Math.floor(h.def.curHP / 2))) {
			return 'no half-HP rule in the calc for this move (it has one for Nature\'s Madness), so it returns 0';
		}
	}
	if (['Counter', 'Mirror Coat'].includes(h.move) && h.sim === 2 * h.lastDamageTaken) {
		return 'twice the damage the attacker took this turn, which the calc has no input for';
	}
	if (['Metal Burst', 'Comeuppance'].includes(h.move) && h.sim === Math.floor(1.5 * h.lastDamageTaken)) {
		return '1.5x the damage the attacker took this turn, which the calc has no input for';
	}
	// Throat Chop stands in for Payback: also a physical Dark contact move, with no power rule of its own.
	if (h.move === 'Payback' && [50, 100].some(basePower =>
		rerun(h, { moveName: 'Throat Chop', move: { overrides: { basePower } } }))) {
		return 'the calc doubles Payback by Speed order; Showdown only if the target moved first this turn';
	}
	if (h.move === 'Pursuit' && rerun(h, { defSide: { isSwitching: 'out' } })) {
		return 'Pursuit on a target switching out doubles; the calc input for that (isSwitching) was not set';
	}
	if (h.defVolatiles.includes('roost')) {
		const types = gen.species.get(calc.toID(h.defender))!.types.filter(t => t !== 'Flying');
		// Overrides merge arrays by index, so a dual type keeps its slot 2 unless it is replaced ('???' is neutral).
		if (rerun(h, { def: { overrides: { types: types.length ? [types[0], '???'] : ['Normal', '???'] } } })) {
			return 'the defender used Roost this turn and lost its Flying type; the calc has no input for that';
		}
	}
	return undefined;
}
for (const h of hits) if (!h.exact) h.cause = cause(h);
const misses = hits.filter(h => !h.exact);
const causes: { [c: string]: number } = {};
for (const m of misses) causes[m.cause ?? 'UNEXPLAINED'] = (causes[m.cause ?? 'UNEXPLAINED'] ?? 0) + 1;
const isMega = (n: string) => !!Dex.species.get(n).isMega;
const past = (h: Hit) => [Dex.species.get(h.attacker), Dex.species.get(h.defender), Dex.moves.get(h.move),
	Dex.items.get(h.atk.item ?? ''), Dex.items.get(h.def.item ?? '')].some(x => x.isNonstandard === 'Past');
const coverage = {
	zMove: hits.filter(h => h.z).length,
	mega: hits.filter(h => isMega(h.attacker) || isMega(h.defender)).length,
	past: hits.filter(past).length,
	exactZ: hits.filter(h => h.z && h.exact).length,
	exactMega: hits.filter(h => (isMega(h.attacker) || isMega(h.defender)) && h.exact).length,
	exactPast: hits.filter(h => past(h) && h.exact).length,
};
// How much an exact-roll match shows: the share of in-range integers that are rolls, and how many exact
// hits would still pass if the calc were off by a constant factor (rolls scaled and floored).
const distinct = (h: Hit) => new Set(h.rolls).size;
const width = (h: Hit) => h.rolls[h.rolls.length - 1] - h.rolls[0] + 1;
const exactHits = hits.filter(h => h.exact);
const power = {
	contiguous: hits.filter(h => distinct(h) === width(h)).length,
	meanRollDensity: +(hits.reduce((a, h) => a + distinct(h) / width(h), 0) / hits.length).toFixed(3),
	exactStillPassingIfScaled: Object.fromEntries([1.05, 1.1, 1.2].map(f =>
		[f, exactHits.filter(h => h.rolls.map(r => Math.floor(r * f)).includes(h.sim)).length])),
};
const tally = (f: (h: Hit) => string | undefined) => {
	const t: { [k: string]: number } = {};
	for (const h of hits) {
		const k = f(h);
		if (k) t[k] = (t[k] ?? 0) + 1;
	}
	return t;
};
const fieldCoverage = {
	weather: tally(h => h.field.weather), terrain: tally(h => h.field.terrain),
	screens: hits.filter(h => h.field.defenderSide.isReflect || h.field.defenderSide.isLightScreen ||
		h.field.defenderSide.isAuroraVeil).length,
	boostedStat: hits.filter(h => h.atk.boostedStat || h.def.boostedStat).length,
	abilityOn: hits.filter(h => h.atk.abilityOn || h.def.abilityOn).length,
};
out.range = { games, hits: hits.length, coverage, power, fieldCoverage, causes, exact: hits.length - misses.length, inRange: hits.filter(h => h.inRange).length,
	skipped, mismatches: misses };
log(`range check: ${games} games, ${hits.length} hits, ${hits.length - misses.length} exact roll, ` +
	`${out.range.inRange} in range, skipped ${JSON.stringify(skipped)}`);
log('hits with a Z-Move, a Mega, Past content (and exact):', coverage);
log('exact-roll power:', power);
log('field coverage (hits):', fieldCoverage);
log(causes);
for (const m of misses) {
	log(`  g${m.game} t${m.turn} ${m.attacker} ${m.move}${m.z ? ' (Z)' : ''} -> ${m.defender}: sim ${m.sim}, ` +
		`calc ${m.rolls[0]}-${m.rolls.at(-1)}: ${m.cause ?? 'UNEXPLAINED'}`);
}
console.log(JSON.stringify(out, null, 1));
