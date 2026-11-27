# Team pool

Component 5 of plan.md. D4 owns the design.

## Status (2026-11-27)

- `data/pool/v1/teams.jsonl`: 50 teams that validate at Showdown `29f2d99`, 10 of them held out (`holdout.txt`). Built by T12. 200 random-player games between v1 teams ran to a win with no sim error (T12, Result).
- `data/priors/v0/species_sets.json`: the set library, 1089 sets over 103 species, weighted by the October 2026 1760 stats.
- `data/pool/v0/teams.jsonl`: T05's 20-team stub pool, kept for reference. It is skewed (below).

## teams.jsonl

D4's path: `data/pool/<ver>/teams.jsonl`. One JSON object per line:

| Field | Type | Holds |
|---|---|---|
| `id` | string | Unique in the file: `smogon-sample-NN` or `pokepaste-<paste id>` |
| `team` | string | The team in Showdown's packed format (`Teams.unpack`) |
| `source.url` | string | Where the team came from |
| `source.entry` | number or null | Index in that file when fetched (upstream may reorder it); null for a paste |
| `source.name`, `source.author`, `source.date` | string or null | As the source gives them. `date` (v1) is the day the earliest forum post linking the paste was made; samples have none |
| `source.post` | string | v1 pastes only: that forum post |

v1 teams carry no nickname, shininess, gender, ball or Tera type (v0's keep the sample teams' genders). The protocol shows nicknames, shininess and gender, so they would let the opposing seat tell pool teams apart. With gender unset the sim picks one each battle, unless the species has a fixed one.

## holdout.txt

`data/pool/v1/holdout.txt`: the ids of the held-out teams, one per line, sorted. Every other team in `teams.jsonl` is a training team. The 10 were drawn by hash (`sha256("T12 holdout " + id)`, lowest 10), with no constraint. A held-out team shares at most 4 species with any training team, and 7 held-out species are on no training team (all 7 have analysis sets in the library). D4's group split is deferred to Phase 3.

## species_sets.json

D4's path: `data/priors/<ver>/species_sets.json`. The prior over hidden sets that D4's resampling and D7's calcs read. One JSON object:

| Field | Holds |
|---|---|
| `format`, `showdown` | `gen9nationaldex` and the pin the sets were validated at |
| `pool` | The pool whose training teams contributed sets |
| `stats.url`, `stats.battles` | The chaos stats the weights come from |
| `analysis` | The analysis-set source |
| `species` | Species name (Showdown's `species.name`, e.g. `Urshifu-Rapid-Strike`) → its sets, highest weight first |

Each set:

| Field | Holds |
|---|---|
| `set` | One set in packed format: no nickname, shininess, gender, ball or Tera type |
| `weight` | D4's weight: the product of the species' 1760 marginals for item, ability and each move (count over the species' total, 6 significant digits). Unnormalized: draw within a species in proportion to it, or uniformly if all of a species' weights are 0 (none are in v0) |
| `tags` | `mega` (holds its own Mega Stone), `z` (a Z-Crystal), `rocks` (Stealth Rock), `removal` (Rapid Spin, Defog, Mortal Spin, Tidy Up or Court Change): what resampling keeps per team |
| `statsSpecies` | The stats entry the weight used: the Mega forme for a Mega set (its stone and the Mega's ability then weigh ~1), and Keldeo for Keldeo-Resolute, Greninja for Greninja-Bond |
| `sources` | `analysis:<set name>` and `pool:<team id>`, each a source that gave this exact set |

The sets are Smogon's analysis sets with every option expanded (moves, items, abilities, natures, spreads), plus every set on a training team. No set comes from a held-out team only. In v0, 855 sets come from analyses only, 212 from training teams only and 22 from both.

Weights are concentrated: the median species' top set holds 39% of its weight, and 344 sets hold under 1% of their species' weight.

## Validating

From the root, after setup (AGENTS.md, Conventions):

```bash
node scripts/validate-pool.ts data/pool/v1/teams.jsonl
node scripts/pool/check-library.ts data/priors/v0/species_sets.json data/pool/v1
```

`validate-pool.ts` passes a line only if its `team`:

- survives `Teams.pack(Teams.unpack(team))` unchanged;
- has 6 Pokemon;
- passes Showdown's `TeamValidator` for `gen9nationaldex`;
- comes out of validation with every value as written. A gender, nature, `hpType`, Tera type, ball or Dynamax field it leaves unset may be filled in (see Gotchas).

It names each failing team with the problems and exits 1. It refuses to run if the `vendor/pokemon-showdown` checkout isn't at the commit in `showdown.pin`. It doesn't check the built `dist/` itself. `setup-showdown.sh` removes `dist/` before it changes the checkout, so a failed setup can't leave the old build under a new one. It reads `id` and `source.name` only to label failures, and doesn't check them, the other `source` fields or duplicate teams. It is type-checked by `tasks/T05-stub-pool/tsconfig.json` (command in AGENTS.md, Conventions).

`check-library.ts` applies the same checks to each library set as a one-Pokemon team (`scripts/pool/showdown.ts`, `problems`). It also checks that every species on a training team has a set, and that every set has a source other than a held-out team. It validates at the current pin and prints the pin the library was built at, without failing on a difference, so the monthly re-pin can use it. It exits 1 naming each failure. T12 checked it fails on a planted illegal ability, a held-out-only source and a missing species.

## Building v1 and the library

`scripts/pool/build.ts` rebuilds `data/pool/v1/` and `data/priors/v0/` from the snapshots in `tasks/T12-pool-v1/evidence/` and prints the report in `evidence/build-report.txt`, identical on rerun. `scripts/pool/fetch.sh` takes the snapshots, skipping files already there. Pass a directory to `build.ts` to write there instead of the root:

```bash
node scripts/pool/build.ts > tasks/T12-pool-v1/evidence/build-report.txt
tasks/T12-pool-v1/acceptance.sh     # type check, both validators, rebuild compared byte for byte
```

The build:

1. reads every pokepast.es paste linked from the threads in `scripts/pool/threads.txt`, plus the 25 sample teams;
2. drops a paste whose notes name another format, then any team that fails validation, is legal in NatDex UU (a UU or RU team from a mixed-tier dump), is monotype, or has two or more mons with doubles support moves;
3. greedily picks 50 of the remaining samples and pastes posted since 2026-04-01. Each step adds the team that most lowers the total variation distance between the pool's and the 1760 species shares, plus 0.5 × the gaps in Megas and Z-Crystals per team, skipping teams that share 5 species with one already picked. The stats select real teams but don't generate them (D4).

## What the pools contain

From `evidence/build-report.txt`. Distance is total variation between species shares, with Megas counted as their Mega forme, as the stats count them.

| | v0 | v1 | 1760 stats, Oct 2026 |
|---|---|---|---|
| Teams | 20 | 50 (40 training) | 419,320 battles |
| Species | 40 | 81 | – |
| Megas per team | 0.40 | 0.78 | 0.79 |
| Z-Crystals per team | 0.95 | 0.66 | 0.66 |
| Distance from the stats | 0.458 | 0.216 | – |
| Share of 1760 usage on pool species | 59.6% | 83.1% | – |
| Top 25 species missing | Gliscor, Scizor-Mega, Charizard-Mega-X, Toxapex, Melmetal | none | – |
| Most over-represented | Zamazenta +7.5 points of share | Great Tusk +2.2 | – |

v1's sources: 44 tour pastes (NDPL VII 23, NDWC VI 19, NDFL IV 2) and 6 sample teams. 46 teams have a Stealth Rock setter and 43 have hazard removal. 18 sets are species whose forme Team Preview hides (plan.md, Format facts; not checked on the sim's `|poke|` lines here): Zamazenta 13, Urshifu-Rapid-Strike 5. v0 is the first 20 sample teams; T05's `report.ts` counts it.

## Gotchas

- Packing hand-typed export text can fail the round trip on capitalization (`U-Turn`). One `Teams.pack(Teams.unpack(packed))` fixes the move name.
- `Teams.import` on pkmn.github.io's JSON teams passes species through `Dex.getName`, which cuts names to 18 characters, so Urshifu-Rapid-Strike fails validation (sample teams 14, 17 and 18). Pack the sets directly, as T02's `teams.ts` and `scripts/pool/build.ts` do. `Teams.import` on export text keeps the full name.
- At `29f2d99` an `hpType` of `ice` passes `validate-team`, and a `Battle` throws when that set uses Hidden Power.
- `validateTeam` repairs some illegal sets in place and passes them: at `29f2d99`, Terapagos with Wonder Guard becomes Tera Shift and Mawile with Huge Power becomes Hyper Cutter. A `Battle` started on the unrepaired string plays it as written. So Showdown's `validate-team` passing isn't enough for a pool team; use the scripts above.
- 17 v0 sets carry an `hpType` but no Hidden Power move. At `29f2d99` the validator accepts only the listed type on 13 of them (Ogerpon-Wellspring 8, Terapagos 4, Raging Bolt 1) and every type but Normal, Fairy and Stellar on the 4 Great Tusk sets.
- Pastes exported from Showdown, and the analysis sets, often name the in-battle forme and its ability (`Diancie-Mega` with Magic Bounce, `Terapagos-Terastal` with Tera Shell, Mawile with Huge Power). The validator repairs these, so the build rewrites them first: to the base forme, and to the base's most used ability where the given one isn't legal for it. Keldeo with Secret Sword becomes Keldeo-Resolute and Greninja with Battle Bond becomes Greninja-Bond. The rewritten set must then pass unrepaired. Each rewrite is counted in `build-report.txt`.
- The usage stats count Keldeo-Resolute as Keldeo and Greninja-Bond as Greninja, and every Mega under its Mega forme, whose ability and item lists hold only the Mega's.
- Mixed-tier tour dumps label many pastes in their notes (`Format: gen9nationaldexuu`). Of the 1,343 pastes T12 read, 559 named another format. A UU or RU team without a label passes `gen9nationaldex` validation, so the build also drops teams legal in NatDex UU (6 in T12's snapshot).
- Showdown's `Teams.import` misreads a nickname that itself has parentheses (`dem (dog) (Zamazenta)`) as the species, so the team fails validation.
- Smogon's forums return a login page (HTTP 403) to curl with a custom User-Agent, and pages with curl's default one.
