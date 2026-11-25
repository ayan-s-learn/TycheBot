# T05: stub pool

## Brief

- **Objective:** a pool of 20 `gen9nationaldex` teams that validate at the pinned Showdown commit, at D4's pool path. Phase 0's exit needs it, and Phase 1 grows it to ~50.
- **Inputs:**
  - Setup first (AGENTS.md, Conventions), including `scripts/setup-showdown.sh`: each worktree builds its own `vendor/`.
  - D4's decided parts (sources through Phase 2, validation, interface), plan.md (Components 5).
  - Sources, in order: Smogon's NatDex sample teams (`https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json`; T01 used entries 0 and 2), then recent tournament pastes through pokepast.es JSON. All 25 sample teams validated at the pin on 2026-11-24 (planning check), so pastes are needed only to replace any that fail.
- **Deliverables:**
  - `data/pool/v0/teams.jsonl`: one team per line, with the team in Showdown's packed format and its source (URL, and name and date where given). The task picks any other fields.
  - `scripts/validate-pool.ts`: validates every team in a pool file at the pin and exits non-zero if any fails, naming it. The monthly re-pin (Conventions) will use it.
  - `docs/areas/team-pool.md`, the area's notes (AGENTS.md, Areas): the `teams.jsonl` format, the validate command, and what the pool contains.
  - Result: how many teams each source gave, how many failed validation and why, and counts of species, Mega Stones and Z-Crystals.
  - Under For integration: the team-pool row for AGENTS.md's Areas table, and the validate command for the re-pin step in Conventions.
- **Acceptance checks:**
  - `node scripts/validate-pool.ts data/pool/v0/teams.jsonl` exits 0 at the pin, with 20 distinct teams.
  - On a copy in which one team has a banned Pokémon, it exits non-zero and its output names that team and the ban, so a crash can't pass for a rejection.
  - Between them, the teams include at least one Mega Stone, one Z-Crystal, and one forme that Team Preview hides (plan.md, Format facts). No sample team has an Illusion user (checked 2026-11-24); T02 covers Illusion with a test team instead.
- **May change:** `tasks/T05-stub-pool/`, `data/pool/v0/`, `scripts/validate-pool.ts`, `docs/areas/team-pool.md`.
- **Limits:** one session, no paid services.
- **Stop and report if:** fewer than 20 teams from D4's sources validate.

## Progress

```text
2026-11-25
State: done
Verified: all acceptance checks from a clean clone of this branch at eae2f40, Showdown 29f2d99
  (evidence/acceptance.log). A second setup run over that build gave identical acceptance output.
  Rebuilding the pool left the clone unchanged, and validate-team accepted all 20 teams.
Pending: none
Next: a planning session reviews and merges the PR.
```

## Result

All 25 of Smogon's sample teams validate at Showdown 29f2d99, so the pool is entries 0–19 of them, in file order.

| Source | Teams checked | Failed validation | In the pool |
|---|---|---|---|
| Smogon NatDex sample teams | 25 | 0 | 20 |
| Tour pastes | not needed | – | 0 |

Source: `https://pkmn.github.io/smogon/data/teams/gen9nationaldex.json`, fetched 2026-11-24, 36,674 bytes, SHA-256 `f35934eb5238b3069139fa6a67de999e654873e5da4f8f5142b84446c60a1fe1`, saved as `evidence/sample-teams.json`.

Acceptance checks (`acceptance.sh` from a clean clone, Node 24.22.3; log in `evidence/acceptance.log`):

- The pool validates: 20/20, 20 distinct.
- With Mewtwo swapped into the team on line 7, the validator exits 1 with `FAIL smogon-sample-06 (line 7)` and `Mewtwo is tagged ND Uber, which is banned.`
- Mega Stones, Z-Crystals and hidden formes are all present (below).
- Rebuilding from the snapshot gives the committed file byte for byte.
- The validator also rejects a 5-mon team, a malformed field, and sets it would otherwise silently edit: changed ability, species, moves, gender, Tera type, `hpType` or nickname.

The validator is stricter than D4's `validate-team`, which passes sets it repairs, such as Terapagos with Wonder Guard (notes, Gotchas). It also requires 6 Pokemon and canonical packed form.

`scripts/setup-showdown.sh` is outside the brief's May change; the user OK'd this fix on 2026-11-25. The script checked out the new pin before `npm ci`, so a failure there left the old `dist/`, which then passed the pin check. It now removes `dist/` before touching the checkout. Reproduced on copies with a stand-in pin and a failing `npm`: with the old script the validator reported 20/20 at the new pin, with the new one it fails for lack of a build. A failed fetch leaves no `dist/` either, so it now removes a good build too. A `node build` failing partway wasn't tried.

Separately, the `validate-team gen9nationaldex` CLI accepts each of the 20 packed teams (command in Outputs).

### Counts

From `node tasks/T05-stub-pool/report.ts data/pool/v0/teams.jsonl`:

- **Species,** 40 across 120 sets: Zamazenta 12, Ogerpon-Wellspring 8, Iron Treads 7, Slowking-Galar 7, Zapdos 7, Garchomp 5, Tapu Lele 5, Gholdengo 4, Great Tusk 4, Kingambit 4, Kyurem 4, Pecharunt 4, Terapagos 4, Alomomola 3, Diancie 3, Landorus-Therian 3, Samurott-Hisui 3, Ting-Lu 3, Tornadus-Therian 3, Urshifu-Rapid-Strike 3, Corviknight 2, Dragonite 2, Ferrothorn 2, Latios 2, and 1 each of Ceruledge, Cinderace, Cresselia, Hatterene, Heatran, Lopunny, Mawile, Moltres, Moltres-Galar, Ninetales, Raging Bolt, Slowbro, Tyranitar, Venusaur, Volcarona, Weavile.
- **Mega Stones,** 8 (one each on 8 teams): Diancite 3, Latiosite 2, Lopunnite 1, Mawilite 1, Tyranitarite 1.
- **Z-Crystals,** 19 (one each on 19 teams): Dragonium Z 4, Darkinium Z 3, Fightinium Z 3, Psychium Z 3, Flyinium Z 2, Ghostium Z 2, Groundium Z 1, Rockium Z 1.
- **Hidden at Team Preview,** 15, read from the sim's `|poke|` lines: `Zamazenta-*` 12, `Urshifu-*` 3.

### Limits

- Entries 20–24 are left out. Blissey, Clodsire, Gliscor and Toxapex are in no pool team: of all 25 samples, only entries 23 and 24 have any of them.
- The pool is skewed: 19 of 20 teams carry a Z-Crystal, against plan.md's ~0.5 per team (research agent's count, not checked here), and Zamazenta is on 12, against its 15.2% usage at the 1760 cutoff (plan.md).
- Two teams share at most 4 species.
- Teams were validated and taken to Team Preview. No full battles were played with them.

## Outputs

From a clean clone, on macOS with git, nvm and uv:

```bash
git clone --branch task/T05-stub-pool https://github.com/ayan-s-learn/TycheBot.git && cd TycheBot
```

```bash
nvm use && npm ci && uv sync --locked && scripts/setup-showdown.sh && tasks/T05-stub-pool/acceptance.sh
```

Once the branch is merged and deleted, clone `main` instead. In a checkout that's already set up, run `acceptance.sh` alone, with `nvm use` in the same shell.

To rebuild `teams.jsonl` from the snapshot (reproduces it byte for byte):

```bash
node tasks/T05-stub-pool/build-pool.ts
```

To run Showdown's CLI on each pool team (prints the number accepted):

```bash
ok=0; while IFS= read -r l; do node -p 'JSON.parse(process.argv[1]).team' "$l" | node vendor/pokemon-showdown/pokemon-showdown validate-team gen9nationaldex && ok=$((ok+1)); done < data/pool/v0/teams.jsonl; echo "$ok"
```

| File | What it is |
|---|---|
| `acceptance.sh`, `tsconfig.json` | Type check and the brief's acceptance checks |
| `build-pool.ts` | Packs the snapshot's sets, checks that unpacking returns every field, validates, writes the pool (or the file given as an argument) |
| `report.ts` | Counts, and the contents criteria |
| `evidence/` | Source snapshot and the acceptance log |
