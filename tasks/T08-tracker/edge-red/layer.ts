// A thin layer over an unmodified @pkmn/client 0.7.4 Battle: a subclass that overrides the public `add` and
// `update` only. No file in node_modules is touched and no handler method is monkey-patched.
import { Battle } from '@pkmn/client';
import type { Generations, ID } from '@pkmn/data';

type Pk = InstanceType<typeof Battle>['p1']['team'][number];
const sideOf = (ident: string) => ident.slice(0, 2) as 'p1' | 'p2';
const baseMove = (id: string) => id.replace(/^(hiddenpower)[a-z]*\d*$|^(return|frustration)\d+$/, (_m, a, b) => a ?? b);

interface Snap { hp: number, status: any, moves: string[], item: string, ability: string, itemEffect: any }

export class FixedBattle extends Battle {
	megaUsed = { p1: false, p2: false };
	zUsed = { p1: false, p2: false };
	/** What each active mon held when it came in, to tell what was attributed to it while an Illusion held. */
	private entered = new Map<Pk, Snap>();

	constructor(gens: Generations, player?: ID | null) { super(gens, player); }

	// Fix 1: request slots lack `virtual`, so rememberMove adds a second slot; and ids like return102.
	override update(r: any) {
		super.update(r);
		for (const s of this.sides) for (const p of s.team) {
			for (const m of p.moveSlots) { m.virtual ??= false; (m as any).id = baseMove(m.id); }
			const seen = new Set<string>();
			p.moveSlots = p.moveSlots.filter(m => !seen.has(m.id) && !!seen.add(m.id));
		}
	}

	override add(a: any, b?: any) {
		if (typeof a !== 'string') return super.add(a, b);
		const line = a;
		const parts = line.split('|');
		const type = parts[1];
		// Fix 2: Mega-used and Z-used, which -mega and -zpower announce and the client doesn't keep.
		if (type === '-mega') this.megaUsed[sideOf(parts[2])] = true;
		if (type === '-zpower') this.zUsed[sideOf(parts[2])] = true;

		// Fix 6: -prepare (Fly, Dig, Bounce, Phantom Force, Solar Beam...) has no handler in the client.
		if (type === '-prepare') {
			const p = this.getPokemon(parts[2] as any);
			const mv = this.gen.moves.get(parts[3]);
			if (p && mv) { p.addVolatile('twoturnmove' as any, { duration: 'move' } as any); p.addVolatile(mv.id as any, { duration: 'move' } as any); }
		}

		// Fix 3: a damaging Z-Move's name is recorded as one of the mon's moves.
		let zActor: Pk | null = null;
		if (type === 'move' && this.gen.moves.get(parts[3])?.isZ) zActor = this.getPokemon(parts[2] as any);

		// Fix 4: -heal without [from] runs the Healing Wish branch and zeroes the status counters.
		let saved: [Pk, number, number] | null = null;
		if (type === '-heal' && !parts.some(x => x.startsWith('[from]'))) {
			const p = this.getPokemon(parts[2] as any);
			if (p) saved = [p, p.statusState.sleepTurns, p.statusState.toxicTurns];
		}
		const zBefore = zActor ? zActor.moveSlots.length : 0;

		// Fix 5: Illusion. At |replace|, what the client put on the disguise's entry since it came in
		// belongs to the Zoroark (moves, item, ability); the disguise's entry gets its own entry state back.
		let disguise: Pk | null = null;
		if (type === 'replace') {
			const side = this[sideOf(parts[2])];
			disguise = side.active[this.parsePokemonId(parts[2] as any).slot] ?? null;
		}
		const disguiseNow = disguise && { moves: disguise.moveSlots.map(m => ({ ...m })), item: disguise.item, ability: disguise.ability, lastItem: disguise.lastItem, itemEffect: disguise.itemEffect };

		super.add(a, b);

		if (zActor) zActor.moveSlots.splice(zBefore);
		if (saved) { saved[0].statusState.sleepTurns = saved[1]; saved[0].statusState.toxicTurns = saved[2]; }
		for (const s of this.sides) for (const p of s.team) if (p.statusState.toxicTurns > 15) p.statusState.toxicTurns = 15;

		if (type === 'switch' || type === 'drag') {
			const p = this.getPokemon(parts[2] as any);
			if (p) this.entered.set(p, { hp: p.hp, status: p.status, moves: p.moveSlots.map(m => m.id), item: p.item, ability: p.ability, itemEffect: p.itemEffect });
		}
		if (type === 'replace' && disguise && disguiseNow) {
			const side = this[sideOf(parts[2])];
			const zoroark = side.active[this.parsePokemonId(parts[2] as any).slot];
			const was = this.entered.get(disguise);
			if (zoroark && zoroark !== disguise && was) {
				// Moves added since entry go to the Zoroark; the disguise keeps the ones it held at entry.
				const added = disguiseNow.moves.filter(m => !was.moves.includes(m.id));
				for (const m of added) if (!zoroark.moveSlots.some(z => z.id === m.id)) zoroark.moveSlots.push(m);
				disguise.moveSlots = disguise.moveSlots.filter(m => was.moves.includes(m.id));
				if (disguiseNow.item !== was.item) { zoroark.item = disguiseNow.item as ID; disguise.item = was.item as ID; }
				if (disguiseNow.ability !== was.ability && disguiseNow.ability) { zoroark.ability = disguiseNow.ability as ID; disguise.ability = was.ability as ID; }
				// (hp and status of the disguise entry left as the client resets them)
			}
		}
	}
}
