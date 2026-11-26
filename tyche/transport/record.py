"""The skeleton's record, Python's end. worker/skeleton/record.ts holds the same layout, and each end refuses a
version it doesn't know. docs/areas/env-workers.md documents the fields. Change VERSION whenever a field or the meaning
of its values changes (codes, action indices, axis order): the layout check catches only the first."""

import numpy as np

VERSION = 1

FIELDS = [
    ("game", "i4", ()),
    ("side", "i4", ()),
    ("turn", "i4", ()),
    ("kind", "i4", ()),
    ("species", "i4", (12,)),
    ("moves", "i4", (6, 4)),
    ("status", "i4", (12,)),
    ("mask", "i4", (18,)),
    ("hp", "f4", (12,)),
    ("fainted", "f4", (12,)),
    ("active", "f4", (12,)),
    ("boosts", "f4", (12, 7)),
    ("calcs", "f4", (2, 6, 4, 6)),
]
RECORD = np.dtype([(name, "<" + dtype, shape) for name, dtype, shape in FIELDS])
# A game the worker ended or cut off in the step before a batch: winner 0 or 1 by side, -1 for a tie or a cutoff.
ENDED = np.dtype([("game", "<i4"), ("winner", "<i4"), ("truncated", "<i4"), ("turns", "<i4")])

KIND_PREVIEW, KIND_MOVE, KIND_SWITCH = 0, 1, 2
N_ACTIONS = 18


class VersionError(ValueError):
    pass


def layout():
    """The layout as the worker's hello frame states it."""
    return {
        "version": VERSION,
        "recordBytes": RECORD.itemsize,
        "fields": [
            {"name": name, "dtype": dtype, "shape": list(shape), "offset": RECORD.fields[name][1]}
            for name, dtype, shape in FIELDS
        ],
    }


def check_layout(theirs):
    """Refuses a worker whose record version or layout differs from this end's."""
    if theirs.get("version") != VERSION:
        raise VersionError(f"worker sends record version {theirs.get('version')}, this end knows {VERSION}")
    if theirs != layout():
        raise VersionError(f"record version {VERSION} but the layouts differ: worker {theirs}, here {layout()}")
