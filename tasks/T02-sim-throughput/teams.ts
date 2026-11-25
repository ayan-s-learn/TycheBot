// Builds teams/pool.jsonl from Smogon's NatDex sample teams (the JSON at SOURCE, downloaded to a local
// file first) and validates it and teams/illusion.txt as `validate-team gen9nationaldex` does at the pin.
// Usage: node teams.ts <downloaded gen9nationaldex.json>   (exit code 1 if any team fails)
import { readFileSync, writeFileSync } from 'node:fs';
import { FORMAT, Teams, TeamValidator, Dex } from './sim.ts';

const SOURCE = 'https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json';
const validator = TeamValidator.get(FORMAT);
const here = (f: string) => new URL(f, import.meta.url);

function check(label: string, text: string) {
	// validateTeam can modify sets, so validate one import and pack another.
	const errors = validator.validateTeam(Teams.import(text));
	if (errors) console.log(`${label}: INVALID\n  ${errors.join('\n  ')}`);
	const team = Teams.import(text)!;
	const items = team.map(s => Dex.items.get(s.item));
	console.log(`${label}: ${errors ? 'rejected' : 'valid'}; ` +
		`mega: ${items.filter(i => i.megaStone).map(i => i.name).join(', ') || '-'}; ` +
		`z: ${items.filter(i => i.zMove).map(i => i.name).join(', ') || '-'}; ` +
		`species: ${team.map(s => s.species).join(', ')}`);
	return { valid: !errors, packed: Teams.pack(team) };
}

// Not Teams.import(JSON): it passes species through Dex.getName, which cuts names to 18 characters
// (Urshifu-Rapid-Strike becomes Urshifu-Rapid-Stri). Packing the sets as given keeps them whole.
function packJSON(data: Partial<PokemonSet>[]) {
	return Teams.pack(data.map(s => ({
		name: '', ...s,
		evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...s.evs },
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31, ...s.ivs },
	}) as PokemonSet));
}

let failures = 0;
const lines = [];
const sample: { name: string, author: string, data: PokemonSet[] }[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [i, t] of sample.entries()) {
	const { valid, packed } = check(`sample ${i}`, packJSON(t.data));
	if (!valid) {
		failures++;
		continue;
	}
	lines.push(JSON.stringify({ source: SOURCE, index: i, name: t.name, author: t.author, team: packed }));
}
writeFileSync(here('teams/pool.jsonl'), lines.join('\n') + '\n');
console.log(`teams/pool.jsonl: ${lines.length} of ${sample.length} sample teams`);
if (!check('teams/illusion.txt', readFileSync(here('teams/illusion.txt'), 'utf8')).valid) failures++;
process.exit(failures ? 1 : 0);
