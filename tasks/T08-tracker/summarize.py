"""Assigns every mismatch class in compare.py's output to a cause, and fails if any class is left over.

Each class carries its total and its count under each Illusion tag (compare.py, illusion_tag). A cause's rule
matches the class's field and name; the four Illusion causes take only the tagged parts of a class no other
rule matches, so whatever is left of it stays unclassified.

Usage: uv run python summarize.py <cmp-pkmn.json> <cmp-pokeenv.json>   (exit 1 if anything is unclassified)
"""

import json
import re
import sys
from collections import Counter

Z_MOVES = (
    r"(alloutpummeling|supersonicskystrike|aciddownpour|tectonicrage|continentalcrush|savagespinout|"
    r"neverendingnightmare|corkscrewcrash|infernooverdrive|hydrovortex|bloomdoom|gigavolthavoc|shatteredpsyche|"
    r"subzeroslammer|devastatingdrake|blackholeeclipse|twinkletackle|breakneckblitz|catastropika|"
    r"10000000voltthunderbolt|stokedsparksurfer|extremeevoboost|pulverizingpancake|genesissupernova|"
    r"sinisterarrowraid|maliciousmoonsault|oceanicoperetta|splinteredstormshards|letssnuggleforever|"
    r"clangoroussoulblaze|guardianofalola|searingsunrazesmash|menacingmoonrazemaelstrom|"
    r"lightthatburnsthesky|soulstealing7starstrike)"
)
ACTIVATIONS = r"(terashell|terashift|psychicterrain|endure|poltergeist|struggle|roost|protect)"

# (cause id, kind, description, tracker or None for both, field regex, class regex)
CAUSES = [
    ("regenerator", "not shown",
     "Regenerator's heal on switch-out is never logged, so an opposing benched mon's HP is the last one shown",
     None, r"opp\.hp", r"^regenerator \(last shown\)$"),
    ("regenerator-inferable", "unsupported",
     "Regenerator's heal on switch-out isn't estimated although the species can have no other ability "
     "(Tornadus-Therian), so the HP is the last one shown", None, r"opp\.hp", r"^regenerator \(last shown, inferable\)$"),
    ("regenerator-rounding", "not shown",
     "an estimate of Regenerator's heal is 1% off: the HP% it starts from is rounded",
     None, r"opp\.hp", r"^regenerator \(estimate, within 1\)$"),
    ("regenerator-estimate", "tracker bug", "an estimate of Regenerator's heal is more than 1% off",
     None, r"opp\.hp", r"^regenerator \(estimate\)$"),
    ("healing-wish", "unsupported",
     "a pending Healing Wish or Lunar Dance (a slot condition) isn't tracked", None, r"conds\.", r"missing:(healingwish|lunardance)"),
    ("future-sight-silent", "tracker bug",
     "a pending Future Sight is kept after it fails because its target fainted, which Showdown shows only as "
     "a `-hint` line, which both trackers ignore",
     None, r"conds\.", r"extra:futuremove"),
    ("toxic-cap", "tracker bug", "the toxic counter isn't capped at 15 as the sim's stage is",
     None, r"statusTurns", r"tox \+\d+ past cap"),
    ("pkmn-duplicate-slots", "tracker bug",
     "each request duplicates the own active's move slots (rememberMove compares `virtual` with the request "
     "slots' undefined)", "pkmn", r"own\.moveSlots", r"duplicate slots"),
    ("pkmn-z", "unsupported",
     "Z-Moves: no Z-used state (`-zpower` is unhandled), and a Z-Move is recorded among the mon's moves under its "
     "Z name", "pkmn", r"flags\..*|opp\.moves|own\.moves", r"zUsed|^not in set:" + Z_MOVES + "$|^missing: extra:" + Z_MOVES + "$"),
    ("pkmn-mega", "unsupported",
     "no Mega-used state; derived from the side's formes, it is lost when a fainted Mega reverts",
     "pkmn", r"flags\.", r"megaUsed"),
    ("pkmn-heal-reset", "tracker bug",
     "any `-heal` without `[from]` (Roost, Recover, Leech Seed's silent heal) runs the Healing Wish branch and "
     "zeroes the sleep and toxic counters", "pkmn", r"statusTurns", r"^(tox|slp) -\d+$"),
    ("pkmn-locked-moves", "tracker bug",
     "the own active's move list is emptied when the request lists only a move without PP (a locked move, "
     "recharge or Struggle)", "pkmn", r"own\.moves", r"^missing:[a-z,]+ extra:$"),
    ("pkmn-roost", "tracker bug (harmless)",
     "Roost's volatile is kept only for Flying users, where it has an effect", "pkmn", r"opp\.volatiles", r"^missing:roost$"),
    ("pokeenv-activations", "tracker bug",
     "one-off events (`-activate`, `-singleturn`: Tera Shell, Tera Shift, Psychic Terrain's block, Endure, ...) "
     "are stored as effects that last until the mon switches out",
     "pokeenv", r"(own|opp)\.volatiles", r"^(extra:" + ACTIVATIONS + r" ?)+$"),
    ("pokeenv-forme", "tracker bug",
     "`species` keeps the pre-change name after Mega Evolution and other forme changes (types, base stats and "
     "ability do change)", "pokeenv", r"opp\.species", r"^([a-z0-9]+)[a-z0-9]+->\1$"),
    ("pokeenv-toxic-turns", "tracker bug",
     "the toxic counter moves at `|turn|`, not at the poison damage, so it is one off for a mon that came in "
     "after a faint and at decisions between the residual and the next turn",
     "pokeenv", r"statusTurns", r"^tox [+-]1$"),
    ("pokeenv-rest", "tracker bug", "the counter carries over when Rest replaces toxic", "pokeenv", r"statusTurns", r"^slp \+\d+$"),
    ("pokeenv-future-sight-user", "tracker bug",
     "a pending Future Sight is an effect on its user, lost when the user switches out or faints",
     "pokeenv", r"conds\.", r"missing:futuremove"),
]
ILLUSION = [
    ("opp-now", "illusion-hidden", "not shown",
     "an opposing Illusion, while it holds: the disguise's entry gets the Zoroark's HP, status, boosts and moves"),
    ("opp-faint-hidden", "illusion-faint", "not shown",
     "an opposing Zoroark that fainted in disguise: the protocol shows the disguise fainting, with no "
     "`|replace|`, so the Zoroark looks alive and the disguise fainted"),
    ("opp-after", "illusion-after", "tracker bug",
     "an opposing Illusion after `|replace|` broke it: what was attributed to the disguise stays on the wrong "
     "entry (any mismatch no other rule explains, at a later decision of that game)"),
    ("own", "illusion-own", "tracker bug",
     "the player's own Illusion, which its request shows: events of the active Zoroark go on the disguise's "
     "entry (any mismatch no other rule explains, while or after the player's Illusion held)"),
]


def summarize(cmp, tracker):
    by_cause = Counter()
    unclassified = {}
    for key, counts in cmp["byClass"].items():
        n = counts["total"]
        field, cls = key.split(" | ", 1)
        for cid, _, _, who, fre, cre in CAUSES:
            if who in (None, tracker) and re.search(fre, field) and re.search(cre, cls):
                by_cause[cid] += n
                break
        else:
            for tag, cid, _, _ in ILLUSION:
                if counts[tag]:
                    by_cause[cid] += counts[tag]
            left = n - sum(counts[tag] for tag, *_ in ILLUSION)
            if left:
                unclassified[key] = left
    return by_cause, unclassified


def main():
    ok = True
    desc = {c[0]: (c[1], c[2]) for c in CAUSES} | {cid: (kind, d) for _, cid, kind, d in ILLUSION}
    out = {}
    for path in sys.argv[1:]:
        cmp = json.load(open(path))
        tracker = cmp["tracker"]
        by_cause, unclassified = summarize(cmp, tracker)
        out[tracker] = {
            "decisions": cmp["decisions"],
            "decisionsWithMismatch": cmp["decisionsWithMismatch"],
            "mismatches": sum(by_cause.values()) + sum(unclassified.values()),
            "byCause": {c: {"kind": desc[c][0], "n": n} for c, n in by_cause.most_common()},
            "unclassified": unclassified,
        }
        ok = ok and not unclassified
    out["causes"] = {c: d for c, (_, d) in desc.items()}
    print(json.dumps(out, indent=1))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
