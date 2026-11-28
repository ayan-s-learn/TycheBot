// Builds data/pool/v1/ (teams.jsonl, holdout.txt) and data/priors/v0/species_sets.json from T12's snapshots in
// tasks/T12-pool-v1/evidence/ (fetched by scripts/pool/fetch.sh), and prints the report T12's Result quotes.
// Usage, from the root: node scripts/pool/build.ts [out dir]   (default: the repo root)
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { FORMAT, PIN, Teams, TeamValidator, dex, normalize, pack, problems, root, statsSpecies, tags, toID } from './showdown.ts';

const EV = root('tasks/T12-pool-v1/evidence');
const STATS_MONTH = '2026-10';
const STATS_URL = `https://www.smogon.com/stats/${STATS_MONTH}/chaos/gen9nationaldex-1760.json`;
const SAMPLE_URL = 'https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json';
const SETS_URL = 'https://pkmn.github.io/smogon/data/sets/gen9nationaldex.json';
const POOL_SIZE = 50;
const HELD_OUT = 10;
// Pool candidates: the sample teams and pastes posted on or after this date. Older pastes are only counted.
const RECENT = '2026-04-01';
// Two pool teams share at most this many species.
const MAX_SHARED = 4;
// Weight of the Mega and Z per-team rates against the species distance in the selection objective.
const RATE_WEIGHT = 0.5;
const out = process.argv[2] ?? root('.');

const gz = (file: string) => gunzipSync(readFileSync(`${EV}/${file}`)).toString('utf8');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (x: number, digits = 4) => Number(x.toFixed(digits));
// Code-unit order, so the output doesn't depend on the locale.
const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// ---- Usage stats ----

interface ChaosEntry { usage: number, Abilities: Record<string, number>, Items: Record<string, number>, Moves: Record<string, number> }
const chaos: { info: { 'number of battles': number }, data: Record<string, ChaosEntry> } =
	JSON.parse(gz(`chaos-gen9nationaldex-1760-${STATS_MONTH}.json.gz`));
const usageTotal = sum(Object.values(chaos.data).map(e => e.usage));
// Per-team rates at the 1760 cutoff: usage is the share of teams with the species (it sums to ~6).
const target = {
	mega: sum(Object.entries(chaos.data).filter(([s]) => dex.species.get(s).isMega).map(([, e]) => e.usage)),
	z: sum(Object.values(chaos.data).map(e => {
		const total = sum(Object.values(e.Abilities));
		return e.usage * sum(Object.entries(e.Items).filter(([i]) => dex.items.get(i).zMove).map(([, n]) => n)) / total;
	})),
};

// The usage-stats entry a set counts under: the Mega forme for a Mega set, and otherwise the set's species, or
// the forme it changes from or its base species when the stats have no entry of its own (they count
// Keldeo-Resolute as Keldeo and Greninja-Bond as Greninja).
const fallbacks = new Set<string>();
function statsKey(set: PokemonSet): string {
	const name = statsSpecies(set);
	const species = dex.species.get(name);
	const key = [name, species.changesFrom, species.baseSpecies].find(n => n && chaos.data[n]) ?? name;
	if (key !== name) fallbacks.add(`${name} as ${key}`);
	return key;
}

// D4: the product of the species' marginals for its item, ability and moves. A Mega set is counted under its
// Mega forme, whose stats list the stone and the Mega's ability, so those two factors come out near 1.
function weigh(set: PokemonSet): { weight: number, missing: string[] } {
	const key = statsKey(set);
	const entry = chaos.data[key];
	if (!entry) return { weight: 0, missing: [`species ${key}`] };
	const total = sum(Object.values(entry.Abilities));
	const ability = tags(set).mega ? toID(dex.species.get(key).abilities[0]) : toID(set.ability);
	const factors: [string, number | undefined][] = [
		[`item ${set.item || 'none'}`, entry.Items[toID(set.item) || 'nothing']],
		[`ability ${ability}`, entry.Abilities[ability]],
		...set.moves.map(m => [`move ${m}`, entry.Moves[toID(m)]] as [string, number | undefined]),
	];
	const missing = factors.filter(([, n]) => !n).map(([what]) => what);
	return { weight: missing.length ? 0 : factors.reduce((w, [, n]) => w * n! / total, 1), missing };
}

// The species' most used legal ability in the stats, or its first if the stats have none.
function defaultAbility(name: string): string {
	const legal = Object.values(dex.species.get(name).abilities);
	const used = chaos.data[dex.species.get(name).name]?.Abilities ?? {};
	return [...legal].sort((a, b) => (used[toID(b)] ?? 0) - (used[toID(a)] ?? 0))[0];
}

// The battle-only formes of each species (Diancie: Diancie-Mega), with the items that make them, if any.
const battleFormes = new Map<string, { abilities: Set<string>, items: string[] }[]>();
for (const forme of dex.species.all()) {
	for (const base of [forme.battleOnly ?? []].flat()) {
		if (!battleFormes.has(base)) battleFormes.set(base, []);
		battleFormes.get(base)!.push({
			abilities: new Set(Object.values(forme.abilities).map(a => toID(a))),
			items: [forme.requiredItem ?? [], forme.requiredItems ?? []].flat().map(i => toID(i)),
		});
	}
}
// Whether the ability is that of the in-battle forme this set becomes: the Mega or Primal forme its item makes,
// or a forme no item makes (Terapagos-Terastal). Only then does the validator repair it rather than reject it.
const inBattleAbility = (species: string, item: string, ability: string) =>
	(battleFormes.get(species) ?? []).some(f => (!f.items.length || f.items.includes(toID(item))) && f.abilities.has(toID(ability)));

// Rewrites the source conventions the validator would otherwise repair, so the stored set passes unrepaired.
// Pastes exported from Showdown and the analyses name the in-battle forme (Diancie-Mega, Terapagos-Terastal) and
// its ability (Magic Bounce, Tera Shell). The set becomes the base forme, and the ability of the in-battle forme it
// becomes is replaced by the base's first ability: the validator's own repair, so what the server played. A set
// the validator moves to a sibling forme (Keldeo with Secret Sword to Keldeo-Resolute, Greninja with Battle Bond
// to Greninja-Bond) takes that forme. A set with no ability (most analysis sets) gets the most used one. Any other
// illegal ability is left to fail validation. Each rewrite is counted.
const rewrites = new Map<string, number>();
function canonical(set: PokemonSet): PokemonSet {
	const out = { ...set, moves: [...set.moves] };
	const note = (what: string) => rewrites.set(what, (rewrites.get(what) ?? 0) + 1);
	const species = dex.species.get(out.species);
	if (!species.exists) return out;
	if (typeof species.battleOnly === 'string') {
		note(`${species.name} to ${species.battleOnly}`);
		out.species = species.battleOnly;
	}
	const copy = Teams.unpack(pack([normalize(out)]))!;
	TeamValidator.get(FORMAT).validateTeam(copy);
	const moved = dex.species.get(copy[0].species);
	if (moved.name !== dex.species.get(out.species).name && moved.baseSpecies === dex.species.get(out.species).baseSpecies) {
		note(`${dex.species.get(out.species).name} to ${moved.name}`);
		out.species = moved.name;
	}
	const target = dex.species.get(out.species);
	if (!Object.values(target.abilities).some(a => toID(a) === toID(out.ability))) {
		const fill = !out.ability ? defaultAbility(target.name)
			: inBattleAbility(target.name, out.item, out.ability) ? target.abilities[0] : null;
		if (fill) {
			note(`${target.name} ability ${out.ability || '(none)'} to ${fill}`);
			out.ability = fill;
		}
	}
	return out;
}

// ---- Forum posts and pastes ----

interface Post { thread: string, title: string, post: number, author: string | null, date: string, edited: string | null }
const threadUrls = readFileSync(root('scripts/pool/threads.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
// A post edited more than this many days after it was made may have gained its links later, so it doesn't date them.
const EDIT_DAYS = 31;
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86400e3;
const dates = (post: Post) => !post.edited || days(post.date, post.edited) <= EDIT_DAYS;
// paste id -> the earliest post linking it that dates it, or failing that the earliest post linking it
const firstLink = new Map<string, Post>();
const linkedIn = new Map<string, Set<string>>();   // paste id -> threads linking it
for (const url of threadUrls) {
	const slug = url.replace(/\/$/, '').split('/').pop()!;
	const pages = readdirSync(`${EV}/threads/${slug}`).map(f => Number(/^page-(\d+)\.html\.gz$/.exec(f)![1])).sort((a, b) => a - b);
	for (const page of pages) {
		const html = gz(`threads/${slug}/page-${page}.html.gz`);
		const title = /<title>([^<|]*)/.exec(html)![1].trim();
		const parts = html.split(/<span class="u-anchorTarget" id="post-(\d+)"><\/span>/);
		for (let i = 1; i < parts.length; i += 2) {
			const body = parts[i + 1];
			const post: Post = {
				thread: slug, title, post: Number(parts[i]),
				author: /class="username[^"]*"[^>]*>(.*?)<\/a>/.exec(body)?.[1].replace(/<[^>]*>/g, '').trim() || null,
				date: /datetime="(\d{4}-\d\d-\d\d)/.exec(body)![1],
				edited: /message-lastEdit[\s\S]*?datetime="(\d{4}-\d\d-\d\d)/.exec(body)?.[1] ?? null,
			};
			for (const [, id] of body.matchAll(/pokepast\.es\/([0-9a-f]{16})/g)) {
				const seen = firstLink.get(id);
				const earlier = !seen || post.date < seen.date || (post.date === seen.date && post.post < seen.post);
				if (!seen || (dates(post) && !dates(seen)) || (dates(post) === dates(seen) && earlier)) firstLink.set(id, post);
				if (!linkedIn.has(id)) linkedIn.set(id, new Set());
				linkedIn.get(id)!.add(slug);
			}
		}
	}
}
const pastes = new Map<string, { title: string, author: string, notes: string, paste: string }>();
for (const line of gz('pastes.jsonl.gz').split('\n').filter(Boolean)) {
	const { id, body } = JSON.parse(line);
	pastes.set(id, JSON.parse(body));
}

// A paste no dating post links is undated: not eligible for the pool, and in the count's "date unknown" bucket.

// ---- Candidate teams ----

interface Candidate {
	id: string, team: string, verdict: string, date: string | null, thread: string | null, undated?: boolean,
	source: { url: string, entry: number | null, name: string | null, author: string | null, date: string | null, post?: string },
}
const candidates: Candidate[] = [];
const ndUU = TeamValidator.get('gen9nationaldexuu');
const DOUBLES_MOVES = new Set(['followme', 'ragepowder', 'allyswitch', 'wideguard', 'helpinghand', 'afteryou', 'quickguard', 'coaching']);

// 'ou' for a team kept as a candidate, otherwise why not.
function verdict(sets: PokemonSet[] | null, format: string | null): { verdict: string, team: string } {
	if (!sets?.length) return { verdict: 'no team in the paste', team: '' };
	if (sets.length !== 6) return { verdict: 'not 6 Pokemon', team: '' };
	if (format && format !== FORMAT) return { verdict: `labelled ${format}`, team: '' };
	const team = pack(sets.map(s => normalize(canonical(s))));
	if (problems(team, 6)) return { verdict: `fails ${FORMAT} validation`, team };
	const unpacked = Teams.unpack(team)!;
	// A team legal in NatDex UU has no OU-only Pokemon: a UU or RU team from a mixed-tier dump.
	if (!ndUU.validateTeam(Teams.unpack(team)!)) return { verdict: 'legal in NatDex UU', team };
	const types = unpacked.map(s => new Set([...dex.species.get(s.species).types, ...dex.species.get(statsSpecies(s)).types]));
	if ([...types[0]].some(t => types.every(ts => ts.has(t)))) return { verdict: 'monotype', team };
	if (unpacked.filter(s => s.moves.some(m => DOUBLES_MOVES.has(toID(m)))).length >= 2) return { verdict: 'doubles support moves', team };
	return { verdict: 'ou', team };
}

interface SampleTeam { name?: string, author?: string, data: (PokemonSet & { evs?: Partial<StatsTable>, ivs?: Partial<StatsTable> })[] }
const samples: SampleTeam[] = JSON.parse(readFileSync(`${EV}/sample-teams.json`, 'utf8'));
for (const [entry, { name, author, data }] of samples.entries()) {
	const sets = data.map(s => normalize({ ...s, name: '', gender: '', evs: s.evs as StatsTable, ivs: s.ivs as StatsTable }));
	candidates.push({
		id: `smogon-sample-${String(entry).padStart(2, '0')}`, ...verdict(sets, null), date: null, thread: null,
		source: { url: SAMPLE_URL, entry, name: name ?? null, author: author ?? null, date: null },
	});
}
for (const [id, post] of [...firstLink].sort(([a], [b]) => cmp(a, b))) {
	const paste = pastes.get(id);
	const base = {
		id: `pokepaste-${id}`, date: post.date, thread: post.thread, undated: !dates(post),
		source: {
			url: `https://pokepast.es/${id}`, entry: null, name: paste?.title || null,
			author: paste?.author && !/^Guest \d+$/.test(paste.author) ? paste.author : post.author,
			date: post.date, post: `https://www.smogon.com/forums/posts/${post.post}/`,
		},
	};
	if (!paste) {
		candidates.push({ ...base, verdict: 'paste not fetched', team: '' });
		continue;
	}
	const format = /Format:\s*([a-z0-9]+)/i.exec(paste.notes)?.[1].toLowerCase() ?? null;
	candidates.push({ ...base, ...verdict(Teams.import(paste.paste), format) });
}

// Teams equal up to the order of their Pokemon and moves, and to an hpType without Hidden Power (pkmn.github.io
// adds those), count once, under their earliest source (samples first).
const teamKey = (c: Candidate) => Teams.unpack(c.team)!.map(s => pack([{
	...s, moves: [...s.moves].sort(cmp), hpType: s.moves.some(m => toID(m).startsWith('hiddenpower')) ? s.hpType : undefined,
}])).sort(cmp).join(']');
const byTeam = new Map<string, Candidate>();
for (const c of candidates.filter(c => c.verdict === 'ou')) {
	const key = teamKey(c);
	const seen = byTeam.get(key);
	if (!seen || (seen.date !== null && (c.date === null || c.date < seen.date))) byTeam.set(key, c);
}
const distinct = [...byTeam.values()];
const species = (c: Candidate) => Teams.unpack(c.team)!.map(s => dex.species.get(s.species).name);
const roster = (c: Candidate) => [...species(c)].sort().join('/');

// ---- Pool selection ----

const eligible = distinct.filter(c => c.date === null || (!c.undated && c.date >= RECENT)).sort((a, b) => cmp(a.id, b.id));
interface Profile { counts: Map<string, number>, mega: number, z: number }
const profile = (teams: Candidate[]): Profile => {
	const counts = new Map<string, number>();
	let mega = 0, z = 0;
	for (const set of teams.flatMap(c => Teams.unpack(c.team)!)) {
		const key = statsKey(set);
		counts.set(key, (counts.get(key) ?? 0) + 1);
		const t = tags(set);
		mega += +t.mega;
		z += +t.z;
	}
	return { counts, mega: mega / teams.length, z: z / teams.length };
};
// Total variation distance between the pool's species shares and the 1760 usage shares.
function distance(p: Profile): number {
	const slots = sum([...p.counts.values()]);
	let d = 0;
	for (const [s, e] of Object.entries(chaos.data)) d += Math.abs((p.counts.get(s) ?? 0) / slots - e.usage / usageTotal);
	for (const [s, n] of p.counts) if (!chaos.data[s]) d += n / slots;
	return d / 2;
}
const objective = (p: Profile) => distance(p) + RATE_WEIGHT * (Math.abs(p.mega - target.mega) + Math.abs(p.z - target.z));
const shared = (a: Candidate, b: Candidate) => { const s = new Set(species(a)); return species(b).filter(x => s.has(x)).length; };

const chosen: Candidate[] = [];
while (chosen.length < POOL_SIZE) {
	let best: Candidate | null = null, bestScore = Infinity;
	for (const c of eligible) {
		if (chosen.includes(c) || chosen.some(x => shared(x, c) > MAX_SHARED)) continue;
		const score = objective(profile([...chosen, c]));
		if (score < bestScore) { best = c; bestScore = score; }
	}
	if (!best) break;
	chosen.push(best);
}
const pool = [...chosen].sort((a, b) => cmp(a.id, b.id));
const holdoutKey = (c: Candidate) => createHash('sha256').update(`T12 holdout ${c.id}`).digest('hex');
const heldOut = new Set([...pool].sort((a, b) => cmp(holdoutKey(a), holdoutKey(b))).slice(0, HELD_OUT).map(c => c.id));
const training = pool.filter(c => !heldOut.has(c.id));

// ---- Set library ----

interface AnalysisSet {
	moves: (string | string[])[], ability?: string | string[], item?: string | string[], nature?: string | string[],
	evs?: Partial<StatsTable> | Partial<StatsTable>[], ivs?: Partial<StatsTable>,
}
const analysis: Record<string, Record<string, AnalysisSet>> = JSON.parse(readFileSync(`${EV}/analysis-sets.json`, 'utf8'));
const options = <T>(x: T | T[] | undefined): (T | undefined)[] => Array.isArray(x) ? x : [x];
const product = <T>(lists: T[][]): T[][] => lists.reduce<T[][]>((acc, l) => acc.flatMap(a => l.map(x => [...a, x])), [[]]);

interface LibrarySet { set: string, sources: string[] }
const library = new Map<string, Map<string, LibrarySet>>();   // species -> packed set -> entry
const add = (set: PokemonSet, source: string) => {
	const name = dex.species.get(set.species).name;
	// Moves in a fixed order, so sets that differ only in move order are one set, and no hpType without Hidden
	// Power (pkmn.github.io's sample teams add one), so sets that differ only by it are one set too.
	const moves = [...set.moves].sort((a, b) => cmp(toID(a), toID(b)));
	const hpType = moves.some(m => toID(m).startsWith('hiddenpower')) ? set.hpType : undefined;
	const packed = pack([normalize({ ...set, moves, hpType })]);
	if (!library.has(name)) library.set(name, new Map());
	const entry = library.get(name)!.get(packed) ?? { set: packed, sources: [] };
	if (!entry.sources.includes(source)) entry.sources.push(source);
	library.get(name)!.set(packed, entry);
};
const analysisDropped: string[] = [];
let analysisExpanded = 0;
for (const [name, sets] of Object.entries(analysis)) {
	for (const [label, a] of Object.entries(sets)) {
		const combos = product<unknown>([options(a.item), options(a.ability), options(a.nature), options(a.evs), ...a.moves.map(m => options(m))]);
		for (const [item, ability, nature, evs, ...moves] of combos as [string, string, string, Partial<StatsTable>, ...string[]][]) {
			if (new Set(moves.map(toID)).size !== moves.length) continue;
			analysisExpanded++;
			const set = normalize(canonical({
				name: '', species: name, item: item ?? '', ability: ability ?? '', nature: nature ?? '',
				gender: '', moves, evs: evs as StatsTable, ivs: a.ivs as StatsTable, level: 100,
			}));
			const found = problems(pack([set]), 1);
			if (found) analysisDropped.push(`${name} "${label}" ${moves.join('/')}: ${found.join('; ')}`);
			else add(set, `analysis:${label}`);
		}
	}
}
for (const c of training) for (const set of Teams.unpack(c.team)!) add(set, `pool:${c.id}`);

// A set's weight: D4's product of marginals, times its stats entry's share of the usage of the entries this
// species' sets count under (Charizard: Charizard-Mega-X and -Y; Venusaur: Venusaur and Venusaur-Mega), divided by
// the number of sets sharing its stats entry, item, ability (a Mega's own for a Mega set) and moves: they differ
// only in what D4's weight ignores, such as nature, spread or a Mega's base-forme ability. So each combination's
// weight follows the stats, however many spreads the sources give it.
const weighed = [...library].sort(([a], [b]) => cmp(a, b)).map(([name, sets]) => {
	const entries = [...sets.values()].map(e => {
		const set = Teams.unpack(e.set)![0];
		const key = statsKey(set);
		// The ability the weight reads: a Mega's own, whatever the base forme's ability before it Mega Evolves.
		const ability = tags(set).mega ? toID(dex.species.get(key).abilities[0]) : toID(set.ability);
		const combo = [key, toID(set.item), ability, ...set.moves.map(toID).sort(cmp)].join('|');
		return { set: e.set, ...weigh(set), key, combo, tags: tags(set), sources: e.sources.sort(cmp) };
	});
	const usage = (key: string) => chaos.data[key]?.usage ?? 0;
	const total = sum([...new Set(entries.map(e => e.key))].map(usage));
	const variants = new Map<string, number>();
	for (const e of entries) variants.set(e.combo, (variants.get(e.combo) ?? 0) + 1);
	const weighted = entries.map(e => ({
		set: e.set, weight: total ? e.weight * usage(e.key) / total / variants.get(e.combo)! : 0, combo: e.combo,
		tags: e.tags, statsSpecies: e.key, sources: e.sources, missing: e.missing, variants: variants.get(e.combo)!,
	}));
	// Sorted by the combination's summed weight, then the set's, so the first set consistent with what has been
	// revealed (moves, item, ability, forme: all fixed within a combination) is from the likeliest combination.
	const comboWeight = new Map<string, number>();
	for (const e of weighted) comboWeight.set(e.combo, (comboWeight.get(e.combo) ?? 0) + e.weight);
	return [name, weighted.sort((a, b) => comboWeight.get(b.combo)! - comboWeight.get(a.combo)! || cmp(a.combo, b.combo) ||
		b.weight - a.weight || cmp(a.set, b.set))] as const;
});

// ---- Write ----

mkdirSync(`${out}/data/pool/v1`, { recursive: true });
mkdirSync(`${out}/data/priors/v0`, { recursive: true });
writeFileSync(`${out}/data/pool/v1/teams.jsonl`, pool.map(c => JSON.stringify({ id: c.id, team: c.team, source: c.source }) + '\n').join(''));
writeFileSync(`${out}/data/pool/v1/holdout.txt`, [...heldOut].sort().map(id => id + '\n').join(''));
const librarySets = weighed.flatMap(([, sets]) => sets);
writeFileSync(`${out}/data/priors/v0/species_sets.json`, JSON.stringify({
	format: FORMAT,
	showdown: PIN,
	pool: 'data/pool/v1/teams.jsonl',
	stats: { url: STATS_URL, battles: chaos.info['number of battles'] },
	analysis: SETS_URL,
	species: Object.fromEntries(weighed.map(([name, sets]) => [name, sets.map(({ missing, variants, combo, ...s }) => ({ ...s, weight: Number(s.weight.toPrecision(6)) }))])),
}, null, '\t') + '\n');

// ---- Report ----

const v0 = readFileSync(root('data/pool/v0/teams.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Candidate);
const line = (label: string, p: Profile, n: number) => {
	const top = [...p.counts].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, 8).map(([s, k]) => `${s} ${k}`).join(', ');
	return `${label}: ${n} teams, ${p.counts.size} species, Mega ${round(p.mega, 2)}/team, Z ${round(p.z, 2)}/team, distance ${round(distance(p), 3)}; most common: ${top}`;
};
const report: string[] = [];
report.push(`Showdown ${PIN}; 1760 stats ${STATS_MONTH} (${chaos.info['number of battles']} battles): Mega ${round(target.mega, 2)}/team, Z ${round(target.z, 2)}/team`);
report.push(line('v0', profile(v0), v0.length));
report.push(line('v1', profile(pool), pool.length));
report.push(line('v1 training', profile(training), training.length));
// How the pool's species shares differ from the 1760 shares.
function gaps(label: string, p: Profile): string {
	const slots = sum([...p.counts.values()]);
	const ranked = Object.entries(chaos.data).sort((a, b) => b[1].usage - a[1].usage);
	const top25 = ranked.slice(0, 25).map(([s]) => s);
	const covered = sum(ranked.filter(([s]) => p.counts.has(s)).map(([, e]) => e.usage)) / usageTotal;
	const diff = [...new Set([...p.counts.keys(), ...top25])]
		.map(s => [s, (p.counts.get(s) ?? 0) / slots - (chaos.data[s]?.usage ?? 0) / usageTotal] as const)
		.sort((a, b) => a[1] - b[1]);
	const pct = (x: number) => `${x > 0 ? '+' : ''}${round(100 * x, 1)}`;
	return `${label}: species covering ${round(100 * covered, 1)}% of 1760 usage; top 25 missing: ${top25.filter(s => !p.counts.has(s)).join(', ') || 'none'}; ` +
		`most over (points of share): ${diff.slice(-5).reverse().map(([s, d]) => `${s} ${pct(d)}`).join(', ')}; most under: ${diff.slice(0, 5).map(([s, d]) => `${s} ${pct(d)}`).join(', ')}`;
}
report.push(gaps('v0', profile(v0)));
report.push(gaps('v1', profile(pool)));
const counted = (cs: Candidate[]) => Object.entries(Object.groupBy(cs, c => c.verdict)).map(([v, l]) => `${v} ${l!.length}`).sort().join(', ');
report.push(`\nCandidates: ${counted(candidates)}`);
report.push(`Distinct valid OU teams ${distinct.length}, rosters ${new Set(distinct.map(roster)).size}; eligible (samples, or posted on or after ${RECENT}) ${eligible.length}`);
const byYear = Object.entries(Object.groupBy(distinct, c => c.undated ? 'date unknown' : c.date?.slice(0, 4) ?? 'samples')).sort();
report.push(`Distinct valid OU teams by year first posted: ${byYear.map(([y, l]) => `${y} ${l!.length}`).join(', ')}; since ${RECENT}: ${distinct.filter(c => c.date && !c.undated && c.date >= RECENT).length}`);
report.push(`Date unknown: pastes linked only in posts edited more than ${EDIT_DAYS} days after they were made (${[...new Set(candidates.filter(c => c.undated).map(c => c.thread!))].sort(cmp).join(', ')})`);
report.push('\nBy thread (pastes first linked there: all, distinct valid OU teams, newest first link):');
for (const url of threadUrls) {
	const slug = url.replace(/\/$/, '').split('/').pop()!;
	const mine = candidates.filter(c => c.thread === slug);
	const ok = distinct.filter(c => c.thread === slug);
	report.push(`  ${slug}: ${mine.length} pastes, ${ok.length} OU, newest first link ${mine.map(c => c.date!).sort().pop() ?? '-'}`);
}
const inPool = new Set(pool.map(c => c.id));
report.push(`  smogon samples: ${candidates.filter(c => !c.thread).length} teams, ${distinct.filter(c => !c.thread).length} OU, ${pool.filter(c => !c.thread).length} in v1`);
report.push(`Pool sources: ${counted(pool.map(c => ({ ...c, verdict: c.thread ?? 'smogon samples' })))}`);
const allZero = weighed.filter(([, sets]) => sets.every(s => !s.weight)).map(([n]) => n);
const zero = librarySets.filter(s => !s.weight);
report.push(`\nLibrary: ${librarySets.length} sets over ${weighed.length} species; analysis sets expanded to ${analysisExpanded}, ${analysisDropped.length} fail validation`);
report.push(`Weight 0: ${zero.length} of ${librarySets.length} sets (${round(100 * zero.length / librarySets.length, 1)}%); species with every set at 0: ${allZero.length} (${allZero.join(', ')})`);
const reasons = Object.entries(Object.groupBy(zero.flatMap(s => s.missing.map(m => m.split(' ')[0])), x => x)).map(([k, v]) => `${k} ${v!.length}`);
report.push(`Missing from the stats, by kind (a set can miss several): ${reasons.join(', ')}`);
const multi = librarySets.filter(s => s.variants > 1);
report.push(`Sets sharing their stats entry, item, ability and moves with another (weight split among them): ${multi.length}`);
report.push(`Stats entries used for another forme: ${[...fallbacks].sort(cmp).join(', ')}`);
report.push(`Tagged: Mega ${librarySets.filter(s => s.tags.mega).length}, Z ${librarySets.filter(s => s.tags.z).length}, Stealth Rock ${librarySets.filter(s => s.tags.rocks).length}, removal ${librarySets.filter(s => s.tags.removal).length}`);
const trainingSpecies = new Set(training.flatMap(species));
const heldSpecies = new Set(pool.filter(c => heldOut.has(c.id)).flatMap(species));
report.push(`Held out: ${[...heldOut].sort().join(', ')}; their species absent from training teams: ${[...heldSpecies].filter(s => !trainingSpecies.has(s)).sort().join(', ') || 'none'}`);
report.push(`Rewrites (canonical()): ${[...rewrites].sort().map(([k, v]) => `${k} ${v}`).join(', ')}`);
for (const d of analysisDropped) report.push(`  dropped analysis set: ${d}`);
console.log(report.join('\n'));
if (inPool.size !== POOL_SIZE) throw new Error(`only ${inPool.size} pool teams`);
