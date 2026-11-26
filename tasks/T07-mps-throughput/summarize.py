"""Median (min-max) samples/s over runs, and the learner's games/day.

Usage:
  uv run python summarize.py <runs.jsonl>[,<more.jsonl>]              tables and games/day
  uv run python summarize.py <runs.jsonl> <rerun.jsonl>                exit 1 unless every rerun median is within 10%
"""

import json
import statistics
import sys
from collections import defaultdict

# Learner model (README, Result: Learner and env).
TRAINED = 0.75  # half of games vs the latest policy (both sides trained), half vs frozen snapshots (one side)
EPOCHS = (2, 3, 4)
INFER_BATCH, TRAIN_BATCH = 256, 1024
CPU_LOAD = 0.93  # contend.py: training alone kept 0.93 of its rate with 13 processes spinning on the CPU
DECISIONS_PER_TURN = 2.29  # T02's random games
GAME_TURNS = {"T02 random games": 48.9, "T04 human, 25 turns": 25, "T04 human, 35 turns": 35}
# Env CPU per decision per process, with MPS inference (README, Env CPU budget).
SIM_MS = 0.28 * 0.230 / 0.168  # T02 at 14 processes, slowed by interleaved calcs as T06 measured
CALC_MS = 0.534  # T06: the 288 set, cached, one process
ENV_PROCS = 12  # 14 cores less one for the learner and one for the inference server


def load(paths):
    groups = defaultdict(list)
    for path in paths.split(","):
        for line in open(path):
            r = json.loads(line)
            groups[(r["kind"], r["size"], r["dtype"], r["batch"], r["threads"])].append(r["samples_per_s"])
    return groups


def med(v):
    return statistics.median(v)


def cell(v):
    return f"{med(v):,.0f} ({min(v):,.0f}–{max(v):,.0f})"


def tables(g):
    sizes = list(dict.fromkeys(k[1] for k in g))
    dtypes = ("fp32", "fp16", "bf16")
    runs = {len(v) for v in g.values()}
    print(f"runs per configuration: {sorted(runs)}\n")
    for kind, title in (("mps_infer", "MPS inference, samples/s"), ("mps_train", "MPS training, samples/s per epoch")):
        print(f"### {title}\n\n| Size | Batch | fp32 | fp16 autocast | bf16 autocast |\n|---|---|---|---|---|")
        for s in sizes:
            for b in sorted({k[3] for k in g if k[0] == kind and k[1] == s}):
                print(f"| {s} | {b} | " + " | ".join(cell(g[(kind, s, d, b, None)]) for d in dtypes) + " |")
        print()
    threads = sorted({k[4] for k in g if k[0] == "cpu_infer"})
    print("### CPU inference (fp32), samples/s\n\n| Size | Batch | "
          + " | ".join(f"{t} thread{'s' * (t > 1)}" for t in threads) + " |\n|---|---|" + "---|" * len(threads))
    for s in sizes:
        for b in sorted({k[3] for k in g if k[0] == "cpu_infer" and k[1] == s}):
            print(f"| {s} | {b} | " + " | ".join(cell(g[("cpu_infer", s, "fp32", b, t)]) for t in threads) + " |")
    print()


def games_per_day(g):
    print(f"### Learner on MPS: inference at batch {INFER_BATCH}, training at minibatch {TRAIN_BATCH}, "
          f"{TRAINED:.0%} of decisions trained, x{CPU_LOAD} for a loaded CPU; env on {ENV_PROCS} processes at "
          f"{SIM_MS + CALC_MS:.2f} ms per decision\n")
    print("| Size | dtype | Epochs | Learner decisions/s | "
          + " | ".join(f"Games/day, {k} ({v * DECISIONS_PER_TURN:.0f} decisions)" for k, v in GAME_TURNS.items())
          + " | Env / learner | Parsing + transfer ms to bound | ... to trip D7's 2x rule |\n|---|---|---|---|"
          + "---|" * (len(GAME_TURNS) + 3))
    sizes = list(dict.fromkeys(k[1] for k in g if k[0] == "mps_train"))
    for s in sizes:
        for d in ("fp32", "bf16"):
            inf = 1e3 / med(g[("mps_infer", s, d, INFER_BATCH, None)])
            tr = 1e3 / med(g[("mps_train", s, d, TRAIN_BATCH, None)])
            for e in EPOCHS:
                rate = CPU_LOAD * 1e3 / (inf + TRAINED * e * tr)
                days = " | ".join(f"{rate * 86400 / (t * DECISIONS_PER_TURN) / 1e6:.2f}M" for t in GAME_TURNS.values())
                env = ENV_PROCS * 1e3 / (SIM_MS + CALC_MS)
                bound = ENV_PROCS * 1e3 / rate - SIM_MS - CALC_MS
                rule = ENV_PROCS * 1e3 / (2 * rate) - SIM_MS - CALC_MS
                print(f"| {s} | {d} | {e} | {rate:,.0f} | {days} | {env / rate:.1f}x | {bound:.1f} | {rule:.1f} |")
    print()


def check(ref, new):
    worst, bad = 0.0, []
    for k, v in new.items():
        if k not in ref:
            continue
        dev = abs(med(v) / med(ref[k]) - 1)
        worst = max(worst, dev)
        if dev > 0.10:
            bad.append((k, f"{dev:.1%}"))
    print(f"compared {sum(k in ref for k in new)} configurations, farthest median {worst:.1%} from the reference")
    for k, dev in bad:
        print("  over 10%:", k, dev)
    return not bad


if __name__ == "__main__":
    ref = load(sys.argv[1])
    if len(sys.argv) > 2:
        sys.exit(0 if check(ref, load(sys.argv[2])) else 1)
    tables(ref)
    games_per_day(ref)
