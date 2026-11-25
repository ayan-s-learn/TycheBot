// Hit rate of the 48-set cache with the full key and with current HP (key field 24) dropped. Counts keys only.
// Usage: node hitrate.ts [games=100]
import { gameIds, loadPool, play } from './sim.ts';
import { readMon, readField } from './calcs.ts';
const HP = 24; // readMon's key field for current HP
const noHP = (m: any) => {
	const fields = m.key.split(',');
	if (fields[HP] !== String(m.options.curHP)) throw new Error(`key field ${HP} isn't current HP: ${m.key}`);
	return fields.filter((_: string, i: number) => i !== HP).join(',');
};
const variants = { full: (m: any) => m.key, noHP };
const stats: any = { full: [0, 0], noHP: [0, 0] };
let caches: any;
play(gameIds(0, Number(process.argv[2] ?? 100), loadPool()), {
	created() { caches = { full: [new Set(), new Set()], noHP: [new Set(), new Set()] }; },
	decision(battle, side) {
		const own = battle.sides[side], opp = battle.sides[1 - side];
		const o = own.pokemon.filter(p => !p.fainted).map(readMon), e = opp.pokemon.filter(p => !p.fainted).map(readMon);
		for (const [as, ds, a, d] of [[o, e, own, opp], [e, o, opp, own]] as const) {
			const f = readField(battle, a, d).key;
			for (const x of as.filter(m => m.sim.isActive)) for (const mv of x.moves) for (const y of ds) {
				for (const [v, k] of Object.entries(variants)) {
					const key = `${k(x)}|${k(y)}|${mv}|${f}`;
					stats[v][1]++;
					if (caches[v][side].has(key)) stats[v][0]++; else caches[v][side].add(key);
				}
			}
		}
	},
});
for (const v in stats) console.log(v, (stats[v][0] / stats[v][1]).toFixed(3), stats[v][1]);
