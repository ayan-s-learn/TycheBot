"""Checks the games/day model's two assumptions on MPS: that inference and training sharing the GPU cost the sum
of their separate times, and that a CPU busy with env processes doesn't slow the learner.

Each scenario starts its workers together (separate processes, as in D10's asynchronous setup) and counts the
samples each finishes inside one shared window. "burn" is 13 processes spinning in Python, standing in for env
workers on the other cores.

Usage: uv run python contend.py <out.jsonl> [size=5M] [dtype=bf16] [seconds=20] [runs=3]
"""

import json
import subprocess
import sys
import time

SCENARIOS = (("train",), ("infer",), ("train", "infer"), ("train", "burn"), ("train", "infer", "burn"))
BURNERS = 13
INFER_BATCH, TRAIN_BATCH = 256, 1024
WARMUP_S = 8


def worker(role, size, dtype, start, end):
    if role == "burn":
        while time.time() < end:
            pass
        return
    import torch

    from net import DTYPES, SIZES, Trainer, autocast_ctx, make, obs, rollout, to

    gen = torch.Generator().manual_seed(0)
    if role == "train":
        tr = Trainer(make(size, "mps"), "mps", dtype)
        batches = [to(rollout(SIZES[size], TRAIN_BATCH, gen), "mps") for _ in range(2)]
        b = TRAIN_BATCH

        def step(i):
            tr.step(batches[i % 2])
            torch.mps.synchronize()
    else:
        net = make(size, "mps").eval()
        batches = [obs(SIZES[size], INFER_BATCH, gen) for _ in range(4)]
        b = INFER_BATCH

        def step(i):
            with torch.inference_mode(), autocast_ctx("mps", DTYPES[dtype]):
                logits, value = net(to(batches[i % 4], "mps"), aux=False)
            logits.cpu(), value.cpu()

    i, t0, n, t_last = 0, None, 0, None
    while True:
        step(i)
        i += 1
        now = time.time()
        if now >= end:
            break
        if now >= start:
            if t0 is None:
                t0 = now  # first step finished inside the window
            else:
                n, t_last = n + 1, now
    print(json.dumps({"role": role, "samples_per_s": n * b / (t_last - t0) if n else 0.0}))


def main():
    out = sys.argv[1]
    size = sys.argv[2] if len(sys.argv) > 2 else "5M"
    dtype = sys.argv[3] if len(sys.argv) > 3 else "bf16"
    seconds = float(sys.argv[4]) if len(sys.argv) > 4 else 20
    runs = int(sys.argv[5]) if len(sys.argv) > 5 else 3
    with open(out, "a") as f:
        for run in range(runs):
            for sc in SCENARIOS:
                start = time.time() + WARMUP_S
                end = start + seconds
                roles = [r for r in sc if r != "burn"] + (["burn"] * BURNERS if "burn" in sc else [])
                procs = [subprocess.Popen([sys.executable, __file__, "--worker", r, size, dtype, str(start), str(end)],
                                          stdout=subprocess.PIPE, text=True) for r in roles]
                res = {}
                for p in procs:
                    o, _ = p.communicate()
                    assert p.returncode == 0
                    if o.strip():
                        r = json.loads(o)
                        res[r["role"]] = r["samples_per_s"]
                rec = {"run": run, "scenario": "+".join(sc), "size": size, "dtype": dtype, "seconds": seconds,
                       "load": subprocess.run(["sysctl", "-n", "vm.loadavg"], capture_output=True, text=True).stdout.strip(),
                       **res}
                f.write(json.dumps(rec) + "\n")
                f.flush()
                print(json.dumps(rec), flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "--worker":
        worker(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]), float(sys.argv[6]))
    else:
        main()
