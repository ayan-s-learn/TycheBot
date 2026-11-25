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

It runs Showdown's `TeamValidator` for `gen9nationaldex` on every line, names each failing team with the validator's problems, and exits 1. It refuses to run if `vendor/pokemon-showdown` isn't at the commit in `showdown.pin`. It doesn't check for duplicate teams.

It is type-checked by `tasks/T05-stub-pool/tsconfig.json` (command in AGENTS.md, Conventions).

## What v0 contains

The first 20 of Smogon's 25 NatDex sample teams (entries 0–19), built from the snapshot in `tasks/T05-stub-pool/evidence/` by `build-pool.ts` there.

- 40 species; 8 teams have a Mega Stone and 19 have a Z-Crystal.
- Team Preview hides a forme 15 times: `Zamazenta-*` 12, `Urshifu-*` 3.
- No Illusion user (checked against the species list).

Full counts:

```bash
node tasks/T05-stub-pool/report.ts data/pool/v0/teams.jsonl
```

## Gotchas

- Packed teams are the source sets, not the validator's edited copies.
- 17 sets carry an `hpType` but no Hidden Power move (counted on v0). At the pin, `data/` reads `hpType` only for Hidden Power and in one custom rule (`data/rulesets.ts`), so don't treat it as a difference between sets.
