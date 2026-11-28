"""The trained policy against random legal actions on stub-pool teams, from seeds training never used.

Worker w plays games 0..K-1, and the policy takes p1 in even games and p2 in odd ones, so the 1,000 games are fixed
before they start and split evenly between seats. Games past K are ignored, so short games aren't favoured. The
policy samples its actions (--greedy takes the most likely legal one instead).

Usage: python -m tyche.skeleton.eval <net.pt> [--games 1000] [--workers 10] [--seed 0] [--greedy] [--out <file.json>]
"""

import argparse
import json
import math

import numpy as np
import torch

from tyche.skeleton.net import Net, random_policy, tensors
from tyche.transport.workers import Workers


def wilson(k, n, z=1.96):
    p = k / n
    mid = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return mid - half, mid + half


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--games", type=int, default=1000)
    p.add_argument("--workers", type=int, default=10)
    p.add_argument("--battles", type=int, default=32)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--greedy", action="store_true")
    p.add_argument("--out")
    args = p.parse_args()
    assert args.games % (2 * args.workers) == 0, "games must split evenly over workers and seats"
    per_worker = args.games // args.workers
    ckpt = torch.load(args.checkpoint)
    rng = np.random.default_rng(args.seed)
    torch.manual_seed(args.seed)

    results = {}  # (worker, game) -> (policy side, winner, truncated, turns)
    with Workers(args.workers, battles=args.battles, seed=f"eval-{args.seed}", turn_cap=ckpt["args"]["turn_cap"]) as ws:
        assert ws.hello["vocab"] == ckpt["vocab"], "the checkpoint was trained on another vocab"
        net = Net(ckpt["vocab"]["species"], ckpt["vocab"]["moves"])
        net.load_state_dict(ckpt["net"])
        net.eval()
        while len(results) < args.games:
            batches = ws.gather()
            for b in batches:
                for e in b.ended:
                    if e["game"] < per_worker:
                        results[(b.worker, int(e["game"]))] = (int(e["game"]) % 2, int(e["winner"]), int(e["truncated"]), int(e["turns"]))
            records = np.concatenate([b.records for b in batches])
            with torch.no_grad():
                logits, _ = net(tensors(records))
            actions = logits.argmax(1) if args.greedy else torch.distributions.Categorical(logits=logits).sample()
            actions = actions.numpy()
            policy = records["side"] == records["game"] % 2
            actions[~policy] = random_policy(records["mask"][~policy], rng)
            at = 0
            for b in batches:
                ws.send(b.worker, actions[at : at + len(b.records)])
                at += len(b.records)
        stats = ws.stop()

    seats = {}
    for side in (0, 1):
        rs = [r for r in results.values() if r[0] == side]
        seats[f"p{side + 1}"] = {
            "games": len(rs), "wins": sum(r[1] == side for r in rs), "losses": sum(r[1] == 1 - side for r in rs),
            "ties": sum(r[1] < 0 and not r[2] for r in rs), "truncated": sum(r[2] for r in rs),
        }
    wins = sum(s["wins"] for s in seats.values())
    out = {
        "checkpoint": args.checkpoint, "games": len(results), "wins": wins, "winRate": wins / len(results),
        "ci95": wilson(wins, len(results)), "seats": seats, "greedy": args.greedy, "seed": args.seed,
        "meanTurns": float(np.mean([r[3] for r in results.values()])),
        # Over every game the workers played, counted or not.
        "invalid": sum(s["counts"]["invalid"] for s in stats), "unavailable": sum(s["counts"]["unavailable"] for s in stats),
    }
    print(json.dumps(out, indent=1))
    if args.out:
        with open(args.out, "w") as f:
            json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
