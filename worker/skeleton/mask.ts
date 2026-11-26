// The action space and mask (plan.md, Network v0: Action head): 4 moves x {plain, Mega Evolve, Z-Move},
// action 3i + v, then a switch per team slot, 12 + j. Moves are mapped by the request's current index
// (the list shrinks for locked moves, Struggle and Recharge) and switches by the request's current order.
// At Team Preview the switch actions pick the lead.
import { KIND } from './record.ts';

export const N_ACTIONS = 18;
export const SWITCH = 12;

export interface Request {
	wait?: boolean;
	teamPreview?: boolean;
	forceSwitch?: boolean[];
	active?: {
		moves: { id: string, disabled?: boolean | string }[];
		canMegaEvo?: boolean;
		canZMove?: ({ move: string } | null)[];
		trapped?: boolean;
	}[];
	side: { pokemon: { ident: string, active: boolean, condition: string }[] };
}

export function kindOf(r: Request): number {
	return r.teamPreview ? KIND.preview : r.forceSwitch ? KIND.switch : KIND.move;
}

export const monName = (ident: string) => ident.slice(ident.indexOf(': ') + 2);

/**
 * Writes the mask for request `r` into `out` from `offset`. `queued` names the mon the player chose to
 * switch in this turn, if it hasn't come in yet. A forced switch mid-turn (Eject Pack, set off by
 * Intimidate) still lists it, but the sim rejects choosing it as `[Invalid choice]` (T02), so it is masked.
 */
export function writeMask(r: Request, queued: string | null, out: Int32Array, offset: number) {
	out.fill(0, offset, offset + N_ACTIONS);
	const mons = r.side.pokemon;
	const benched = (j: number) => !mons[j].active && !mons[j].condition.endsWith(' fnt');
	let legal = 0;
	if (r.teamPreview) {
		for (let j = 0; j < mons.length; j++) out[offset + SWITCH + j] = 1;
		return;
	}
	if (r.forceSwitch) {
		for (let j = 0; j < mons.length; j++) {
			if (benched(j) && monName(mons[j].ident) !== queued) out[offset + SWITCH + j] = legal = 1;
		}
	} else {
		const a = r.active![0];
		for (let i = 0; i < a.moves.length && i < 4; i++) {
			if (!a.moves[i].disabled) {
				out[offset + 3 * i] = legal = 1;
				if (a.canMegaEvo) out[offset + 3 * i + 1] = 1;
			}
			// Showdown checks only PP for a Z-Move, not whether the base move is disabled (sim/side.ts).
			if (a.canZMove?.[i]) out[offset + 3 * i + 2] = legal = 1;
		}
		if (!a.trapped) {
			for (let j = 0; j < mons.length; j++) if (benched(j)) out[offset + SWITCH + j] = legal = 1;
		}
	}
	if (!legal) throw new Error(`no legal action for ${JSON.stringify(r)}`);
}

/** The choice string for `action` in request `r`. */
export function choiceOf(r: Request, action: number) {
	if (action >= SWITCH) return `${r.teamPreview ? 'team' : 'switch'} ${action - SWITCH + 1}`;
	const v = action % 3;
	return `move ${(action - v) / 3 + 1}${v === 1 ? ' mega' : v === 2 ? ' zmove' : ''}`;
}
