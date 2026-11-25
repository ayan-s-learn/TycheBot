# Team pool

Component 5 of plan.md. D4 owns the design. Set priors (`data/priors/`) don't exist yet.

## Status (2026-11-24)

`data/pool/v0/teams.jsonl` holds a 20-team stub pool that validates at Showdown `29f2d99`. Every team starts a battle (Team Preview), but none has been played through.

## teams.jsonl

D4's path: `data/pool/<ver>/teams.jsonl`. One JSON object per line:

| Field | Type | Holds |
|---|---|---|
| `id` | string | Unique in the file, e.g. `smogon-sample-00` |
| `team` | string | The team in Showdown's packed format (`Teams.unpack`) |
| `source.url` | string | Where the team came from |
| `source.entry` | number | Index in that file when fetched; upstream may reorder it |
| `source.name`, `source.author`, `source.date` | string or null | As the source gives them. v0 has no dates |

## Validating

From the root, after setup (AGENTS.md, Conventions):

```bash
node scripts/validate-pool.ts data/pool/v0/teams.jsonl
```

It runs Showdown's `TeamValidator` for `gen9nationaldex` on every line. If any team fails, it names each one with the validator's problems and exits 1. It refuses to run if `vendor/pokemon-showdown` isn't at the commit in `showdown.pin`. It reads `id` and `source.name` only to label failures, and doesn't check them, the other `source` fields or duplicate teams.

It is type-checked by `tasks/T05-stub-pool/tsconfig.json` (command in AGENTS.md, Conventions).

## What v0 contains

The first 20 of Smogon's 25 NatDex sample teams (entries 0–19; 20–24 are unused). `tasks/T05-stub-pool/build-pool.ts` builds it from the snapshot in that task's `evidence/`.

- 40 species; 8 teams have a Mega Stone.
- Team Preview hides a forme 15 times: `Zamazenta-*` 12, `Urshifu-*` 3.
- No Illusion user.
- Skewed: 19 of 20 teams carry a Z-Crystal, and Zamazenta is on 12 (15.2% usage at the 1760 cutoff, plan.md). Two teams share at most 4 species.

Full counts (it exits 1 unless the file has exactly 20 distinct teams):

```bash
node tasks/T05-stub-pool/report.ts data/pool/v0/teams.jsonl
```

## Gotchas

- `validateTeam` edits the sets passed to it (e.g. `sim/team-validator.ts` assigns `set.hpType` and `set.ivs`). `build-pool.ts` therefore validates a separately unpacked copy and writes the source sets, with defaults filled in.
- 17 v0 sets carry an `hpType` but no Hidden Power move. The validator still checks it: at `29f2d99`, changing a Zamazenta set's to `Fighting` fails validation.
