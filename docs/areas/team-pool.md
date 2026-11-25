# Team pool

Component 5 of plan.md. D4 owns the design. Set priors (`data/priors/`) don't exist yet.

## Status (2026-11-25)

`data/pool/v0/teams.jsonl` holds a 20-team stub pool that validates at Showdown `29f2d99`. T05's checks take each team to Team Preview and play no full battles.

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

A line passes only if its `team`:

- survives `Teams.pack(Teams.unpack(team))` unchanged;
- has 6 Pokemon;
- passes Showdown's `TeamValidator` for `gen9nationaldex`;
- comes out of validation with every value as written. A gender, nature, `hpType`, Tera type, ball or Dynamax field it leaves unset may be filled in (see Gotchas).

It names each failing team with the problems and exits 1. It refuses to run if the `vendor/pokemon-showdown` checkout isn't at the commit in `showdown.pin`. It doesn't check the built `dist/` itself. `setup-showdown.sh` removes `dist/` before it changes the checkout, so a failed setup can't leave the old build under a new one. It reads `id` and `source.name` only to label failures, and doesn't check them, the other `source` fields or duplicate teams.

It is type-checked by `tasks/T05-stub-pool/tsconfig.json` (command in AGENTS.md, Conventions).

## What v0 contains

The first 20 of Smogon's 25 NatDex sample teams (entries 0–19; 20–24 are unused). `tasks/T05-stub-pool/build-pool.ts` builds it from the snapshot in that task's `evidence/`.

- 40 species; 8 teams have a Mega Stone.
- Team Preview hides a forme 15 times: `Zamazenta-*` 12, `Urshifu-*` 3.
- No Illusion user.
- Skewed: 19 of 20 teams carry a Z-Crystal, and Zamazenta is on 12 (15.2% usage at the 1760 cutoff, plan.md). Two teams share at most 4 species.

Full counts, from a T05 script that exits 1 unless the file has exactly 20 distinct teams with a Mega Stone, a Z-Crystal and a hidden forme:

```bash
node tasks/T05-stub-pool/report.ts data/pool/v0/teams.jsonl
```

## Gotchas

- Packing hand-typed export text can fail the round trip on capitalization (`U-Turn`). One `Teams.pack(Teams.unpack(packed))` fixes the move name.
- `Teams.import` on pkmn.github.io's JSON teams passes species through `Dex.getName`, which cuts names to 18 characters, so Urshifu-Rapid-Strike fails validation (sample teams 14, 17 and 18). Pack the sets directly, as T02's `teams.ts` and T05's `build-pool.ts` do.
- At `29f2d99` an `hpType` of `ice` passes `validate-team`, and a `Battle` throws when that set uses Hidden Power.
- `validateTeam` repairs some illegal sets in place and passes them: at `29f2d99`, Terapagos with Wonder Guard becomes Tera Shift and Mawile with Huge Power becomes Hyper Cutter. A `Battle` started on the unrepaired string plays it as written. So Showdown's `validate-team` passing isn't enough for a pool team; use the script above.
- 17 v0 sets carry an `hpType` but no Hidden Power move. At `29f2d99` the validator accepts only the listed type on 13 of them (Ogerpon-Wellspring 8, Terapagos 4, Raging Bolt 1) and every type but Normal, Fairy and Stellar on the 4 Great Tusk sets.
