"""Record version 2, Python's end. worker/obs/record.ts holds the same layout and code lists, and each end refuses a
version it doesn't know. docs/areas/env-workers.md documents every field. Change VERSION whenever a field or the meaning
of its values changes; the layout check compares the fields and the code lists."""

import numpy as np

from tyche.transport.record import VersionError

VERSION = 2

WEATHERS = ["Sun", "Rain", "Sand", "Snow", "Hail", "Harsh Sunshine", "Heavy Rain", "Strong Winds"]
TERRAINS = ["Electric", "Grassy", "Psychic", "Misty"]
FIELD_ABILITIES = ["Beads of Ruin", "Sword of Ruin", "Tablets of Ruin", "Vessel of Ruin", "Fairy Aura", "Dark Aura", "Aura Break"]
FIELD_NUM = ["weatherMin", "weatherMax", "terrainMin", "terrainMax", "trickRoom", "trickRoomMin", "trickRoomMax",
             "gravity", "magicRoom", "wonderRoom", *FIELD_ABILITIES]
HAZARDS = ["stealthrock", "spikes", "toxicspikes", "stickyweb"]
SCREENS = ["reflect", "lightscreen", "auroraveil", "tailwind", "safeguard", "mist"]
SIDE_NUM = [*HAZARDS, *SCREENS, *(f"{s}Min" for s in SCREENS), *(f"{s}Max" for s in SCREENS), "megaUsed", "zUsed"]
VOLATILES = [
    "substitute", "leechseed", "confusion", "taunt", "encore", "torment", "disable", "yawn", "perishsong", "curse",
    "attract", "focusenergy", "magnetrise", "aquaring", "ingrain", "healblock", "embargo", "smackdown", "saltcure",
    "partiallytrapped", "protosynthesis", "quarkdrive", "flashfire", "slowstart", "charge", "typechange", "roost",
    "protect", "destinybond", "endure", "airballoon", "itemremoved", "fallen", "transform", "gastroacid", "stockpile",
    "mustrecharge", "noretreat", "tarshot", "octolock", "glaiverush", "throatchop", "syrupbomb",
]
MON_FLAGS = ["canMega", "isMega", "holdsZ", "formeHidden", "priorConfidence", "noPrior"]
MOVE_NUM = ["revealed", "pp", "disabled", "zEligible"]
EVENTS = [
    "turn", "move", "switch", "faint", "cant", "damage", "heal", "sethp", "status", "curestatus", "boost", "unboost",
    "clearboost", "weather", "fieldstart", "fieldend", "sidestart", "sideend", "swapsideconditions", "start", "end",
    "activate", "singleturn", "item", "enditem", "ability", "endability", "formechange", "transform", "mega", "zpower",
    "prepare", "mustrecharge", "crit", "supereffective", "resisted", "immune", "miss", "fail", "hitcount",
]
EVENT_COLS = ["type", "side", "slot", "kind", "id", "turn"]
EVENT_SIDE = {"own": 0, "opposing": 1, "none": 2}
ID_KIND = {"none": 0, "species": 1, "move": 2, "item": 3, "ability": 4}
N_EVENTS = 16
# Item and ability ids (worker/obs/vocab.ts): 0 none, 1 outside the vocab, 2 not yet revealed.
NONE, OUTSIDE, UNREVEALED = 0, 1, 2

FIELDS = [
    ("game", "i4", ()),
    ("side", "i4", ()),
    ("turn", "i4", ()),
    ("kind", "i4", ()),
    ("mask", "i4", (18,)),
    ("oppSlot", "i4", (6,)),
    ("weather", "i4", ()),
    ("terrain", "i4", ()),
    ("species", "i4", (12,)),
    ("item", "i4", (12,)),
    ("ability", "i4", (12,)),
    ("types", "i4", (12, 2)),
    ("moves", "i4", (12, 4)),
    ("status", "i4", (12,)),
    ("events", "i4", (N_EVENTS, len(EVENT_COLS))),
    ("fieldNum", "f4", (len(FIELD_NUM),)),
    ("sideNum", "f4", (2, len(SIDE_NUM))),
    ("hp", "f4", (12,)),
    ("fainted", "f4", (12,)),
    ("active", "f4", (12,)),
    ("boosts", "f4", (12, 7)),
    ("stats", "f4", (12, 6)),
    ("level", "f4", (12,)),
    ("statusTurns", "f4", (12, 2)),
    ("volatiles", "f4", (12, len(VOLATILES))),
    ("monFlags", "f4", (12, len(MON_FLAGS))),
    ("moveNum", "f4", (12, 4, len(MOVE_NUM))),
    ("calcs", "f4", (2, 6, 4, 6)),
    ("eventHp", "f4", (N_EVENTS,)),
]
RECORD = np.dtype([(name, "<" + dtype, shape) for name, dtype, shape in FIELDS])


def layout():
    """The layout as the worker's hello frame states it."""
    return {
        "version": VERSION,
        "recordBytes": RECORD.itemsize,
        "fields": [
            {"name": name, "dtype": dtype, "shape": list(shape), "offset": RECORD.fields[name][1]}
            for name, dtype, shape in FIELDS
        ],
        "codes": {
            "weathers": WEATHERS, "terrains": TERRAINS, "fieldNum": FIELD_NUM, "sideNum": SIDE_NUM, "volatiles": VOLATILES,
            "monFlags": MON_FLAGS, "moveNum": MOVE_NUM, "events": EVENTS, "eventCols": EVENT_COLS,
            "eventSide": EVENT_SIDE, "idKind": ID_KIND,
        },
    }


def check_layout(theirs):
    """Refuses a worker whose record version, layout or code lists differ from this end's."""
    if theirs.get("version") != VERSION:
        raise VersionError(f"worker sends record version {theirs.get('version')}, this end knows {VERSION}")
    if theirs != layout():
        raise VersionError(f"record version {VERSION} but the layouts differ: worker {theirs}, here {layout()}")
