// Record version 2's builder for one player over one game. It sees what the player is shown and nothing else:
// the player's stream and requests (fed line by line), its own team's sets, and the set library. The opposing
// sets never reach it, so the calcs assume D7's prior for each opposing mon (prior.ts).
import { Calcs, gen, hpOf, type MonState, moveName, sideState, type Tally, trackedMon } from '../calc/calcs.ts';
import { Dex, toID } from '../sim/showdown.ts';
import { kindOf, type Request, writeMask } from '../skeleton/mask.ts';
import { BOOSTS, STATUS } from '../skeleton/record.ts';
import { Library, normalMove, type Prior } from './prior.ts';
import {
	EVENT_COLS, EVENT_SIDE, EVENTS, FIELD_ABILITIES, FIELD_NUM, HAZARDS, ID_KIND, MON_FLAGS, MOVE_NUM, N_EVENTS, OFFSET,
	SCREENS, SIDE_NUM, TERRAINS, VOLATILES, WEATHERS,
} from './record.ts';
import { newClient, type Client, type ClientPokemon } from './tracker.ts';
import { abilityId, itemId, moveId, NONE, speciesId, typeId, UNREVEALED } from './vocab.ts';

/** One builder input, in order: a line or `|request|` chunk it was fed, or a build. The leak test replays these. */
export type Entry = string | { request: string, queued: string | null, game: number };

/** The request's own mons, as far as the builder reads them. */
interface RequestMon {
	ident: string, details: string, condition: string, active: boolean, moves: string[],
	stats: { atk: number, def: number, spa: number, spd: number, spe: number }, item: string, ability?: string, baseAbility: string,
}
interface ActiveRequest { moves: { id: string, disabled?: boolean | string }[], canMegaEvo?: boolean, canZMove?: ({ move: string } | null)[] }

/** What one opposing mon has shown of the set it started with (prior.ts, Reveal), kept by Team Preview slot. */
class Shown {
	/** The species Team Preview showed, and the forme once it switched in. */
	preview = '';
	forme = '';
	item = '';
	/** It has been given an item (Trick, Thief, Pickpocket, Bestow, Pickup): items shown since aren't its own. */
	gained = false;
	ability = '';
	/** It changed forme for good (a Mega, `detailschange`): abilities shown since aren't its base ability. */
	frozen = false;
	/** Its ability was replaced this time in (Trace, Skill Swap, Mummy, Transform): reset when it leaves. */
	changed = false;
}

interface Event { type: number, side: number, own: string, opp: number, kind: number, id: number, turn: number, hp: number }

const EVENT_TYPE = new Map<string, number>();
for (const [i, [, msgs]] of EVENTS.entries()) for (const m of msgs) EVENT_TYPE.set(m, i + 1);
const VOLATILE = new Map<string, number>(VOLATILES.map((v, i) => [v, i]));
const TRAPPING = new Set(['bind', 'wrap', 'firespin', 'whirlpool', 'sandtomb', 'clamp', 'infestation', 'magmastorm', 'snaptrap', 'thundercage']);
const GAINED = new Set(['tricked', 'stolen', 'bestowed', 'found']);
const IDENT = /^p[12][a-z]?: /;
const W = Object.fromEntries(['mask', 'oppSlot', 'weather', 'terrain', 'species', 'item', 'ability', 'types', 'moves', 'status',
	'events', 'fieldNum', 'sideNum', 'hp', 'fainted', 'active', 'boosts', 'stats', 'level', 'statusTurns', 'volatiles', 'monFlags',
	'moveNum', 'calcs', 'eventHp'].map(f => [f, OFFSET[f]]));
const NV = VOLATILES.length, NF = MON_FLAGS.length, NM = MOVE_NUM.length, NS = SIDE_NUM.length, NE = EVENT_COLS.length;
const FLAG = Object.fromEntries(MON_FLAGS.map((f, i) => [f, i]));
const FN = Object.fromEntries(FIELD_NUM.map((f, i) => [f, i]));
const SN = Object.fromEntries(SIDE_NUM.map((f, i) => [f, i]));

const kwArg = (parts: string[], key: string) => {
	for (let i = 3; i < parts.length; i++) if (parts[i].startsWith(key)) return parts[i].slice(key.length).trim();
	return '';
};
/** An effect as the protocol names it (`item: Leftovers`, `ability: Rough Skin`, `move: Protect`, `Stealth Rock`). */
function effectId(effect: string): [number, number] {
	if (!effect) return [ID_KIND.none, 0];
	if (effect.startsWith('item: ')) return [ID_KIND.item, itemId(effect.slice(6))];
	if (effect.startsWith('ability: ')) return [ID_KIND.ability, abilityId(effect.slice(9))];
	const name = effect.startsWith('move: ') ? effect.slice(6) : effect;
	const move = Dex.moves.get(name);
	return move.exists ? [ID_KIND.move, moveId(move.id)] : [ID_KIND.none, 0];
}
const detailsSpecies = (details: string) => details.slice(0, (details + ',').indexOf(','));
const usedPP = (slot: ClientPokemon['moveSlots'][number]) => typeof slot.ppUsed === 'number' ? slot.ppUsed : slot.ppUsed[0];
/** The fraction of a move's PP left, as the tracker counts it (PP Ups assumed, as the sim's default). */
function ppLeft(p: ClientPokemon, id: string) {
	const slot = p.moveSlots.find(s => !s.virtual && normalMove(s.id) === id);
	if (!slot) return 1;
	const move = Dex.moves.get(id);
	const max = 'maxpp' in slot ? slot.maxpp : move.noPPBoosts ? move.pp : move.pp * 8 / 5;
	return max > 0 ? Math.max(0, 1 - usedPP(slot) / max) : 1;
}
const megaOf = (item: string, species: string) => (Dex.items.get(item).megaStone as any)?.[Dex.species.get(species).baseSpecies] as string | undefined;

export class Builder {
	readonly client: Client;
	readonly side: 'p1' | 'p2';
	private readonly foe: 'p1' | 'p2';
	private readonly own: readonly PokemonSet[];
	private readonly library: Library;
	private readonly calcs: Calcs;
	private readonly shown: Shown[] = [];
	private readonly events: Event[] = [];
	private head = 0;
	/** [own, opposing]: the side has Mega Evolved, or used a Z-Move. */
	private megaUsed = [false, false];
	private zUsed = [false, false];
	/** Opposing Team Preview slots that have had no consistent library set at some decision. */
	readonly noPrior = new Set<number>();
	/** Set to an array to record every input (Entry), for the leak test. */
	transcript?: Entry[];
	private snap: { ability: string[], item: string[], last: string[] } = { ability: [], item: [], last: [] };

	/**
	 * The player's side, its own team's sets in team order (as the sim filled them in), and the library. Nothing
	 * about the opposing team is passed: that is the first part of the leak test (plan.md, Phase 1 exit).
	 */
	constructor(side: 'p1' | 'p2', own: readonly PokemonSet[], library: Library, tally?: Tally) {
		this.side = side;
		this.foe = side === 'p1' ? 'p2' : 'p1';
		this.own = own;
		this.library = library;
		this.client = newClient(side);
		this.calcs = new Calcs([], [], tally);
	}

	/** A `|request|` chunk. */
	request(chunk: string) {
		this.transcript?.push(chunk);
		this.client.add(chunk);
	}

	/** One line of the player's stream. */
	line(l: string) {
		if (l.startsWith('|t:|')) return; // the sim's clock
		this.transcript?.push(l);
		const parts = l.split('|');
		const type = parts[1];
		const opp = this.client[this.foe];
		const snap = this.snap;
		for (const [k, p] of opp.team.entries()) {
			snap.ability[k] = p.ability;
			snap.item[k] = p.item;
			snap.last[k] = p.lastItem;
		}
		const evType = EVENT_TYPE.get(type);
		let hpMon: ClientPokemon | null = null, hp0 = 0;
		if (type === '-damage' || type === '-heal' || type === '-sethp') {
			hpMon = this.client.getPokemon(parts[2] as any);
			hp0 = hpMon ? hpOf(hpMon) : 0;
		}
		this.client.add(l);
		this.reveal(type, parts);
		if (type === '-mega' || type === '-zpower') (type === '-mega' ? this.megaUsed : this.zUsed)[+!parts[2].startsWith(this.side)] = true;
		if (evType && !(type === '-weather' && l.includes('[upkeep]'))) this.event(evType, type, parts, hpMon, hp0);
	}

	/** Updates what each opposing mon has shown of its starting set (Shown), after the tracker took line `parts`. */
	private reveal(type: string, parts: string[]) {
		const opp = this.client[this.foe];
		const subject = IDENT.test(parts[2] ?? '') && parts[2].startsWith(this.foe) ? this.client.getPokemon(parts[2] as any) : null;
		const sk = subject ? opp.team.indexOf(subject) : -1;
		while (this.shown.length < opp.team.length) this.shown.push(new Shown());
		if (sk >= 0) {
			const s = this.shown[sk];
			if (type === 'detailschange') s.frozen = true;
			else if (type === '-transform') s.changed = true;
			else if (type === '-ability') {
				const from = kwArg(parts, '[from]');
				if (from && !(from === `ability: ${parts[3]}` && !kwArg(parts, '[of]'))) {
					if (from === 'ability: Trace' && !s.ability && !s.frozen && !s.changed) s.ability = 'trace';
					s.changed = true;
				}
			} else if (type === '-activate' && parts[3] === 'move: Skill Swap') {
				s.changed = true;
				const of = this.client.getPokemon(kwArg(parts, '[of]') as any);
				if (of && opp.team.includes(of)) this.shown[opp.team.indexOf(of)].changed = true;
			}
		}
		for (const [k, p] of opp.team.entries()) {
			const s = this.shown[k];
			if (!s.preview) s.preview = p.speciesForme;
			if (!s.forme && !p.baseSpeciesForme.endsWith('-*')) s.forme = p.baseSpeciesForme;
			if (p.ability && p.ability !== this.snap.ability[k] && !s.ability && !s.frozen && !s.changed) s.ability = p.ability;
			if (GAINED.has(p.itemEffect)) s.gained = true;
			if (!s.gained && !s.item) {
				if (p.item && p.item !== this.snap.item[k]) s.item = p.item;
				else if (p.lastItem && p.lastItem !== this.snap.last[k]) s.item = p.lastItem;
			}
			if (s.changed && !opp.active.includes(p)) s.changed = false;
		}
	}

	private event(type: number, msg: string, parts: string[], hpMon: ClientPokemon | null, hp0: number) {
		const e: Event = { type, side: EVENT_SIDE.none, own: '', opp: -1, kind: ID_KIND.none, id: 0, turn: this.client.turn, hp: 0 };
		const ident = parts[2] ?? '';
		if (msg === '-sidestart' || msg === '-sideend') {
			e.side = ident.startsWith(this.side) ? EVENT_SIDE.own : EVENT_SIDE.opposing;
		} else if (IDENT.test(ident)) {
			const p = hpMon ?? this.client.getPokemon(ident as any);
			if (p) {
				if (p.side === this.client[this.side]) {
					e.side = EVENT_SIDE.own;
					e.own = p.originalIdent;
				} else {
					e.side = EVENT_SIDE.opposing;
					e.opp = this.client[this.foe].team.indexOf(p);
				}
				if (hpMon) e.hp = hpOf(p) - hp0;
			}
		}
		let kind: number = ID_KIND.none, id = 0;
		switch (msg) {
		case 'move': case '-prepare': [kind, id] = [ID_KIND.move, moveId(toID(parts[3]))]; break;
		case 'cant': if (parts[4]) [kind, id] = [ID_KIND.move, moveId(toID(parts[4]))]; break;
		case 'switch': case 'drag': case 'replace': case 'detailschange': case '-formechange':
			[kind, id] = [ID_KIND.species, speciesId(detailsSpecies(parts[3]))];
			break;
		case 'faint': {
			const p = this.client.getPokemon(ident as any);
			if (p) [kind, id] = [ID_KIND.species, speciesId(p.speciesForme)];
			break;
		}
		case '-transform': {
			const p = this.client.getPokemon(parts[3] as any);
			if (p) [kind, id] = [ID_KIND.species, speciesId(p.speciesForme)];
			break;
		}
		case '-mega': [kind, id] = [ID_KIND.item, itemId(parts[4] ?? '')]; break;
		case '-item': case '-enditem': [kind, id] = [ID_KIND.item, itemId(parts[3])]; break;
		case '-ability': case '-endability': if (parts[3]) [kind, id] = [ID_KIND.ability, abilityId(parts[3])]; break;
		case '-damage': case '-heal': case '-immune': [kind, id] = effectId(kwArg(parts, '[from]')); break;
		case '-weather': case '-fieldstart': case '-fieldend': [kind, id] = effectId(parts[2]); break;
		case '-activate': case '-start': case '-end': case '-singleturn': case '-singlemove': case '-sidestart': case '-sideend': case '-fail':
			[kind, id] = effectId(parts[3] ?? '');
			break;
		case '-boost': e.hp = +parts[4] || 0; break;
		case '-unboost': e.hp = -(+parts[4] || 0); break;
		}
		e.kind = kind;
		e.id = id;
		this.events[this.head] = e;
		this.head = (this.head + 1) % N_EVENTS;
	}

	/** D7's prior for opposing Team Preview slot k, from what it has shown. */
	private priorOf(k: number): { prior: Prior, revealed: Set<string> } {
		const p = this.client[this.foe].team[k], s = this.shown[k];
		const revealed = new Set<string>();
		for (const slot of p.moveSlots) {
			if (slot.virtual) continue;
			const move = Dex.moves.get(slot.id);
			if (move.isZ || move.isMax) continue; // a damaging Z-Move's name shows its type, not the base move
			revealed.add(normalMove(slot.id));
		}
		const forme = Dex.species.get(p.speciesForme);
		const prior = this.library.prior({
			keys: this.library.keysFor(s.forme || s.preview), item: s.item, ability: s.ability,
			mega: forme.isMega ? forme.name : '', moves: [...revealed].sort(),
		});
		return { prior, revealed };
	}

	/**
	 * Writes the record for decision `request` from word `at`. `queued` is the mon the player chose to switch in
	 * this turn, if it hasn't come in (mask.ts); `game` is the env's game counter. `times` gets ms by phase.
	 */
	build(request: Request, queued: string | null, game: number, ints: Int32Array, floats: Float32Array, at: number,
		times?: { record: number, calc: number }) {
		this.transcript?.push({ request: JSON.stringify(request), queued, game });
		const t0 = performance.now();
		const c = this.client, own = c[this.side], opp = c[this.foe];
		const req = request;
		const mons = req.side.pokemon as unknown as RequestMon[];
		if (own.team.length !== mons.length) throw new Error(`tracker has ${own.team.length} own mons, request ${mons.length}`);
		ints.fill(0, at + OFFSET.game, at + OFFSET.fieldNum);
		floats.fill(0, at + OFFSET.fieldNum, at + OFFSET.eventHp + N_EVENTS);
		ints[at + OFFSET.game] = game;
		ints[at + OFFSET.side] = this.side === 'p1' ? 0 : 1;
		ints[at + OFFSET.turn] = c.turn;
		ints[at + OFFSET.kind] = kindOf(req);
		writeMask(req, queued, ints, at + W.mask);

		// Opposing mons: the active first, then Team Preview order.
		const lead = opp.active[0] ? opp.team.indexOf(opp.active[0]) : -1;
		const order = lead >= 0 ? [lead, ...[...opp.team.keys()].filter(k => k !== lead)] : [...opp.team.keys()];
		ints.fill(-1, at + W.oppSlot, at + W.oppSlot + 6);
		const index = new Map<string, number>(mons.map((m, i) => [m.ident, i]));

		// Field.
		const f = c.field, fn = at + W.fieldNum;
		ints[at + W.weather] = f.weather ? WEATHERS.indexOf(f.weather as any) + 1 : 0;
		ints[at + W.terrain] = f.terrain ? TERRAINS.indexOf(f.terrain as any) + 1 : 0;
		if (f.weather) [floats[fn + FN.weatherMin], floats[fn + FN.weatherMax]] = [f.weatherState.minDuration, f.weatherState.maxDuration];
		if (f.terrain) [floats[fn + FN.terrainMin], floats[fn + FN.terrainMax]] = [f.terrainState.minDuration, f.terrainState.maxDuration];
		const tr = f.pseudoWeather.trickroom;
		if (tr) [floats[fn + FN.trickRoom], floats[fn + FN.trickRoomMin], floats[fn + FN.trickRoomMax]] = [1, tr.minDuration, tr.maxDuration];
		floats[fn + FN.gravity] = +!!f.pseudoWeather.gravity;
		floats[fn + FN.magicRoom] = +!!f.pseudoWeather.magicroom;
		floats[fn + FN.wonderRoom] = +!!f.pseudoWeather.wonderroom;
		for (const [s, side] of [own, opp].entries()) {
			const sn = at + W.sideNum + s * NS;
			for (const h of HAZARDS) floats[sn + SN[h]] = side.sideConditions[h]?.level ?? 0;
			for (const sc of SCREENS) {
				const cond = side.sideConditions[sc];
				if (!cond) continue;
				floats[sn + SN[sc]] = 1;
				floats[sn + SN[`${sc}Min`]] = cond.minDuration;
				floats[sn + SN[`${sc}Max`]] = cond.maxDuration;
			}
			floats[sn + SN.megaUsed] = +this.megaUsed[s];
			floats[sn + SN.zUsed] = +this.zUsed[s];
		}

		// Own mons, in the request's order, which is the tracker's.
		const ownStates: (MonState | null)[] = [];
		const ownFainted = mons.filter(m => m.condition.endsWith(' fnt')).length;
		const active = (req as { active?: ActiveRequest[] }).active?.[0];
		for (const [i, r] of mons.entries()) {
			const p = own.team[i];
			const fainted = r.condition.endsWith(' fnt');
			const species = detailsSpecies(r.details);
			this.monCommon(p, i, ints, floats, at, fainted);
			ints[at + W.species + i] = speciesId(species);
			ints[at + W.item + i] = itemId(r.item);
			ints[at + W.ability + i] = abilityId(r.ability ?? r.baseAbility);
			floats[at + W.active + i] = +(r.active && !fainted && !req.teamPreview);
			const st = at + W.stats + 6 * i;
			[floats[st], floats[st + 1], floats[st + 2], floats[st + 3], floats[st + 4], floats[st + 5]] =
				[p.maxhp, r.stats.atk, r.stats.def, r.stats.spa, r.stats.spd, r.stats.spe];
			const mf = at + W.monFlags + NF * i;
			const item = Dex.items.get(r.item);
			const isMega = Dex.species.get(species).isMega;
			floats[mf + FLAG.canMega] = i === 0 && active ? +!!active.canMegaEvo : +(!!megaOf(r.item, species) && !isMega && !this.megaUsed[0]);
			floats[mf + FLAG.isMega] = +!!isMega;
			floats[mf + FLAG.holdsZ] = +!!item.zMove;
			floats[mf + FLAG.priorConfidence] = 1;
			for (let j = 0; j < r.moves.length && j < 4; j++) {
				const id = normalMove(r.moves[j]);
				ints[at + W.moves + 4 * i + j] = moveId(r.moves[j]);
				const mn = at + W.moveNum + NM * (4 * i + j);
				floats[mn] = 1;
				floats[mn + 1] = ppLeft(p, id);
				if (i === 0 && active) {
					const a = active.moves.findIndex(m => normalMove(m.id) === id);
					floats[mn + 2] = +(a >= 0 && !!active.moves[a].disabled);
					floats[mn + 3] = +(a >= 0 && !!active.canZMove?.[a]);
				} else if (item.zMove && !this.zUsed[0]) {
					const move = Dex.moves.get(id);
					floats[mn + 3] = +(item.zMoveFrom ? item.zMoveFrom === move.name : item.zMoveType === move.type);
				}
			}
			if (fainted) {
				ownStates.push(null);
				continue;
			}
			const set = this.own.find(s => (s.name || s.species) === p.name);
			if (!set) throw new Error(`no own set named ${p.name}`);
			ownStates.push(trackedMon(p, p.speciesForme, gen.items.get(p.item)?.name, gen.abilities.get(p.ability)?.name,
				set, r.moves.map(id => moveName(id, set.hpType)), ownFainted));
		}

		// Opposing mons, on D7's prior.
		const oppStates: (MonState | null)[] = [];
		const oppFainted = opp.team.filter(p => p.fainted).length;
		let oppAbility: string | undefined;
		for (const [r, k] of order.entries()) {
			const p = opp.team[k], j = 6 + r;
			ints[at + W.oppSlot + r] = k;
			this.monCommon(p, j, ints, floats, at, p.fainted);
			ints[at + W.species + j] = speciesId(p.speciesForme);
			ints[at + W.item + j] = p.item ? itemId(p.item) : p.lastItem ? NONE : UNREVEALED;
			const ability = p.ability || p.baseAbility;
			ints[at + W.ability + j] = ability ? abilityId(ability) : UNREVEALED;
			floats[at + W.active + j] = +opp.active.includes(p);
			const { prior, revealed } = this.priorOf(k);
			const mf = at + W.monFlags + NF * j;
			const isMega = Dex.species.get(p.speciesForme).isMega;
			floats[mf + FLAG.canMega] = +(!!p.item && !!megaOf(p.item, p.speciesForme) && !isMega && !this.megaUsed[1]);
			floats[mf + FLAG.isMega] = +!!isMega;
			floats[mf + FLAG.holdsZ] = +(!!p.item && !!Dex.items.get(p.item).zMove);
			floats[mf + FLAG.formeHidden] = +p.speciesForme.endsWith('-*');
			floats[mf + FLAG.priorConfidence] = prior.confidence;
			floats[mf + FLAG.noPrior] = +!prior.set;
			const moves = prior.set ? prior.set.set.moves.map(m => toID(m)) : [...revealed];
			for (let m = 0; m < moves.length && m < 4; m++) {
				const id = normalMove(moves[m]);
				ints[at + W.moves + 4 * j + m] = moveId(moves[m]);
				const mn = at + W.moveNum + NM * (4 * j + m);
				floats[mn] = +revealed.has(id);
				floats[mn + 1] = ppLeft(p, id);
			}
			if (!prior.set) this.noPrior.add(k);
			const set = prior.set?.set;
			// A forme Team Preview hides is the prior's; so is the shown forme when it is the prior's key (Greninja).
			const forme = set && (p.speciesForme.endsWith('-*') || this.library.keysFor(p.speciesForme)[0] === set.species &&
				!Dex.species.get(p.speciesForme).battleOnly) ? set.species : p.speciesForme;
			// After a forme change (Mega Evolution) the calc takes its default ability for the new forme.
			const calcAbility = p.ability ? gen.abilities.get(p.ability)?.name : forme !== set?.species ? undefined : set.ability;
			if (r === 0 && lead >= 0 && !p.fainted) oppAbility = calcAbility;
			if (p.fainted || !set) {
				oppStates.push(null);
				continue;
			}
			const item = p.item ? gen.items.get(p.item)?.name : p.lastItem ? undefined : set.item || undefined;
			oppStates.push(trackedMon(p, forme, item, calcAbility, set, set.moves.map(m => moveName(toID(m), set.hpType)), oppFainted));
		}

		// Field-wide abilities of the actives (opposing: as calced), for the calcs and the record.
		const abilities: (typeof FIELD_ABILITIES[number])[] = [];
		const lead0 = mons[0];
		const ownActive = lead0?.active && !lead0.condition.endsWith(' fnt') && !req.teamPreview
			? gen.abilities.get(toID(lead0.ability ?? lead0.baseAbility))?.name : undefined;
		for (const a of FIELD_ABILITIES) {
			if (a === ownActive || a === oppAbility) {
				abilities.push(a);
				floats[fn + FN[a]] = 1;
			}
		}

		// Events, newest first.
		for (let e = 0; e < N_EVENTS; e++) {
			const ev = this.events[(this.head - 1 - e + 2 * N_EVENTS) % N_EVENTS];
			if (!ev) break;
			const b = at + W.events + NE * e;
			const slot = ev.side === EVENT_SIDE.own ? index.get(ev.own) ?? -1 : ev.side === EVENT_SIDE.opposing && ev.opp >= 0 ? 6 + order.indexOf(ev.opp) : -1;
			[ints[b], ints[b + 1], ints[b + 2], ints[b + 3], ints[b + 4], ints[b + 5]] = [ev.type, ev.side, slot, ev.kind, ev.id, ev.turn];
			floats[at + W.eventHp + e] = ev.hp;
		}

		const t1 = performance.now();
		this.calcs.compute(ownStates, oppStates, {
			weather: f.weather, terrain: f.terrain, gravity: !!f.pseudoWeather.gravity, magicRoom: !!f.pseudoWeather.magicroom,
			wonderRoom: !!f.pseudoWeather.wonderroom, sides: [sideState(own), sideState(opp)], abilities,
		}, floats, at + W.calcs);
		if (times) {
			times.record += t1 - t0;
			times.calc += performance.now() - t1;
		}
	}

	/** The fields both sides fill the same way from the tracker. */
	private monCommon(p: ClientPokemon, j: number, ints: Int32Array, floats: Float32Array, at: number, fainted: boolean) {
		ints[at + W.status + j] = fainted ? 0 : STATUS[p.status ?? ''] ?? 0;
		const types = p.types;
		ints[at + W.types + 2 * j] = typeId(types[0]);
		ints[at + W.types + 2 * j + 1] = typeId(types[1] ?? '');
		floats[at + W.hp + j] = hpOf(p);
		floats[at + W.fainted + j] = +fainted;
		for (let b = 0; b < 7; b++) floats[at + W.boosts + 7 * j + b] = p.boosts[BOOSTS[b]] ?? 0;
		floats[at + W.level + j] = p.level;
		floats[at + W.statusTurns + 2 * j] = p.statusState.sleepTurns;
		floats[at + W.statusTurns + 2 * j + 1] = p.statusState.toxicTurns;
		const v = at + W.volatiles + NV * j;
		for (const id in p.volatiles) {
			let i = VOLATILE.get(id), value = 1;
			if (i === undefined) {
				if (TRAPPING.has(id)) i = VOLATILE.get('partiallytrapped');
				else if (/^fallen\d$/.test(id)) [i, value] = [VOLATILE.get('fallen'), +id.slice(6) / 5];
				else if (id.startsWith('protosynthesis')) i = VOLATILE.get('protosynthesis');
				else if (id.startsWith('quarkdrive')) i = VOLATILE.get('quarkdrive');
				if (i === undefined) continue;
			}
			if (id === 'stockpile') value = (p.volatiles[id].level ?? 1) / 3;
			floats[v + i] = value;
		}
	}
}
