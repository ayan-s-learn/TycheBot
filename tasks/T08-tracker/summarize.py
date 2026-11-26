"""Assigns every mismatch class in compare.py's output to a cause, and fails if any class is left over.

Each class carries [total, at a decision where an Illusion holds, after one held earlier in the game]. A
cause's rule matches the class's field and name; the two Illusion causes take only the Illusion-tagged parts of
a class no other rule matches, so whatever is left of it stays unclassified.

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
ACTIVATIONS = r"(supremeoverlord|terashell|terashift|psychicterrain|endure|poltergeist|struggle|roost|protect)"

# (cause id, kind, description, tracker or None for both, field regex, class regex)
CAUSES = [
    ("regenerator", "not shown",
     "Regenerator's heal on switch-out is never logged, so an opposing benched mon's HP is stale "
     "(poke-env estimates it when it knows the ability, off by Showdown's 99% rounding)",
     None, r"opp\.hp", r"regenerator"),
    ("healing-wish", "unsupported",
     "a pending Healing Wish or Lunar Dance (a slot condition) isn't tracked", None, r"conds\.", r"missing:(healingwish|lunardance)"),
    ("future-sight-silent", "tracker bug",
     "a pending Future Sight is kept after it ends without a message (its target fainted first)",
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
    ("pkmn-roost", "tracker choice",
     "Roost's volatile is kept only for Flying users, where it has an effect", "pkmn", r"opp\.volatiles", r"^missing:roost$"),
    ("pokeenv-activations", "tracker bug",
     "one-off events (`-activate`, `-singleturn`: Supreme Overlord, Tera Shell, Psychic Terrain's block, "
     "Endure, ...) are stored as effects and some are never cleared",
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
    ("illusion-hidden", "not shown",
     "Illusion, while it holds: the disguise's entry gets the Zoroark's HP, status, boosts and moves"),
    ("illusion-after", "tracker bug",
     "Illusion, after `|replace|` breaks it: what was attributed to the disguise stays on the wrong entry "
     "(tagged by game: any mismatch no other rule explains, at a decision after an Illusion held in that game)"),
]


def summarize(cmp, tracker):
    by_cause = Counter()
    unclassified = {}
    for key, (n, now, after) in cmp["byClass"].items():
        field, cls = key.split(" | ", 1)
        for cid, _, _, who, fre, cre in CAUSES:
            if who in (None, tracker) and re.search(fre, field) and re.search(cre, cls):
                by_cause[cid] += n
                break
        else:
            by_cause["illusion-hidden"] += now
            by_cause["illusion-after"] += after
            if n - now - after:
                unclassified[key] = n - now - after
    return by_cause, unclassified


def main():
    ok = True
    desc = {c[0]: (c[1], c[2]) for c in CAUSES + ILLUSION}
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
