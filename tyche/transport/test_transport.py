import os
import struct
import subprocess

import numpy as np
import pytest

from tyche.transport import record
from tyche.transport.record import KIND_PREVIEW, KIND_SWITCH, RECORD, VersionError, check_layout, layout
from tyche.transport.workers import ACTIONS, HEADER, MAGIC, POOL, Worker, WorkerError, Workers, random_actions, stack

CONFIG = {"battles": 4, "seed": "transport-test", "pool": str(POOL), "turnCap": 300, "echo": 0}


def test_round_trip():
    rng = np.random.default_rng(0)
    games, answered = 0, 0
    with Workers(2, battles=4, seed="transport-test") as ws:
        assert ws.hello["layout"] == layout()
        while games < 6:
            for b in ws.recv():
                r = b.records
                assert r.dtype == RECORD
                assert set(np.unique(r["side"])) <= {0, 1}
                assert set(np.unique(r["kind"])) <= {KIND_PREVIEW, 1, KIND_SWITCH}
                assert (r["mask"].sum(1) >= 1).all()
                assert ((r["hp"] >= 0) & (r["hp"] <= 1)).all()
                assert np.isfinite(r["calcs"]).all()
                assert set(np.unique(b.ended["winner"])) <= {-1, 0, 1}
                games += len(b.ended)
                answered += len(r)
                ws.send(b.worker, random_actions(r["mask"], rng))
        stats = ws.stop()
    assert len(stats) == 2
    assert sum(s["counts"]["decisions"] for s in stats) == answered
    assert sum(s["counts"]["invalid"] for s in stats) == 0


def test_stack():
    with Workers(2, battles=2, seed="stack-test") as ws:
        batches = ws.gather()
        x = stack(batches)
        assert x["calcs"].shape == (len(x["worker"]), 2, 6, 4, 6)
        assert x["mask"].shape[1:] == (18,)
        assert sorted(set(x["worker"])) == [0, 1]
        ws.stop()


def test_echo():
    with Workers(1, echo=16) as ws:
        for _ in range(3):
            (b,) = ws.gather()
            assert len(b.records) == 16
            ws.send(0, random_actions(b.records["mask"], np.random.default_rng(0)))
        (s,) = ws.stop()
    assert s["frames"] == 4


def test_python_refuses_another_layout():
    theirs = layout()
    check_layout(theirs)
    with pytest.raises(VersionError):
        check_layout({**theirs, "version": record.VERSION + 1})
    with pytest.raises(VersionError):
        check_layout({**theirs, "fields": theirs["fields"][:-1]})


def test_python_refuses_another_frame_version():
    w = Worker.__new__(Worker)
    w.index = 0
    w.record = record
    w._r, write = os.pipe()
    os.write(write, HEADER.pack(MAGIC, record.VERSION + 1, 2, 0))
    with pytest.raises(VersionError):
        w.recv()
    os.close(w._r)
    os.close(write)


def test_node_refuses_another_frame_version():
    w = Worker(0, CONFIG, stderr=subprocess.PIPE)
    w.recv_batch()
    payload = struct.pack("<II", 0, 0)
    os.write(w._w, HEADER.pack(MAGIC, record.VERSION + 1, ACTIONS, len(payload)) + payload)
    with pytest.raises(WorkerError):
        w.recv()
    assert w.proc.returncode != 0
    assert f"record version {record.VERSION + 1}" in w.proc.stderr.read().decode()
    w.close()


def test_refused_worker_is_closed(monkeypatch):
    def refuse(theirs):
        raise VersionError("refused")

    procs = []
    real_popen = subprocess.Popen

    def popen(*args, **kwargs):
        procs.append(real_popen(*args, **kwargs))
        return procs[-1]

    monkeypatch.setattr("tyche.transport.record.check_layout", refuse)
    monkeypatch.setattr("tyche.transport.workers.subprocess.Popen", popen)
    with pytest.raises(VersionError):
        Worker(0, CONFIG)
    assert procs[0].poll() is not None
