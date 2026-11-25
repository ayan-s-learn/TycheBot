"""Throughput of the stand-in net: MPS inference and PPO training in fp32 and under fp16/bf16 autocast,
and CPU inference at a fixed thread count. One process is one run; it appends one JSON line per configuration.

Usage: uv run python bench.py <out.jsonl> [mps|cpu|all] [seconds=2]
"""

import json
import os
import platform
import subprocess
import sys
import time

import torch

from net import DTYPES, SIZES, Trainer, autocast_ctx, make, obs, rollout, to

MPS_INFER_BATCHES = (16, 64, 256, 1024)
TRAIN_BATCHES = (256, 512, 1024)  # 9M fp32 at 2048 pushed this 36 GB machine into swap
CPU_THREADS = (1, 2, 4)
CPU_BATCHES = (1, 8, 32, 64)
WARMUP = 3  # the first call on a new shape builds MPS graphs


def load():
    return subprocess.run(["sysctl", "-n", "vm.loadavg"], capture_output=True, text=True).stdout.strip()


def timed(fn, seconds, sync):
    for _ in range(WARMUP):
        fn()
    sync()
    n, t0 = 0, time.perf_counter()
    while True:
        fn()
        n += 1
        if n >= 5:
            sync()
            dt = time.perf_counter() - t0
            if dt >= seconds:
                return n, dt


def mps_infer(size, dtype, b, seconds, gen):
    net = make(size, "mps").eval()
    batches = [obs(SIZES[size], b, gen) for _ in range(4)]
    i = 0

    def step():
        nonlocal i
        x = to(batches[i % 4], "mps")
        i += 1
        with torch.inference_mode(), autocast_ctx("mps", DTYPES[dtype]):
            logits, value = net(x, aux=False)
        logits.cpu(), value.cpu()  # back to the env: also waits for the GPU

    return timed(step, seconds, torch.mps.synchronize)


def mps_train(size, dtype, b, seconds, gen):
    net = make(size, "mps")
    tr = Trainer(net, "mps", dtype)
    batches = [to(rollout(SIZES[size], b, gen), "mps") for _ in range(2)]
    i = 0

    def step():
        nonlocal i
        tr.step(batches[i % 2])
        i += 1

    out = timed(step, seconds, torch.mps.synchronize)
    del tr, net, batches
    torch.mps.empty_cache()
    return out


def cpu_infer(size, threads, b, seconds, gen):
    torch.set_num_threads(threads)
    net = make(size, "cpu").eval()
    batches = [obs(SIZES[size], b, gen) for _ in range(4)]
    i = 0

    def step():
        nonlocal i
        with torch.inference_mode():
            net(batches[i % 4], aux=False)
        i += 1

    return timed(step, seconds, lambda: None)


def main():
    out = sys.argv[1]
    part = sys.argv[2] if len(sys.argv) > 2 else "all"
    seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
    assert "PYTORCH_ENABLE_MPS_FALLBACK" not in os.environ, "run with CPU fallback disabled"
    torch.set_num_interop_threads(1)
    gen = torch.Generator().manual_seed(0)
    run = time.strftime("%Y-%m-%dT%H:%M:%S")
    meta = {"run": run, "torch": torch.__version__, "python": platform.python_version()}
    configs = []
    if part in ("mps", "all"):
        for size in SIZES:
            for dtype in DTYPES:
                configs += [("mps_infer", size, dtype, b, None) for b in MPS_INFER_BATCHES]
                configs += [("mps_train", size, dtype, b, None) for b in TRAIN_BATCHES]
    if part in ("cpu", "all"):
        for size in SIZES:
            for threads in CPU_THREADS:
                configs += [("cpu_infer", size, "fp32", b, threads) for b in CPU_BATCHES]
    with open(out, "a") as f:
        for kind, size, dtype, b, threads in configs:
            l0 = load()
            if kind == "mps_infer":
                n, dt = mps_infer(size, dtype, b, seconds, gen)
            elif kind == "mps_train":
                n, dt = mps_train(size, dtype, b, seconds, gen)
            else:
                n, dt = cpu_infer(size, threads, b, seconds, gen)
            rec = {**meta, "kind": kind, "size": size, "dtype": dtype, "batch": b, "threads": threads,
                   "iters": n, "secs": round(dt, 4), "samples_per_s": round(n * b / dt, 1),
                   "load_before": l0, "load_after": load()}
            f.write(json.dumps(rec) + "\n")
            f.flush()
            print(kind, size, dtype, b, threads, rec["samples_per_s"], flush=True)


if __name__ == "__main__":
    main()
