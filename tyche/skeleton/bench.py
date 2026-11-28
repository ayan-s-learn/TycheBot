"""Env decisions/s end to end: Node workers playing battles with tracking and the 288 calcs, and this process answering
every batch with random legal actions, so no learner bounds the rate.

Each run starts fresh workers, warms up, then opens a window: each worker resets its counters on its next actions
frame, and the run stops after `seconds`. It writes one JSON line per run:
- decisionsPerSecond: the sum over workers of decisions over that worker's window;
- perDecision: one process's ms per decision by phase (median over workers): sim, track, calc, record, transfer
  (writing the batch and waiting for the actions, which includes this process's time), and wall (window over decisions);
- cpuShare: each worker's CPU time over its window; otherCores: the rest of the machine's busy cores during the
  window, from iostat, less the workers' and this process's CPU;
- the load averages before and after, and this process's scheduling priority.
A run is flagged if this process runs at background priority (PRI 4 in ps), where the same in-process run took ~5x
as long on 2026-11-26, or if the median worker playing battles got under 0.9 of a core (echo workers mostly wait).
With --echo N the workers play no battles and send N blank records per batch: the transport alone.

Usage: python -m tyche.skeleton.bench --out <file.jsonl> [--workers 12] [--battles 32] [--seconds 30] [--warmup 10]
       [--runs 3] [--echo N] [--pool data/pool/<ver>/teams.jsonl]
Take timings under the timing lock (AGENTS.md, Conventions: Timed runs).
"""

import argparse
import json
import os
import statistics
import subprocess
import time

import numpy as np

from tyche.transport.workers import POOL, ROOT, Workers, random_actions

CORES = os.cpu_count()


def loadavg():
    return subprocess.run(["sysctl", "-n", "vm.loadavg"], capture_output=True, text=True).stdout.strip()


def priority():
    return int(subprocess.run(["ps", "-o", "pri=", "-p", str(os.getpid())], capture_output=True, text=True).stdout)


def run(args, index):
    rng = np.random.default_rng(index)
    load0 = loadavg()
    pri = priority()
    with Workers(args.workers, battles=args.battles, seed=f"bench-{index}", pool=args.pool, echo=args.echo) as ws:
        start = time.perf_counter()
        opened = set()
        window0 = None
        batches = records = 0
        py = 0.0
        while True:
            for b in ws.recv():
                t = time.perf_counter()
                reset = t - start >= args.warmup and b.worker not in opened
                if reset:
                    if not opened:
                        # The rest of the machine's load over the window: iostat's second sample.
                        iostat = subprocess.Popen(["iostat", "-n0", "-C", "-w", str(args.seconds), "-c", "2"],
                                                  stdout=subprocess.PIPE, text=True)
                        cpu0 = time.process_time()
                        window0 = t
                    opened.add(b.worker)
                ws.send(b.worker, random_actions(b.records["mask"], rng), reset_stats=reset)
                if b.worker in opened:
                    batches += 1
                    records += len(b.records)
                    py += time.perf_counter() - t
            if window0 is not None and len(opened) == args.workers and time.perf_counter() - window0 >= args.seconds:
                break
        py_cpu = (time.process_time() - cpu0) / (time.perf_counter() - window0)
        stats = ws.stop()
    load1 = loadavg()
    us, sy = (int(x) for x in iostat.communicate()[0].strip().splitlines()[-1].split()[:2])

    per = {k: [] for k in ("sim", "track", "calc", "record", "transfer", "wall")}
    share = []
    for s in stats:
        d = s["counts"]["decisions"]
        for k in ("sim", "track", "calc", "record"):
            per[k].append(s.get("times", {}).get(k, 0) / d)
        per["transfer"].append(s["transfer"] / d)
        per["wall"].append(s["windowMs"] / d)
        share.append(s["cpuMs"] / s["windowMs"])
    counts = {k: sum(s["counts"].get(k, 0) for s in stats) for k in stats[0]["counts"]}
    rate = sum(s["counts"]["decisions"] / s["windowMs"] * 1000 for s in stats)
    return {
        "run": index, "workers": args.workers, "battles": args.battles, "echo": args.echo, "seconds": args.seconds, "pool": args.pool,
        "decisionsPerSecond": rate,
        "perDecision": {k: statistics.median(v) for k, v in per.items()},
        "cpuShare": {"min": min(share), "median": statistics.median(share)},
        "otherCores": (us + sy) / 100 * CORES - sum(share) - py_cpu,
        "python": {"msPerBatch": py / batches * 1000, "recordsPerBatch": records / batches, "cpuShare": py_cpu},
        "counts": counts,
        "loadavg": [load0, load1],
        "priority": pri,
        "flagged": pri == 4 or (not args.echo and statistics.median(share) < 0.9),
        "node": ws.hello["node"], "pin": ws.hello["pin"],
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--battles", type=int, default=32)
    p.add_argument("--seconds", type=int, default=30)
    p.add_argument("--warmup", type=int, default=10)
    p.add_argument("--runs", type=int, default=3)
    p.add_argument("--echo", type=int, default=0)
    p.add_argument("--pool", default=str(POOL.relative_to(ROOT)), help="a teams.jsonl, relative to the repo root; its training teams are played")
    args = p.parse_args()
    results = []
    for i in range(args.runs):
        r = run(args, i)
        results.append(r)
        with open(args.out, "a") as f:
            f.write(json.dumps(r) + "\n")
        pd = r["perDecision"]
        print(f"run {i}: {r['decisionsPerSecond']:,.0f} decisions/s; per decision ms: "
              + ", ".join(f"{k} {v:.3f}" for k, v in pd.items())
              + f"; cpu share {r['cpuShare']['median']:.2f} (min {r['cpuShare']['min']:.2f});"
              f" other cores {r['otherCores']:.1f}; load {r['loadavg'][0]} -> {r['loadavg'][1]}"
              + (f"; FLAGGED (priority {r['priority']})" if r["flagged"] else ""), flush=True)
    rates = [r["decisionsPerSecond"] for r in results]
    med = statistics.median(rates)
    print(f"median {med:,.0f} decisions/s; runs within {max(abs(x / med - 1) for x in rates):.1%} of it")


if __name__ == "__main__":
    main()
