// At the end of each scenario, compares what @pkmn/client tracks for each side's active mon (types incl. added type, species, ability, item,
// boosts) with the sim's. The own side's request-fed fields are included; the opposing side's unknown ones are skipped.
import { readFileSync } from 'node:fs';
import { Battle } from '@pkmn/client';
import { generations } from '../pkmn.ts';
const meta = JSON.parse(readFileSync('out/meta.json', 'utf8'));
const gens = generations('natdex');
const id = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
for (const line of readFileSync('out/games.jsonl', 'utf8').trim().split('\n')) {
	const g = JSON.parse(line);
	const m = meta.find((x: any) => x.name === g.name);
	for (const [si, side] of (['p1', 'p2'] as const).entries()) {
		const b = new Battle(gens, side as any);
		for (const chunk of g[side] as string[]) {
			if (chunk.startsWith('|error|')) continue;
			for (const l of chunk.split('\n')) if (l.startsWith('|')) { try { b.add(l); } catch (e) { console.log(g.name, side, 'THROW', l.slice(0, 60)); } }
		}
		for (const [who, tside, sideObj] of [['own', si, b[side]], ['opp', 1 - si, b[side].foe]] as const) {
			const t = m.final[tside].find((p: any) => p.active);
			const p = sideObj.active[0];
			if (!t || !p || t.hp === 0) continue;
			const diffs: string[] = [];
			const types = [...p.types, ...(p.addedType ? [p.addedType] : [])];
			if (id(types.slice().sort()) !== id(t.types.slice().sort())) diffs.push(`types sim=${t.types} tracker=${types}`);
			if (id(p.speciesForme) !== id(t.species)) diffs.push(`species sim=${t.species} tracker=${p.speciesForme}`);
			if (who === 'own' || p.ability) if (id(p.ability) !== id(t.ability)) diffs.push(`ability sim=${t.ability} tracker=${p.ability}`);
			if (who === 'own' || p.item) if (id(p.item) !== id(t.item)) diffs.push(`item sim=${t.item} tracker=${p.item}`);
			const bo = Object.fromEntries(Object.entries(p.boosts).filter(([, v]) => v));
			const tb = Object.fromEntries(Object.entries(t.boosts).filter(([k, v]) => v && !['accuracy', 'evasion'].includes(k)));
			if (JSON.stringify(bo) !== JSON.stringify(tb)) diffs.push(`boosts sim=${JSON.stringify(tb)} tracker=${JSON.stringify(bo)}`);
			if (diffs.length) console.log(`${g.name} as ${side} ${who} ${t.name}: ${diffs.join('; ')}`);
		}
	}
}
