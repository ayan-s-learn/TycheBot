import os
import struct
import subprocess

import numpy as np
import pytest

from tyche.obs import record as R
from tyche.obs.tensor import N_TOKENS, Tensorizer
from tyche.transport import record as record_v1
from tyche.transport.workers import ACTIONS, HEADER, MAGIC, MAIN, ROOT, Worker, WorkerError, Workers, random_actions, stack

OBS_MAIN = ROOT / "worker" / "obs" / "main.ts"
POOL = ROOT / "data" / "pool" / "v1" / "teams.jsonl"
LIBRARY = ROOT / "data" / "priors" / "v0" / "species_sets.json"
EXTRA = {"library": str(LIBRARY)}
CONFIG = {"battles": 4, "seed": "obs-test", "pool": str(POOL), "turnCap": 300, **EXTRA}
# The stand-in's batch keys (tasks/T07-mps-throughput/tokens/net.py, obs).
STAND_IN = {"field", "own_ids", "own_num", "opp_ids", "opp_num", "move_ids", "move_num", "own_mnum", "opp_mnum",
            "event_ids", "event_num", "present", "action_mask"}


def workers(n, **kw):
    return Workers(n, pool=POOL, main=OBS_MAIN, record=R, extra=EXTRA, **kw)


@pytest.fixture(scope="module")
def played():
    """Records from real version 2 games, played at random through the transport, and the hello."""
    rng = np.random.default_rng(0)
    out, games = [], 0
    with workers(2, battles=4, seed="obs-test") as ws:
        assert ws.hello["layout"] == R.layout()
        while games < 6:
            for b in ws.recv():
                assert b.records.dtype == R.RECORD
                out.append(b.records.copy())
                games += len(b.ended)
                ws.send(b.worker, random_actions(b.records["mask"], rng))
        stats = ws.stop()
        hello = ws.hello
    assert sum(s["counts"]["invalid"] for s in stats) == 0
    assert sum(s["counts"]["noPrior"] for s in stats) == 0
    return np.concatenate(out), hello


def test_round_trip(played):
    r, hello = played
    assert len(r) > 500
    assert set(np.unique(r["side"])) == {0, 1}
    assert (r["mask"].sum(1) >= 1).all()
    assert ((r["hp"] >= 0) & (r["hp"] <= 1)).all()
    assert np.isfinite(r["calcs"]).all() and np.isfinite(r["eventHp"]).all()
    assert hello["vocab"]["hash"] and hello["layout"]["version"] == 2
    x = stack([type("B", (), {"records": r, "worker": 0})()])
    assert x["calcs"].shape == (len(r), 2, 6, 4, 6)


def test_python_refuses_another_version():
    theirs = R.layout()
    with pytest.raises(R.VersionError):
        R.check_layout({**theirs, "version": 1})
    with pytest.raises(R.VersionError):
        R.check_layout({**theirs, "codes": {**theirs["codes"], "volatiles": theirs["codes"]["volatiles"][:-1]}})
    # A version 1 worker, read as version 2, and the reverse.
    with pytest.raises(R.VersionError):
        Worker(0, {**CONFIG, "echo": 0}, main=MAIN, record=R)
    with pytest.raises(R.VersionError):
        Worker(0, CONFIG, main=OBS_MAIN, record=record_v1)


def test_node_refuses_another_version():
    w = Worker(0, CONFIG, main=OBS_MAIN, record=R, stderr=subprocess.PIPE)
    w.recv_batch()
    payload = struct.pack("<II", 0, 0)
    os.write(w._w, HEADER.pack(MAGIC, 1, ACTIONS, len(payload)) + payload)
    with pytest.raises(WorkerError):
        w.recv()
    assert w.proc.returncode != 0
    assert "record version 1, but this worker knows 2" in w.proc.stderr.read().decode()
    w.close()


def test_tensors_on_real_records(played):
    r, hello = played
    t = Tensorizer(hello["vocab"]["hash"])
    x = t(r)
    w = t.widths()
    b = len(r)
    assert STAND_IN <= set(x)
    shapes = {
        "field": (b, 1, w["FIELD_F"]), "own_ids": (b, 6, 7), "opp_ids": (b, 6, 7), "own_num": (b, 6, w["MON_F"]),
        "opp_num": (b, 6, w["MON_F"]), "own_mnum": (b, 6, 4, w["MOVE_F"]), "opp_mnum": (b, 6, 4, w["MOVE_F"]),
        "move_ids": (b, 4), "move_num": (b, 4, w["MOVE_F"]), "event_ids": (b, 16, 3), "event_xids": (b, 16, 2),
        "event_num": (b, 16, w["EVENT_F"]), "present": (b, N_TOKENS), "action_mask": (b, 18),
    }
    for k, s in shapes.items():
        assert x[k].shape == s, k
    for k in ("own_ids", "opp_ids", "move_ids", "event_ids", "event_xids"):
        assert x[k].dtype == np.int64, k
    for k in ("field", "own_num", "opp_num", "own_mnum", "opp_mnum", "move_num", "event_num"):
        assert x[k].dtype == np.float32 and np.isfinite(x[k]).all(), k
    # Ids within their vocabs: species, item, ability, then moves.
    for side in ("own_ids", "opp_ids"):
        ids = x[side]
        for col, size in [(0, w["N_SPECIES"]), (1, w["N_ITEMS"]), (2, w["N_ABILITIES"])]:
            assert (ids[..., col] >= 0).all() and (ids[..., col] < size).all(), (side, col)
        assert (ids[..., 3:] < w["N_MOVES"]).all()
    assert (x["event_ids"][..., 0] < w["EVENT_TYPES"]).all() and (x["event_ids"][..., 1] < w["N_SPECIES"]).all()
    assert (x["event_ids"][..., 2] < w["N_MOVES"]).all() and (x["event_xids"][..., 0] < w["N_ITEMS"]).all()
    # The mask, the active's moves, and which tokens are present.
    assert (x["action_mask"] == (r["mask"] == 1)).all()
    assert (x["move_ids"] == r["moves"][:, 0]).all()
    assert x["present"][:, 0].all()
    assert (x["present"][:, 1:13] == ((r["species"] != 0) & (r["fainted"] == 0))).all()
    assert (x["present"][:, 17:] == (r["events"][..., 0] != 0)).all()
    # Calcs: own mon i's move j against opposing k is own_num[i, 6j + k], and own_mnum[i, j, -6 + k].
    assert (x["own_num"][:, :, :24] == r["calcs"][:, 0].reshape(b, 6, 24)).all()
    assert (x["own_mnum"][..., -6:] == r["calcs"][:, 0]).all()
    assert (x["opp_mnum"][..., -6:] == r["calcs"][:, 1]).all()
    # Opposing mons' unrevealed items show as such; own mons never.
    assert x["own_num"][..., -4].sum() == 0 and x["opp_num"][..., -4].sum() > 0


def test_tensors_are_a_pure_function_of_the_record(played):
    r, hello = played
    t = Tensorizer(hello["vocab"]["hash"])
    before = r.tobytes()
    a = t(r)
    twin = np.frombuffer(bytearray(r.tobytes()), R.RECORD)  # bit-identical records in another buffer
    b = Tensorizer(hello["vocab"]["hash"])(twin)
    c = t(r[::-1])  # order doesn't leak between records
    assert r.tobytes() == before
    for k in a:
        assert a[k].dtype == b[k].dtype and a[k].tobytes() == b[k].tobytes(), k
        assert a[k][::-1].tobytes() == c[k].tobytes(), k
    with pytest.raises(FileNotFoundError):
        Tensorizer("0" * 16)
