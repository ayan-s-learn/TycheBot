"""bf16 MPS: inference at batch 256 and training at minibatches 512/1024, sizes interleaved over 3 rounds."""
import json, sys, torch
import bench
from net import SIZES
sizes = sys.argv[2].split(",")
gen = torch.Generator().manual_seed(0)
with open(sys.argv[1], "a") as f:
    for rnd in range(3):
        for s in sizes:
            for kind, b in (("mps_infer", 256), ("mps_train", 512), ("mps_train", 1024)):
                fn = bench.mps_infer if kind == "mps_infer" else bench.mps_train
                n, dt = fn(s, "bf16", b, 3.0, gen)
                rec = {"round": rnd, "kind": kind, "size": s, "batch": b, "sps": round(n * b / dt, 1), "load": bench.load()}
                f.write(json.dumps(rec) + "\n"); f.flush(); print(rec, flush=True)
