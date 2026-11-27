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
2026-11-27 (final)
State: done
Verified: acceptance.sh passes at a8ae502 (evidence/acceptance.log): type check, validate-pool 50/50,
  check-library 1063 sets with 0 failures, rebuild byte-identical. smoke-battles.ts: 200/200 pool games and
  788/788 library games, 0 errors (evidence/smoke-battles.log). Showdown's validate-team CLI accepts all 50.
  All 1063 weights match an independent recomputation.
Pending: the user's PR review; then a planning session merges (For integration).
Next: none for this task.
Reviewed: passes 1 and 2 (2026-11-27; Opus agents at high and medium effort), fixes in 6a5d411 and a8ae502.
  The user's own review of PR #11 isn't recorded here.
```

```text
2026-11-27 (review pass 2)
State: done
Verified: pass 2 (an Opus agent at medium effort, told not to trust earlier checks or pass 1) found nothing
  blocking. It reproduced the numbers, the weights in Node and a byte-identical rebuild under another locale and
  time zone. Its fixes:
  - Count: a paste is dated by its earliest dating post, not its earliest post (unknown 124 -> 97).
  - Library: sorted by combination weight, so D7's first consistent set comes from the likeliest combination;
    stray hpType dropped (1064 -> 1063).
  - Ability rewrite: tied to the forme the set's item makes.
  - smoke-battles.ts: a per-game timeout and a --library mode.
  - fetch.sh: blank lines skipped and partial downloads removed.
  - Docs: the Greninja-Bond key, and the D7 wording under For integration.
  Pool teams and holdout unchanged.
Pending: none.
Next: see the final entry.
```

```text
2026-11-27 (review pass 1)
State: done
Verified: pass 1 (an Opus agent at high effort, told not to trust earlier checks) found nothing blocking and
  recomputed the headline numbers. Its fixes are in. Acceptance passes (evidence/acceptance.log), smoke-battles.ts
  passes 200/200 with 0 errors and fails on a planted crash, and all 1064 weights match an independent
  recomputation.
  Fixes:
  - Weights: × the stats entry's usage share, ÷ the variants sharing a combination (the user's calls), and moves
    sorted in stored sets.
  - Pool: ability rewrites limited to in-battle abilities, using the validator's slot 0 (4 pool sets changed,
    pool ids unchanged); paste authors from the forum poster for Guest placeholders.
  - Count: deduped up to the order of Pokemon and moves and stray hpType (669 -> 650), with an unknown-date bucket
    for posts edited later.
  - fetch.sh: no longer swallows failures or rewrites the bundle.
  - smoke-battles in TypeScript, counting player errors; locale-free sorting.
  - Docs: the distance stated as the selection objective, and the D4 refinements under For integration.
Pending: review pass 2.
Next: run pass 2 on this commit; apply its fixes; then the final entry with the Reviewed: line.
```

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

`data/pool/v1/` holds 50 validated teams, 10 of them held out. `data/priors/v0/species_sets.json` holds 1063 sets over 103 species. `scripts/pool/build.ts` rebuilds both byte for byte from the snapshots in `evidence/`. Its report, `evidence/build-report.txt`, is the source of the numbers below unless noted. Formats, commands and gotchas are in [team-pool](../../docs/areas/team-pool.md).

Neither stop condition is met: 650 distinct teams validate as OU from the sources, and no library set weighs 0.

Review pass 1 changed the library's weights, four pool-set abilities, the dedupe and dating of the count, and `fetch.sh`. Pass 2 changed the dating again, the library's order, the ability rule's scope and the smoke test. Both passes ran 2026-11-27. The numbers below are after both passes' fixes (Progress).

### Sources

Fetched 2026-11-27 by `scripts/pool/fetch.sh`, one request at a time:

| Source | Snapshot | Size, SHA-256 of the file as fetched |
|---|---|---|
| Smogon sample teams (pkmn.github.io) | `sample-teams.json` | 36,674 B, `f35934eb5238b3069139fa6a67de999e654873e5da4f8f5142b84446c60a1fe1`: identical to T05's |
| Smogon analysis sets (pkmn.github.io) | `analysis-sets.json` | 38,967 B, `dd9aadbe094602c88a448b6a97cc2f8c5b1b5f3a476ced01a574b10ce5285968`: 170 sets over 100 species |
| 1760 chaos stats, October 2026 (November's aren't out) | `chaos-…-2026-10.json.gz` | 9,138,603 B before gzip, `119d096c1598b74b2a5231b559c0d62cd5ffac8fc42d53f112b00db4b75b8d3e`: 419,320 battles |
| 13 Smogon threads (`scripts/pool/threads.txt`): the NatDex tour dump threads of 2024–2026, Teams of the Week, the sample-team thread | `threads/*/page-*.html.gz` | 13 pages; none has a second page |
| Every pokepast.es paste those pages link | `pastes.jsonl.gz` | 1,343 pastes, each response verbatim |

The tour dumps mix tiers (OU, UU, RU, Ubers, Doubles, Monotype, Draft). The build keeps a paste as an OU candidate only if it passes four filters:

- its notes name no other format (559 name one);
- it is 6 Pokemon (5 aren't) and passes validation. 116 fail, 107 of them on Pokemon or items tagged ND Uber or ND AG; the build doesn't split content banned since posting from unlabelled Ubers teams. At least 2 OU teams fail only because `Teams.import` misreads a nickname with parentheses (team-pool.md, Gotchas);
- it isn't legal in NatDex UU (6 are);
- it isn't monotype or doubles-shaped (0 are once labels are applied).

682 pastes pass, which is 650 distinct teams with 613 distinct rosters. The build counts two teams as the same when they differ only in the order of their Pokemon or moves, or by an `hpType` without Hidden Power (pkmn.github.io adds those). Of the 50 v1 teams, 49 are labelled `Format: gen9nationaldex` or are sample teams. The other, `pokepaste-019b2e28e2b03e99` from NDFL IV, has no label and an OU roster; review pass 1 also read its post.

### v1 against v0 and the stats

| | v0 | v1 | 1760 stats |
|---|---|---|---|
| Teams | 20 | 50 (40 training) | – |
| Species, counting Megas as their own, as the stats do | 40 | 81 | – |
| Megas per team | 0.40 | 0.78 | 0.79 |
| Z-Crystals per team | 0.95 | 0.66 | 0.66 |
| Total variation distance, species shares | 0.458 | 0.216 (training 0.248) | – |
| 1760 usage on species in the pool | 59.6% | 83.1% | – |
| Top-25 species missing | Gliscor, Scizor-Mega, Charizard-Mega-X, Toxapex, Melmetal | none | – |
| Most over-represented, points of share | Zamazenta +7.5, Ogerpon-Wellspring +5.0, Slowking-Galar +4.6 | Great Tusk +2.2, Zamazenta +1.8, Ogerpon-Wellspring +1.7 | – |
| Zamazenta on | 12 of 20 teams | 13 of 50 | 15.2% usage |

The stats' per-team rates are sums over species:

- **Megas:** the usage of the Mega formes.
- **Z-Crystals:** each species' usage times its Z-Crystal share of items.

The 0.66 replaces plan.md's "~0.5 Z-Crystals per team (research agent's count)" (For integration).

**How v1 was chosen:** from the 25 samples and the 147 distinct OU teams dated 2026-04-01 or later, greedily. Each step adds the team that most lowers the distance plus 0.5 × the gaps in Megas and Z-Crystals per team. No two pool teams share more than 4 species. The result:

- 23 NDPL VII, 19 NDWC VI and 2 NDFL IV pastes, and 6 sample teams;
- 46 teams with a Stealth Rock setter and 43 with hazard removal.

**Caveats on the selection:**

- **The distance is not an independent check.** The distance, the coverage and the Mega and Z rates were the selection objective, so they show the optimizer worked, not that the pool is representative in other respects, such as matchups or sets.
- **It is close to a deferred part of D4.** Picking teams to match the 1760 species usage is close to D4's item deferred to Phase 3: "roster weights fitted so the pool's species usage matches the 1760 stats". The stats select among real teams and generate none. The planning session should confirm this reading (For integration).

**Held out:** 10 teams drawn by hash (team-pool.md, holdout.txt). Each shares at most 4 species with any training team. Seven held-out species are on no training team (Dondozo, Glimmora, Hoopa-Unbound, Mawile, Moltres-Galar, Tangrowth, Weezing-Galar), and all seven have analysis sets.

### Library

**Sources.** 1063 sets over 103 species (counting a Mega under its base species).

- The 170 analysis sets expand to 881 concrete sets once every slash option is spelled out; combinations repeating a move are skipped. The 4 dropped are Blissey "Pink Blob" combinations the validator rejects as incompatible moves (Wish with Teleport).
- Sets are stored with their moves sorted, and without an `hpType` unless they use Hidden Power, so sets differing only in those are one set.
- 841 sets come from analyses only, 187 from training teams only and 35 from both.

**Validation.** Every set passes `gen9nationaldex` validation at the pin unrepaired (check-library.ts). To get there, the build rewrites four conventions in the source sets (team-pool.md, Gotchas):

- An in-battle forme becomes its base forme.
- The ability of the in-battle forme the set becomes (the Mega or Primal forme its item makes, or Terapagos-Terastal) becomes the base's first ability. That is the validator's own repair, so it is what the server played for a paste: Venusaur gets Overgrow, Mawile Hyper Cutter, Lopunny Cute Charm. Pass 2 checked that every such rewrite in the snapshot matches the validator's repair.
- A set the validator moves to a sibling forme takes that forme: Keldeo with Secret Sword becomes Keldeo-Resolute, Greninja with Battle Bond Greninja-Bond.
- A missing analysis ability becomes the most used one.

Any other illegal ability is left to fail validation. Each rewrite is counted in the report. The counts cover every candidate, rejected ones included: for example, 81 `Diancie-Mega` sets become Diancie. Four pool sets changed in pass 1: two Venusaur sets go from Chlorophyll to Overgrow, Aerodactyl from Pressure to Rock Head, and Swampert from Damp to Torrent. A Mega's base ability matters only until it Mega Evolves.

**Weights.** Each set's weight is three factors:

- D4's product of marginals;
- its stats entry's share of the usage of the entries that species' sets count under, so Charizard's Mega-X and Mega-Y split by usage (your call in pass 1);
- divided by the number of sets sharing that combination of item, ability and moves (also your call).

The two scalings matter as follows:

- **The usage share:** before it, Charizard Mega-Y sets held 55% of Charizard's weight against 34.5% of the X+Y usage. Now X gets 0.670 against 0.655 of the usage, and Venusaur's non-Mega sets 0.166 against 0.172.
- **The split:** 439 sets share a combination with another and split its weight. Without the split, a combination with more spreads would be drawn more often. On the current library, the draw over combinations with and without the split differs by over 0.10 in total variation for 27 species (pass 1 counted 33 on the library before its fixes).

No set weighs 0: the 1760 stats list every item, ability and move the sets use, even rare ones with small counts. The weights are steep products of six marginals: the median species' heaviest set holds 42% of the species' weight, and 332 sets hold under 1% of theirs, so resampling will mostly draw a few sets per species.

**Order, for D7.** Each species' sets are sorted by their combination's summed weight, then by weight. So the first set consistent with what has been revealed comes from the likeliest consistent combination. With the split, the single heaviest set wasn't in the heaviest combination for 12 species (pass 2), so taking the heaviest set would pick the wrong one. For integration proposes D7 wording.

**Tags:** Mega 92 sets, Z-Crystal 176, Stealth Rock 152, hazard removal 137.

**Independent recomputation.** All 1063 weights were recomputed in Python from the raw chaos file, and all match to the stored 6 digits (pass 2 also recomputed them in Node):

```bash
python3 - <<'EOF'
import json, gzip, collections
L = json.load(open('data/priors/v0/species_sets.json'))['species']
c = json.load(gzip.open('tasks/T12-pool-v1/evidence/chaos-gen9nationaldex-1760-2026-10.json.gz'))['data']
bad = 0
for sp, sets in L.items():
    tot = sum(c[k]['usage'] for k in {s['statsSpecies'] for s in sets})
    rows, combos = [], collections.Counter()
    for s in sets:
        f = s['set'].split('|'); k = s['statsSpecies']; d = c[k]; t = sum(d['Abilities'].values())
        item = f[2].lower() or 'nothing'; ab = list(d['Abilities'])[0] if s['tags']['mega'] else f[3].lower()
        moves = sorted(f[4].lower().split(','))
        w = d['Items'][item] / t * d['Abilities'][ab] / t
        for m in moves: w *= d['Moves'][m] / t
        combo = (k, item, ab, tuple(moves)); combos[combo] += 1; rows.append((s, w, combo, k))
    bad += sum(abs(w * c[k]['usage'] / tot / combos[combo] - s['weight']) / s['weight'] > 1e-5 for s, w, combo, k in rows)
print(bad)   # 0
EOF
```

### Count for the Phase 2 pool

At the pin, the 13 threads and the sample teams give 650 distinct teams that validate as OU (613 distinct rosters). Each is dated by the earliest post linking it that wasn't edited more than 31 days after it was made, since such an edit may have added the link. A team that only such posts link has an unknown date.

| First posted | Teams |
|---|---|
| 2024 | 161 |
| 2025 | 176 |
| 2026 | 191 |
| Date unknown | 97 |
| Sample teams | 25 |

The unknown-date teams come from the sample-team thread (its two linking posts were edited in June 2026) and posts in NDPL VI and NDWC IV. 147 teams are dated 2026-04-01 or later.

Per thread:

| Thread | Pastes | Valid OU | Newest first link |
|---|---|---|---|
| NDFL IV dump | 40 | 9 | 2026-11-22 |
| NDPL VII dump | 130 | 87 | 2026-11-02 |
| NDWC VI dump | 72 | 51 | 2026-05-16 |
| NDCL I dump | 106 | 42 | 2026-03-04 |
| NatDex OU Teams of the Week | 10 | 10 | 2026-01-02 |
| NDFL III dump | 92 | 24 | 2025-12-06 |
| NDPL VI dump | 156 | 76 | 2025-11-18 |
| NDWC V dump | 101 | 47 | 2025-06-09 |
| NDBD I dump | 140 | 25 | 2025-03-10 |
| NDFL II dump | 81 | 32 | 2024-11-20 |
| NDPL V dump | 130 | 44 | 2024-11-04 |
| NDWC IV dump | 160 | 85 | 2024-06-02 |
| National Dex Sample Teams thread | 125 | 93 | 2023-03-08 (posts edited 2026-06) |

A paste is counted under the thread of the post that dates it, as above. Validating at today's pin doesn't make an old team current: the 1760 meta drifts ~10% a month (D4). So a Phase 2 pool of 200–300 teams from these sources would reach back into 2025.

What the count leaves out, or may wrongly include:

- Not counted: tours with no dump thread in this list, and teams that exist only as replays.
- May include a few non-OU teams: unlabelled NatDex UU-ish or gimmick teams that use one OU Pokemon. Pass 1 flagged `1c074cdf9f4314a6` and `529f1bfdb74db08f`, and 10 of NDBD I's 25 counted teams are unlabelled.

### Limits

- **Doubles and monotype filters:** they caught nothing beyond the format labels. An unlabelled doubles team with fewer than 2 support movers would pass. The pool's one unlabelled team was checked by eye.
- **Stats month:** the weights use October's stats, and resampling and calcs inherit their drift.
- **Held-out split:** it has no group constraint (deferred in D4).
- **Paste authors:** `source.author` is the paste's author, or the forum poster when the paste gives none or a pokepast.es "Guest NNNNN" placeholder.
- **Stats entries for other formes:** the stats have no entry of their own for Greninja-Bond or Keldeo-Resolute, so their library sets use Greninja's and Keldeo's. A Sinistcha-Masterpiece candidate team, not in the pool or library, used Sinistcha's. The report lists every such fallback, including rejected candidates', so a forme losing its entry would show there.
- **Greninja-Bond's key:** the library files Greninja's sets under `Greninja-Bond`, which the protocol never shows (team-pool.md, species_sets.json).
- **Pokémon Champions:** Smogon's forums also host "National Dex Champions OU" threads (announcements, metagame discussion). D4 rebuilds on a NatDex ruling on Pokémon Champions content. I didn't read the threads.

## Outputs

From a set-up checkout (AGENTS.md, Conventions; `nvm use` first):

```bash
tasks/T12-pool-v1/acceptance.sh     # type check, validate-pool, check-library, rebuild compared byte for byte
node scripts/pool/build.ts > tasks/T12-pool-v1/evidence/build-report.txt   # rebuild data/pool/v1 and data/priors/v0
node tasks/T12-pool-v1/smoke-battles.ts   # 200 random-player games between v1 teams; exits 1 on any error or a game over a minute
node tasks/T12-pool-v1/smoke-battles.ts --library   # 788 games on 197 teams dealt from every library set
scripts/pool/fetch.sh               # take any missing snapshot; never rewrites one that exists
```

`fetch.sh` skips every snapshot already in `evidence/`, including `pastes.jsonl.gz`. To refetch the pastes, delete the bundle. The script fetches into `evidence/.pastes/` (gitignored, kept between runs), and fails without writing a bundle if any paste can't be fetched. A full refetch is 1,343 requests, about 30 minutes.

`smoke-battles.ts` was also run on a planted pool where every set uses Hidden Power with an `hpType` of `ice`: 0 of 200 games ended, and it reported 200 errors and exited 1.

| File | What it is |
|---|---|
| `data/pool/v1/teams.jsonl`, `holdout.txt` | The pool and its held-out ids |
| `data/priors/v0/species_sets.json` | The set library |
| `scripts/pool/build.ts` | Builds both, prints the report |
| `scripts/pool/showdown.ts` | Showdown at the pin, the strict set check, normalization, tags |
| `scripts/pool/check-library.ts` | The library's acceptance checks |
| `scripts/pool/fetch.sh`, `threads.txt` | Snapshots the sources |
| `acceptance.sh`, `tsconfig.json` | Acceptance checks and the type check |
| `smoke-battles.ts` | Random-player games between v1 teams, or on every library set (`evidence/smoke-battles.log`) |
| `evidence/` | Source snapshots, `build-report.txt`, `acceptance.log`, `smoke-battles.log` |

## For integration

1. AGENTS.md, Current state, replace the bullet with:

   > - 2026-11-27: Phase 1 (plan.md, Phases). `data/pool/v1/` holds a 50-team pool with 10 held out, `data/priors/v0/` its set library ([T12](tasks/T12-pool-v1/README.md)), and `data/replays/v0/` the public replay corpus ([T04](tasks/T04-replay-corpus/README.md), Outputs). The only project code so far is `scripts/`.

   (Adjust "the only project code" if T09–T11 have merged by then.)

2. AGENTS.md, Areas, replace the team-pool row with:

   > | Team pool and set priors | v1: 50 teams, 10 held out; library v0: 1063 sets | `data/pool/`, `data/priors/`, `scripts/validate-pool.ts`, `scripts/pool/` | [team-pool](docs/areas/team-pool.md) |

3. AGENTS.md, Conventions, Re-pin: after "validate every pool team (`node scripts/validate-pool.ts data/pool/<ver>/teams.jsonl`, once per pool version in use)" insert ", check every set library (`node scripts/pool/check-library.ts data/priors/<ver>/species_sets.json data/pool/<pool ver>`)".

4. plan.md, Format facts, replace "and ~0.5 Z-Crystals per team (research agent's count)" with "and 0.66 Z-Crystals and 0.79 Megas per team (T12, from the Oct 2026 1760 chaos stats)".

5. decisions.md, D4, Decided, in the "Resample sets every game" item, after "A set's weight is the product of its species' 1760 chaos-stat marginals for its item, ability and four moves, since sets themselves carry no usage." insert:

   > Two refinements, the user's call in T12's review (2026-11-27): a set is weighed under the stats entry it counts as (a Mega set under its Mega forme), and its weight is multiplied by that entry's share of the usage of the entries its species' sets count under, so Mega-X and Mega-Y split by usage. Sets that differ only in what the weight ignores (nature, spread, a Mega's base ability) split one weight evenly.

6. decisions.md, D7, in "Calcs assume the species-level usage prior: the highest-weight library set (D4) consistent with what the protocol has explicitly revealed", after "the highest-weight library set (D4)" insert " (in T12's library, the first consistent set in file order: from the consistent combination of item, ability and moves with the most summed weight)".

7. checklist.md, For a later replan, the D4 item: append "T12 counted 650 distinct teams that validate as OU from the NatDex tour dumps and sample teams: 191 first posted in 2026, 147 since April, 97 of unknown date (T12, Result)."

8. For a planning session to decide:
   - whether choosing pool teams to match the 1760 species usage (T12, How v1 was chosen) is acceptable now, given D4 defers fitting the pool's usage to the stats to Phase 3;
   - whether "National Dex Champions OU" on Smogon's forums is the Pokémon Champions ruling D4's refresh rule waits for (T12, Limits).
