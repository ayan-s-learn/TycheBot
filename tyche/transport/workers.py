"""The Python end of the transport: starts Node env workers (worker/skeleton/main.ts), receives their batches of
records, and sends one action per record back.

Each worker gets two pipes. Frames are length-prefixed: magic u32, version u16, type u16, payload length u32, then
the payload, all little-endian (worker/skeleton/frames.ts). A worker sends a hello, then a batch per step, and blocks
until it gets that batch's actions or a stop.
"""

import json
import os
import selectors
import struct
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from tyche.transport.record import ENDED, RECORD, VERSION, VersionError, check_layout

ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "worker" / "skeleton" / "main.ts"
POOL = ROOT / "data" / "pool" / "v0" / "teams.jsonl"

MAGIC = 0x54594348
HEADER = struct.Struct("<IHHI")
HELLO, BATCH, STATS, ACTIONS, STOP = 1, 2, 3, 16, 17
RESET_STATS = 1


@dataclass
class Batch:
    worker: int
    records: np.ndarray  # RECORD, one per open decision
    ended: np.ndarray  # ENDED, games that ended in the worker's last step


class WorkerError(RuntimeError):
    pass


def _read_exact(fd, n):
    buf = bytearray(n)
    view = memoryview(buf)
    got = 0
    while got < n:
        k = os.readinto(fd, view[got:])
        if k == 0:
            raise EOFError
        got += k
    return buf


def _write_all(fd, data):
    view = memoryview(data)
    while view:
        view = view[os.write(fd, view) :]


class Worker:
    def __init__(self, index, config, node="node", stderr=None):
        self.index = index
        self.proc = None
        to_node_r, self._w = os.pipe()
        self._r, from_node_w = os.pipe()
        config = {**config, "worker": index, "fds": [to_node_r, from_node_w]}
        try:
            try:
                self.proc = subprocess.Popen(
                    [node, str(MAIN), json.dumps(config)], cwd=ROOT, pass_fds=(to_node_r, from_node_w), stderr=stderr
                )
            finally:
                # Closed before reading, so a worker that dies before its hello gives EOF rather than a hang.
                os.close(to_node_r)
                os.close(from_node_w)
            self.pending = False  # holds a batch not yet answered
            kind, payload = self.recv()
            if kind != HELLO:
                raise WorkerError(f"worker {index}: expected hello, got frame type {kind}")
            self.hello = json.loads(payload)
            check_layout(self.hello["layout"])
        except BaseException:
            self.close()  # a refused worker isn't in Workers.workers, so close it here
            raise

    def recv(self):
        try:
            header = _read_exact(self._r, HEADER.size)
            magic, version, kind, length = HEADER.unpack(header)
            payload = _read_exact(self._r, length)
        except EOFError:
            raise WorkerError(f"worker {self.index} closed its pipe (exit code {self.proc.wait()})") from None
        if magic != MAGIC:
            raise WorkerError(f"worker {self.index}: bad frame magic {magic:x}")
        if version != VERSION:
            raise VersionError(f"worker {self.index} sends record version {version}, this end knows {VERSION}")
        return kind, payload

    def recv_batch(self):
        kind, payload = self.recv()
        if kind != BATCH:
            raise WorkerError(f"worker {self.index}: expected a batch, got frame type {kind}")
        n_records, n_ended = struct.unpack_from("<II", payload)
        ended = np.frombuffer(payload, ENDED, n_ended, 8)
        records = np.frombuffer(payload, RECORD, n_records, 8 + ENDED.itemsize * n_ended)
        self.pending = True
        return Batch(self.index, records, ended)

    def send(self, kind, payload=b""):
        _write_all(self._w, HEADER.pack(MAGIC, VERSION, kind, len(payload)) + payload)

    def send_actions(self, actions, reset_stats=False):
        actions = np.ascontiguousarray(actions, dtype="<i4")
        self.send(ACTIONS, struct.pack("<II", RESET_STATS if reset_stats else 0, len(actions)) + actions.tobytes())
        self.pending = False

    def stop(self):
        """Stops the worker and returns its stats. It must be waiting for a reply."""
        self.send(STOP)
        kind, payload = self.recv()
        if kind != STATS:
            raise WorkerError(f"worker {self.index}: expected stats, got frame type {kind}")
        self.proc.wait()
        self.close()
        return json.loads(payload)

    def close(self):
        if self.proc is not None and self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait()
        for fd in (self._r, self._w):
            try:
                os.close(fd)
            except OSError:
                pass


class Workers:
    """Node env workers. Each holds `battles` battles and sends a batch per step.

    `seed` names the run: worker w's game g has its seeds and teams from (seed, w, g). `echo` > 0 runs
    transport-only workers that send that many blank records per batch."""

    def __init__(self, n, *, battles=32, seed=0, pool=POOL, turn_cap=300, echo=0, node="node"):
        config = {"battles": battles, "seed": seed, "pool": str(pool), "turnCap": turn_cap, "echo": echo}
        self.workers = []
        try:
            for i in range(n):
                self.workers.append(Worker(i, config, node))
        except BaseException:
            self.close()
            raise
        self.hello = self.workers[0].hello
        want = (ROOT / ".nvmrc").read_text().strip()
        if self.hello["node"].lstrip("v").split(".")[0] != want:
            self.close()
            raise WorkerError(f"workers run Node {self.hello['node']}, .nvmrc wants {want}: run nvm use first")
        self._sel = selectors.DefaultSelector()
        for w in self.workers:
            self._sel.register(w._r, selectors.EVENT_READ, w)

    def recv(self, timeout=None):
        """The batches of every worker that has one ready, waiting for at least one."""
        out = []
        for key, _ in self._sel.select(timeout):
            w = key.data
            if not w.pending:
                out.append(w.recv_batch())
        return out

    def gather(self):
        """One batch from every worker, in worker order. Every worker must have been answered."""
        return [w.recv_batch() for w in self.workers]

    def send(self, worker, actions, reset_stats=False):
        self.workers[worker].send_actions(actions, reset_stats)

    def stop(self):
        """Stops every worker and returns their stats."""
        for w in self.workers:
            if not w.pending:
                w.recv_batch()
        return [w.stop() for w in self.workers]

    def close(self):
        for w in self.workers:
            w.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def stack(batches):
    """The records of several batches as one array of each field, plus each record's worker index."""
    records = np.concatenate([b.records for b in batches])
    out = {name: records[name] for name in RECORD.names}
    out["worker"] = np.concatenate([np.full(len(b.records), b.worker, np.int32) for b in batches])
    return out


def random_actions(mask, rng):
    """A uniformly random legal action per row of a 0/1 mask."""
    return (rng.random(mask.shape) * mask).argmax(1)
