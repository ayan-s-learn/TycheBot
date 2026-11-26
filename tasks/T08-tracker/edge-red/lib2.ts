import { start, go, team, cmp, show, simShow, dump, type Run } from './h.ts';
export { team };
export type S = [string | null, string | null] | [string | null, string | null, string];
/** Plays steps; after each prints new p1-view lines (when v) and client-vs-sim diffs. */
export function play(name: string, t1: string, t2: string, steps: S[], o: { seed?: number, v?: boolean | number[], fmt?: string, show?: ('p1' | 'p2')[], mk?: any } = {}) {
	console.log(`\n===== ${name}`);
	const r = start(t1, t2, o.seed ?? 1, o.fmt ?? 'gen9nationaldex', o.mk);
	let pos = [r.chunks[0].length, r.chunks[1].length];
	steps.forEach((s, i) => {
		const [a, c, note] = s as any;
		go(r, [a, c]);
		const verbose = o.v === true || (Array.isArray(o.v) && o.v.includes(i));
		console.log(`-- step ${i} ${a} / ${c} ${note ?? ''}`);
		if (verbose) {
			const txt = r.chunks[0].slice(pos[0]).filter(x => !x.startsWith('|request|')).join('\n').split('\n').filter(l => l && !l.startsWith('|t:|')).join('\n');
			console.log(txt.replace(/^/gm, '   | '));
		}
		pos = [r.chunks[0].length, r.chunks[1].length];
		for (const side of ['p1', 'p2'] as const) { const d = cmp(r, side, `s${i}`); if (!d.endsWith(' ok')) console.log(d); }
		if (r.errors.length) { console.log('  ERRORS', r.errors); r.errors.length = 0; }
		if (o.show?.length && (o.v === true || (Array.isArray(o.v) && o.v.includes(i)))) for (const sd of o.show) { console.log(show(r, sd, { own: false })); console.log(simShow(r, sd === 'p1' ? 'p2' : 'p1')); }
	});
	dump(name, r);
	return r;
}
