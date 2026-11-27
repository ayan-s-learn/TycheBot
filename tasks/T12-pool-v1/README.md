# T12: ~50-team pool and set library

## Brief

- **Objective:** D4's Phase 1 pool and set library (plan.md: Components 5, Phase 1). The pool is ~50 validated teams with 10 held out, and it corrects the stub pool's skew. The library is `species_sets.json`, the prior over hidden sets that D4's set resampling and D7's calc prior read.
- **Inputs:**
  - Setup (AGENTS.md, Conventions).
  - D4 (its Decided part: resampling, sources through Phase 2, weights, validation, holdout and the interface) and D7 (the calcs' species-level prior). plan.md: Format facts.
  - docs/areas/team-pool.md (the teams.jsonl format, the validator, gotchas), and T05's `build-pool.ts` and `evidence/`.
  - D4's sources: Smogon's 25 NatDex sample teams and 170 analysis sets (pkmn.github.io/smogon), recent tournament pastes through pokepast.es JSON, and the 1760 chaos stats for the latest month (October 2026 if November's aren't out). Snapshot every fetched file into the task's `evidence/`, as T05 did.
- **Deliverables:**
  - `data/pool/v1/teams.jsonl`: ~50 teams in v0's format, 10 of them held out, listed in a file whose format you define and document.
    - Report the stub pool's skew (Z-Crystals on 19 of 20 teams, Zamazenta on 12: team-pool.md) next to v1's.
    - Report how far v1's species usage is from the 1760 stats.
    - Count how many more valid teams D4's sources and Smogon's tournament team dumps (such as the NatDex tour threads) could yield, so the next replan can size the Phase 2 pool. Count only; v1 stays at ~50.
  - `data/priors/v0/species_sets.json`: the analysis sets plus every set on a training pool team (not the held-out ones), weighted as D4 says. Tag each set with what resampling keeps: Mega Stone, Z-Crystal, Stealth Rock setter, hazard removal.
  - Build scripts in `scripts/pool/` that rebuild both files from the snapshots.
  - docs/areas/team-pool.md updated with v1, the library's format, commands and gotchas. The library's format is an interface: the calc features and set resampling will link to it. Propose the AGENTS.md Areas row change under For integration.
- **Acceptance checks:**
  - `node scripts/validate-pool.ts data/pool/v1/teams.jsonl` passes.
  - Every library set passes Showdown's set validation for `gen9nationaldex` at the pin, without repairs (team-pool.md, Gotchas).
  - Every species on a training team has at least one library set, and no set comes only from a held-out team.
  - The build reruns from the snapshots on a clean checkout with identical output.
- **May change:** `data/pool/v1/`, `data/priors/v0/`, `scripts/pool/`, `docs/areas/team-pool.md`, `tasks/T12-pool-v1/`.
- **Limits:** one or two sessions, no paid services. Fetch only public pages, at a polite rate.
- **Stop and report if:**
  - fewer than ~40 teams validate from D4's sources;
  - over half of the library's sets weigh 0 under the 1760 stats.

## Progress

```text
2026-11-27
State: done
Verified: all acceptance checks (acceptance.sh) at Showdown 29f2d99, Node 24.22.3, from this checkout and from a
  fresh clone of the branch with a fresh setup (evidence/acceptance.log). The Showdown CLI (validate-team
  gen9nationaldex) accepts all 50 pool teams; 200 random-player games between v1 teams ended in a win, with no
  sim error. check-library.ts fails as it should on a planted illegal ability, held-out-only source and missing
  species.
Pending: none
Next: the user reviews (workflow.md, Task session step 7); then a planning session merges.
Branch: claude/task-t12-a4ia8b, not task/T12-*: this cloud session may push only to that branch. It was
  pushed once the user relinked GitHub (pushes had returned 403 until then).
```

```text
2026-11-27
State: active
Verified: nothing yet
Pending: all acceptance checks
Next: snapshot the sources into evidence/ (sample teams, analysis sets, Oct 2026 1760 chaos stats, tour pastes), then build v1.
Branch: claude/task-t12-a4ia8b (this cloud session may push only to that branch, not task/T12-*)
```

## Result

`data/pool/v1/` holds 50 validated teams, 10 of them held out, and `data/priors/v0/species_sets.json` 1089 sets over 103 species. Both are rebuilt byte for byte from the snapshots in `evidence/` by `scripts/pool/build.ts`. Its report is `evidence/build-report.txt`, the source of the numbers below unless noted. Formats, commands and gotchas are in [team-pool](../../docs/areas/team-pool.md). Neither stop condition is met: 669 distinct teams validate as OU from the sources, and no library set weighs 0.

### Sources

Fetched 2026-11-27 by `scripts/pool/fetch.sh`, one request at a time:

| Source | Snapshot | Size, SHA-256 of the file as fetched |
|---|---|---|
| Smogon sample teams (pkmn.github.io) | `sample-teams.json` | 36,674 B, `f35934eb5238b3069139fa6a67de999e654873e5da4f8f5142b84446c60a1fe1`: identical to T05's |
| Smogon analysis sets (pkmn.github.io) | `analysis-sets.json` | 38,967 B, `dd9aadbe094602c88a448b6a97cc2f8c5b1b5f3a476ced01a574b10ce5285968`: 170 sets over 100 species |
| 1760 chaos stats, October 2026 (November's aren't out) | `chaos-…-2026-10.json.gz` | 9,138,603 B before gzip, `119d096c1598b74b2a5231b559c0d62cd5ffac8fc42d53f112b00db4b75b8d3e`: 419,320 battles |
| 13 Smogon threads (`scripts/pool/threads.txt`): the NatDex tour dump threads of 2024–2026, Teams of the Week, the sample-team thread | `threads/*/page-*.html.gz` | 13 pages |
| Every pokepast.es paste those pages link | `pastes.jsonl.gz` | 1,343 pastes, each response verbatim |


The tour dumps mix tiers (OU, UU, RU, Ubers, Doubles, Monotype, Draft). The build keeps a paste as an OU candidate only if:
- its notes name no other format (559 name one);
- it is 6 Pokemon (5 aren't) and passes validation (116 fail, mostly on Pokemon tagged ND Uber; the build doesn't split those banned since posting from unlabelled Ubers teams);
- it isn't legal in NatDex UU (6);
- it isn't monotype or doubles-shaped (0 once labels are applied).

682 pastes pass, 669 distinct teams with 613 distinct rosters. Of the 50 v1 teams, 49 are labelled `Format: gen9nationaldex` or are sample teams, and the other (`pokepaste-019b2e28e2b03e99`, NDFL IV) has no label and an OU roster.

### v1 against v0 and the stats

| | v0 | v1 | 1760 stats |
|---|---|---|---|
| Teams | 20 | 50 (40 training) | – |
| Species | 40 | 81 | – |
| Megas per team | 0.40 | 0.78 | 0.79 |
| Z-Crystals per team | 0.95 | 0.66 | 0.66 |
| Total variation distance, species shares | 0.458 | 0.216 (training 0.248) | – |
| 1760 usage on species in the pool | 59.6% | 83.1% | – |
| Top-25 species missing | Gliscor, Scizor-Mega, Charizard-Mega-X, Toxapex, Melmetal | none | – |
| Most over-represented, points of share | Zamazenta +7.5, Ogerpon-Wellspring +5.0, Slowking-Galar +4.6 | Great Tusk +2.2, Zamazenta +1.8, Ogerpon-Wellspring +1.7 | – |
| Zamazenta on | 12 of 20 teams | 13 of 50 | 15.2% usage |

The stats' per-team rates are sums over species: Megas are the usage of the Mega formes, and Z-Crystals are each species' usage times its Z-Crystal share of items. The 0.66 replaces plan.md's "~0.5 Z-Crystals per team (research agent's count)" (For integration). The stats count Megas as their own species, so the distances do too.

How v1 was chosen: from the 25 samples and the 146 distinct OU teams posted since 2026-04-01, greedily, each step adding the team that most lowers the distance plus 0.5 × the gaps in Megas and Z-Crystals per team. No two pool teams share more than 4 species. It took 23 NDPL VII, 19 NDWC VI and 2 NDFL IV pastes, and 6 sample teams. 46 teams have a Stealth Rock setter and 43 have hazard removal. The stats select among real teams but generate none (D4). The distance is a check, not a guarantee of good matchups.

Held out: 10 teams drawn by hash (team-pool.md, holdout.txt). Each shares at most 4 species with any training team. Seven held-out species are on no training team (Dondozo, Glimmora, Hoopa-Unbound, Mawile, Moltres-Galar, Tangrowth, Weezing-Galar); all have analysis sets.

### Library

- 1089 sets over 103 species. The 170 analysis sets expand to 881 concrete sets once every slash option is spelled out (combinations repeating a move are skipped). The 4 dropped are Blissey "Pink Blob" combinations the validator rejects as incompatible moves (Wish with Teleport). The 240 training-team sets add 212 sets the analyses lack. 22 sets come from both sources.
- Every set passes `gen9nationaldex` validation at the pin unrepaired (check-library.ts). To get there, the build rewrites a source set the validator would repair (team-pool.md, Gotchas): an in-battle forme or its ability, or a missing analysis ability. Each rewrite is counted in the report. For example, 81 `Diancie-Mega` sets become Diancie, and 95 Diancie sets with Magic Bounce get Clear Body (counted over every candidate team and analysis combination). A Mega set's base ability only matters before it Mega Evolves.
- No set weighs 0: the 1760 stats list every item, ability and move the sets use, even rare ones with small counts. The weights are steep products of six marginals. The median species' top set holds 39% of the species' weight, and 344 sets hold under 1% of theirs, so resampling will mostly draw a few sets per species (check below).
- Tags: Mega 96 sets, Z-Crystal 177, Stealth Rock 155, hazard removal 142.

Checks run outside acceptance.sh:

```bash
python3 - <<'EOF'   # weight concentration and sources, from data/priors/v0/species_sets.json
import json, statistics
L = json.load(open('data/priors/v0/species_sets.json'))['species']
top = [v[0]['weight'] / sum(s['weight'] for s in v) for v in L.values()]
print(statistics.median(top), sum(s['weight'] / sum(x['weight'] for x in v) < 0.01 for v in L.values() for s in v))
EOF
```

One weight was also recomputed by hand from the raw stats for Great Tusk, Mega Diancie and Keldeo-Resolute, and matched.

### Count for the Phase 2 pool

At the pin, the 13 threads and the sample teams give 669 distinct teams that validate as OU (613 distinct rosters). By the year first posted: 2023: 129, 2024: 160, 2025: 167, 2026: 188, and 25 sample teams. 146 date from 2026-04-01 or later. Per thread:

| Thread | Pastes | Valid OU | Newest post |
|---|---|---|---|
| NDFL IV dump | 40 | 9 | 2026-11-22 |
| NDPL VII dump | 130 | 87 | 2026-11-02 |
| NDWC VI dump | 64 | 50 | 2026-05-16 |
| NDCL I dump | 106 | 42 | 2026-03-04 |
| NatDex OU Teams of the Week | 10 | 10 | 2025-11-11 |
| NDFL III dump | 90 | 22 | 2025-12-06 |
| NDPL VI dump | 148 | 68 | 2025-11-18 |
| NDWC V dump | 96 | 42 | 2025-06-09 |
| NDBD I dump | 140 | 25 | 2025-03-10 |
| NDFL II dump | 81 | 32 | 2024-11-20 |
| NDPL V dump | 130 | 44 | 2024-11-04 |
| NDWC IV dump | 158 | 84 | 2024-06-02 |
| National Dex Sample Teams thread | 150 | 129 | 2023-03-08 |

A paste is counted under the thread of the earliest post linking it. Validating at today's pin doesn't mean an old team suits today's meta: the 1760 meta drifts ~10% a month (D4). So a Phase 2 pool of 200–300 teams from these sources would reach back into 2025. Not counted here: tours with no dump thread in this list, and teams that exist only as replays.

### Limits

- The doubles and monotype filters caught nothing beyond the format labels, so an unlabelled doubles team with fewer than 2 support movers would pass. The pool's one unlabelled team was checked by eye.
- The weights use October's stats; resampling and calcs inherit their drift.
- The held-out split has no group constraint (deferred in D4).
- Smogon's forums also host "National Dex Champions OU" threads (announcements, metagame discussion). D4 rebuilds on a NatDex ruling on Pokémon Champions content; I didn't read them.

## Outputs

From a set-up checkout (AGENTS.md, Conventions; `nvm use` first):

```bash
tasks/T12-pool-v1/acceptance.sh     # type check, validate-pool, check-library, rebuild compared byte for byte
node scripts/pool/build.ts > tasks/T12-pool-v1/evidence/build-report.txt   # rebuild data/pool/v1 and data/priors/v0
scripts/pool/fetch.sh               # re-snapshot the sources; skips files already in evidence/
```

`fetch.sh` keeps per-paste downloads in `evidence/.pastes/` (gitignored) and bundles them, so deleting `pastes.jsonl.gz` and rerunning refetches all 1,343 pastes (~30 minutes).

| File | What it is |
|---|---|
| `data/pool/v1/teams.jsonl`, `holdout.txt` | The pool and its held-out ids |
| `data/priors/v0/species_sets.json` | The set library |
| `scripts/pool/build.ts` | Builds both, prints the report |
| `scripts/pool/showdown.ts` | Showdown at the pin, the strict set check, normalization, tags |
| `scripts/pool/check-library.ts` | The library's acceptance checks |
| `scripts/pool/fetch.sh`, `threads.txt` | Snapshots the sources |
| `acceptance.sh`, `tsconfig.json` | Acceptance checks and the type check |
| `smoke-battles.cjs` | 200 random-player games between v1 teams (`evidence/smoke-battles.log`) |
| `evidence/` | Source snapshots, `build-report.txt`, `acceptance.log`, `smoke-battles.log` |

## For integration

1. AGENTS.md, Current state, replace the bullet with:

   > - 2026-11-27: Phase 1 (plan.md, Phases). `data/pool/v1/` holds a 50-team pool with 10 held out, `data/priors/v0/` its set library ([T12](tasks/T12-pool-v1/README.md)), and `data/replays/v0/` the public replay corpus ([T04](tasks/T04-replay-corpus/README.md), Outputs). The only project code so far is `scripts/`.

   (Adjust "the only project code" if T09–T11 have merged by then.)

2. AGENTS.md, Areas, replace the team-pool row with:

   > | Team pool and set priors | v1: 50 teams, 10 held out; library v0: 1089 sets | `data/pool/`, `data/priors/`, `scripts/validate-pool.ts`, `scripts/pool/` | [team-pool](docs/areas/team-pool.md) |

3. AGENTS.md, Conventions, Re-pin: after "validate every pool team (`node scripts/validate-pool.ts data/pool/<ver>/teams.jsonl`, once per pool version in use)" insert ", check every set library (`node scripts/pool/check-library.ts data/priors/<ver>/species_sets.json data/pool/<pool ver>`)".

4. plan.md, Format facts, replace "and ~0.5 Z-Crystals per team (research agent's count)" with "and 0.66 Z-Crystals and 0.79 Megas per team (T12, from the Oct 2026 1760 chaos stats)".

5. checklist.md, For a later replan, the D4 item: append "T12 counted 669 distinct teams that validate as OU from the NatDex tour dumps and sample teams of 2023–2026, 188 of them first posted in 2026 and 146 since April (T12, Result)."

6. For a planning session to decide: whether "National Dex Champions OU" on Smogon's forums is the Pokémon Champions ruling D4's refresh rule waits for (T12, Limits).
