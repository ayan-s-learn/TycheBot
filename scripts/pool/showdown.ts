// Showdown at the pin, and the set checks and readings shared by T12's pool and library builds.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

type PS = typeof import('../../vendor/pokemon-showdown/dist/sim/index.js');

export const FORMAT = 'gen9nationaldex';
export const root = (relative: string) => fileURLToPath(new URL(`../../${relative}`, import.meta.url));

// A checkout left at an old pin would validate against old rules without complaint.
export const PIN = readFileSync(root('showdown.pin'), 'utf8').trim();
const head = execFileSync('git', ['-C', root('vendor/pokemon-showdown'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== PIN) {
	throw new Error(`vendor/pokemon-showdown is at ${head}, but showdown.pin says ${PIN}: run scripts/setup-showdown.sh`);
}

const require = createRequire(import.meta.url);
export const { Dex, Teams, TeamValidator, toID }: PS = require(root('vendor/pokemon-showdown/dist/sim/index.js'));
export const dex = Dex.forFormat(FORMAT);
const validator = TeamValidator.get(FORMAT);

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const RESPELLED = new Set<string>(['species', 'item', 'ability', 'moves']);
const FILLED_IN = new Set<string>(['gender', 'nature', 'hpType', 'teraType', 'pokeball', 'gigantamax', 'dynamaxLevel']);

// Every field of a set but its name, with the sim's default where a packed set leaves it out.
// The same reading as scripts/validate-pool.ts, so a set that passes here passes there.
function read(set: PokemonSet) {
	const stats = (given: Partial<StatsTable> | undefined, fill: number) => STATS.map(s => given?.[s] ?? fill).join('/');
	return {
		species: toID(set.species), item: toID(set.item), ability: toID(set.ability), moves: set.moves.map(toID).join(),
		level: set.level || 100, evs: stats(set.evs, 0), ivs: stats(set.ivs, 31),
		shiny: !!set.shiny, happiness: set.happiness ?? 255,
		gender: set.gender, nature: set.nature, hpType: set.hpType, teraType: set.teraType, pokeball: set.pokeball,
		gigantamax: set.gigantamax, dynamaxLevel: set.dynamaxLevel,
	};
}

// Problems with a packed team (or one packed set), or null. As scripts/validate-pool.ts: canonical packed form,
// Showdown's validator, and no value changed by validation. `size` is the number of Pokemon required.
export function problems(packed: string, size: number): string[] | null {
	const sets = Teams.unpack(packed);
	if (!sets || Teams.pack(sets) !== packed) return ['not a canonical packed team'];
	if (sets.length !== size) return [`${sets.length} Pokemon, not ${size}`];
	const found = validator.validateTeam(sets);
	if (found) return found;
	const changes = Teams.unpack(packed)!.flatMap((written, i) => {
		const before = read(written);
		const after = read(sets[i]);
		return (Object.keys(before) as (keyof typeof before)[])
			.filter(key => before[key] !== after[key] && !(FILLED_IN.has(key) && !before[key]))
			.map(key => {
				const [from, to] = RESPELLED.has(key) ? [written, sets[i]].map(s => s[key]) : [before[key], after[key]];
				return `${written.species}: the validator changes ${key} ${JSON.stringify(from)} to ${JSON.stringify(to)}`;
			});
	});
	return changes.length ? changes : null;
}

const fill = (given: Partial<StatsTable> | undefined, value: number) =>
	Object.fromEntries(STATS.map(s => [s, given?.[s] ?? value])) as StatsTable;

// Strips what the protocol shows but a set doesn't need: nickname, shininess, gender (the sim then picks one
// per battle, unless the species has a fixed one), ball and Tera type (Tera is banned). A nickname or shiny
// would let the opposing seat tell pool teams apart without resampling hiding it.
export function normalize(set: PokemonSet): PokemonSet {
	const out: PokemonSet = {
		name: '', species: set.species, item: set.item || '', ability: set.ability || '', moves: [...set.moves],
		nature: set.nature || '', gender: '', evs: fill(set.evs as Partial<StatsTable> | undefined, 0),
		ivs: fill(set.ivs as Partial<StatsTable> | undefined, 31), level: set.level || 100,
	};
	if (set.happiness !== undefined && set.happiness !== 255) out.happiness = set.happiness;
	if (set.hpType) out.hpType = set.hpType;
	return out;
}

// Packs sets canonically. Repacking once fixes respelled names, such as "U-Turn" (team-pool.md, Gotchas).
export const pack = (sets: PokemonSet[]) => Teams.pack(Teams.unpack(Teams.pack(sets))!);

// The species name the usage stats count a set under: the Mega forme when it holds its own Mega Stone.
export function statsSpecies(set: PokemonSet): string {
	const species = dex.species.get(set.species).name;
	const stone = dex.items.get(set.item).megaStone as Record<string, string> | undefined;
	return stone?.[species] ?? species;
}

const REMOVAL = new Set(['rapidspin', 'defog', 'mortalspin', 'tidyup', 'courtchange']);
// What set resampling keeps per team (D4): Mega and Z counts, a Stealth Rock setter, hazard removal.
export function tags(set: PokemonSet) {
	const moves: string[] = set.moves.map(toID);
	return {
		mega: statsSpecies(set) !== dex.species.get(set.species).name,
		z: !!dex.items.get(set.item).zMove,
		rocks: moves.includes('stealthrock'),
		removal: moves.some(m => REMOVAL.has(m)),
	};
}
