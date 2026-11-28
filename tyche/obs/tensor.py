"""Record version 2 as the net's inputs: T07's 33-token layout (tasks/T07-mps-throughput/tokens/net.py, `5M@33enc`),
with the batch dict's keys and shapes, plus `event_xids`. A pure function of the records and the static dex tables
(tyche/obs/dex/<vocab hash>.json), so bit-identical records give bit-identical tensors. docs/areas/env-workers.md
documents each key's features.

Tokens, in order: the field (1), own mons (6, the request's order), opposing mons (6, the active first), the own
active's moves (4), the last events (16, newest first)."""

import json
from pathlib import Path

import numpy as np

from tyche.obs import record as R

DEX = Path(__file__).resolve().parent / "dex"
N_TOKENS = 1 + 6 + 6 + 4 + R.N_EVENTS
EVENT_TYPES = len(R.EVENTS) + 1  # type 0: no event

# Scales: each feature divided so typical values sit in about [0, 1] or [-1, 1].
MOVE_SCALE = {"basePower": 150, "priority": 5, "pp": 40, "hits": 5, "critRatio": 3}
DURATION = 8
FIELD_F = len(R.WEATHERS) + len(R.TERRAINS) + len(R.FIELD_NUM) + 2 * len(R.SIDE_NUM) + 1 + 3 + 2
EVENT_F = 3 + 1 + 1 + 1 + 1 + len(R.ID_KIND) + 1


def _onehot(codes, n):
    """codes (any shape, ints in [0, n)) as one-hot vectors of width n."""
    return np.eye(n, dtype=np.float32)[codes]


class Tensorizer:
    """Turns RECORD arrays into the net's batch dict. `vocab_hash` is the worker hello's `vocab.hash`."""

    def __init__(self, vocab_hash):
        path = DEX / f"{vocab_hash}.json"
        if not path.exists():
            raise FileNotFoundError(f"no static dex tables for vocab {vocab_hash}: run node worker/obs/dex.ts")
        dex = json.loads(path.read_text())
        self.vocab = dex["vocab"]
        n_types = self.vocab["types"]
        species = np.array(dex["species"]["rows"], np.float32)
        self.species_stats = species[:, :6] / 255
        moves = np.array(dex["moves"]["rows"], np.float32)
        cols = []
        for i, c in enumerate(dex["moves"]["columns"]):
            v = moves[:, i]
            if c == "type":
                cols.append(_onehot(v.astype(np.int64), n_types))
            elif c == "category":
                cols.append(_onehot(v.astype(np.int64), 3))
            elif c.startswith(("self:", "target:")):
                cols.append((v / 2)[:, None])
            else:
                cols.append((v / MOVE_SCALE.get(c, 1))[:, None])
        self.move_static = np.concatenate(cols, 1)
        self.move_static[:2] = 0  # empty slot and outside the vocab
        self.n_types = n_types
        self.MOVE_F = self.move_static.shape[1] + len(R.MOVE_NUM) + 1 + 6
        self.MON_F = 24 + 3 + 6 + 7 + 6 + 6 + n_types + 1 + 2 + len(R.VOLATILES) + len(R.MON_FLAGS) + 2 + 1 + 1
        self.FIELD_F, self.EVENT_F = FIELD_F, EVENT_F

    def widths(self):
        return {"FIELD_F": self.FIELD_F, "MON_F": self.MON_F, "MOVE_F": self.MOVE_F, "EVENT_F": self.EVENT_F,
                "N_TOKENS": N_TOKENS, "EVENT_TYPES": EVENT_TYPES, **{f"N_{k.upper()}": v for k, v in self.vocab.items() if k != "hash"}}

    def __call__(self, r):
        b = len(r)
        side = {n: i for i, n in enumerate(R.SIDE_NUM)}
        present_mon = (r["species"] != 0) & (r["fainted"] == 0)

        # Field.
        sn = r["sideNum"].copy()
        sn[..., side["spikes"]] /= 3
        sn[..., side["toxicspikes"]] /= 2
        sn[..., [i for n, i in side.items() if n.endswith(("Min", "Max"))]] /= DURATION
        fnum = r["fieldNum"].copy()
        fnum[:, [i for i, n in enumerate(R.FIELD_NUM) if n.endswith(("Min", "Max"))]] /= DURATION
        field = np.concatenate([
            _onehot(r["weather"], len(R.WEATHERS) + 1)[:, 1:], _onehot(r["terrain"], len(R.TERRAINS) + 1)[:, 1:], fnum,
            sn.reshape(b, -1), (r["turn"] / 100)[:, None], _onehot(r["kind"], 3),
            r["fainted"][:, :6].sum(1, keepdims=True) / 6, r["fainted"][:, 6:].sum(1, keepdims=True) / 6,
        ], 1, dtype=np.float32)[:, None]

        # Mons: 24 calcs (move j against each of the other side's 6, j-major), then the mon's features.
        calcs = r["calcs"]  # [b, 2, 6, 4, 6]
        types = _onehot(r["types"], self.n_types).sum(2)
        types[..., 0] = 0
        stats = r["stats"] / 500
        mon = np.concatenate([
            r["hp"][..., None], r["fainted"][..., None], r["active"][..., None],
            _onehot(r["status"], 7)[..., 1:], r["boosts"] / 6, stats, self.species_stats[r["species"]], np.minimum(types, 1),
            (r["level"] / 100)[..., None], r["statusTurns"] / np.array([3, 16], np.float32), r["volatiles"], r["monFlags"],
            (r["item"] == R.UNREVEALED)[..., None], (r["item"] == R.NONE)[..., None], (r["ability"] == R.UNREVEALED)[..., None],
            (r["species"] != 0)[..., None],
        ], -1, dtype=np.float32)
        own_num = np.concatenate([calcs[:, 0].reshape(b, 6, 24), mon[:, :6]], -1)
        opp_num = np.concatenate([calcs[:, 1].reshape(b, 6, 24), mon[:, 6:]], -1)
        ids = np.concatenate([r["species"][..., None], r["item"][..., None], r["ability"][..., None], r["moves"]], -1).astype(np.int64)

        # Moves: static dex features, per-turn state, and the move's 6 calcs.
        mnum = np.concatenate([
            self.move_static[r["moves"]], r["moveNum"], (r["moves"] != 0)[..., None],
            np.concatenate([calcs[:, 0], calcs[:, 1]], 1),
        ], -1, dtype=np.float32)
        own_mnum, opp_mnum = mnum[:, :6], mnum[:, 6:]

        # Events, newest first. The species is the event's own id, or its mon's.
        ev = r["events"]
        etype, eside, eslot, ekind, eid, eturn = (ev[..., i] for i in range(6))
        has_slot = eslot >= 0
        slot_species = np.take_along_axis(r["species"], np.where(has_slot, eslot, 0), 1) * has_slot
        slot_active = np.take_along_axis(r["active"], np.where(has_slot, eslot, 0), 1) * has_slot
        kind = R.ID_KIND
        hp_type = np.isin(etype, [R.EVENTS.index(t) + 1 for t in ("damage", "heal", "sethp")])
        boost_type = np.isin(etype, [R.EVENTS.index(t) + 1 for t in ("boost", "unboost")])
        event_ids = np.stack([
            etype, np.where(ekind == kind["species"], eid, slot_species), np.where(ekind == kind["move"], eid, 0),
        ], -1).astype(np.int64)
        event_xids = np.stack([np.where(ekind == kind["item"], eid, 0), np.where(ekind == kind["ability"], eid, 0)], -1).astype(np.int64)
        present_event = etype != 0
        event_num = np.concatenate([
            _onehot(eside, 3), (r["eventHp"] * hp_type)[..., None], (r["eventHp"] * boost_type / 6)[..., None],
            ((r["turn"][:, None] - eturn) / 10)[..., None], np.broadcast_to(np.arange(R.N_EVENTS) / R.N_EVENTS, (b, R.N_EVENTS))[..., None],
            _onehot(ekind, len(kind)), slot_active[..., None],
        ], -1, dtype=np.float32) * present_event[..., None]

        own_ids = ids[:, :6]
        present = np.concatenate([np.ones((b, 1), bool), present_mon, own_ids[:, 0, 3:] != 0, present_event], 1)
        return {
            "field": field,
            "own_ids": own_ids, "own_num": own_num, "own_mnum": own_mnum,
            "opp_ids": ids[:, 6:], "opp_num": opp_num, "opp_mnum": opp_mnum,
            "move_ids": own_ids[:, 0, 3:].copy(), "move_num": own_mnum[:, 0].copy(),
            "event_ids": event_ids, "event_xids": event_xids, "event_num": event_num,
            "present": present, "action_mask": r["mask"] == 1,
        }


def as_torch(batch, device="cpu"):
    """The tensorizer's output as torch tensors."""
    import torch

    return {k: torch.from_numpy(np.ascontiguousarray(v)).to(device) for k, v in batch.items()}
