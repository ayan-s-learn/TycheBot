"""Does the loss under fp16/bf16 autocast track fp32's? Same init, same minibatches, 300 PPO steps on MPS.

The data are 8 fixed synthetic minibatches, cycled, so the loss falls as the net memorizes them. A second fp32
run from another init seed gives the run-to-run gap that autocast's gap is judged against.

Usage: uv run python converge.py <out.json> [steps=300] [batch=256]
"""

import json
import math
import sys

import torch

from net import SIZES, Trainer, make, rollout, to

VARIANTS = (("fp32", 0), ("fp32", 1), ("fp16", 0), ("bf16", 0))  # (dtype, init seed)


def curve(size, dtype, seed, batches, steps):
    tr = Trainer(make(size, "mps", seed), "mps", dtype)
    out = [tr.step(batches[i % len(batches)]).item() for i in range(steps)]
    del tr
    torch.mps.empty_cache()
    return out


def main():
    out = sys.argv[1]
    steps = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    b = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    res = {"steps": steps, "batch": b, "torch": torch.__version__, "sizes": {}}
    for size in ("3M", "5M", "9M"):
        gen = torch.Generator().manual_seed(0)
        batches = [to(rollout(SIZES[size], b, gen), "mps") for _ in range(8)]
        curves = {f"{d}/seed{s}": curve(size, d, s, batches, steps) for d, s in VARIANTS}
        ref = curves["fp32/seed0"]
        summary = {}
        for name, c in curves.items():
            finite = all(math.isfinite(v) for v in c)
            gaps = [abs(a - r) / abs(r) for a, r in zip(c, ref)]
            last = slice(steps - 50, steps)
            summary[name] = {
                "finite": finite,
                "first": c[0], "last50_mean": sum(c[last]) / 50,
                "max_rel_gap": max(gaps), "last50_mean_rel_gap": sum(gaps[last]) / 50,
            }
            print(size, name, json.dumps(summary[name]), flush=True)
        res["sizes"][size] = {"summary": summary, "curves": curves}
        del batches
    with open(out, "w") as f:
        json.dump(res, f)


if __name__ == "__main__":
    main()
