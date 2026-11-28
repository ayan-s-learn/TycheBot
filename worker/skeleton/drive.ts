// Steps an Env in-process, with actions picked in Node: for tests and tasks/T09-skeleton/inproc.ts.
import type { Env } from './env.ts';

export interface Step { ints: Int32Array, floats: Float32Array, n: number }

/**
 * One env step. `inspect` sees the records, then `pick` gets each decision's index and mask, before any
 * action is applied.
 */
export function step(env: Env, pick: (i: number, mask: Int32Array) => number, inspect?: (s: Step) => void): Step {
	const n = env.collect();
	const words = env.recordWords;
	const buf = new ArrayBuffer(Math.max(1, n) * words * 4);
	const ints = new Int32Array(buf), floats = new Float32Array(buf);
	env.encode(ints, floats, 0);
	inspect?.({ ints, floats, n });
	const actions = new Int32Array(n);
	for (let i = 0; i < n; i++) {
		actions[i] = pick(i, ints.subarray(i * words + env.maskOffset, i * words + env.maskOffset + 18));
	}
	env.apply(actions, ints, 0);
	return { ints, floats, n };
}

/** A uniformly random legal action, from a `random(n)` in [0, n). */
export function randomLegal(mask: Int32Array, random: (n: number) => number) {
	const legal: number[] = [];
	for (let a = 0; a < mask.length; a++) if (mask[a]) legal.push(a);
	return legal[random(legal.length)];
}
