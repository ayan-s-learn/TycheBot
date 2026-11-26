"""Synchronous PPO on the skeleton's records, against itself and against random legal actions.

Each step takes one batch from every worker, answers it, and stores the policy's decisions per (worker, game, side).
A game is self-play (both sides stored) or, with probability --vs-random, the policy on one side against random
actions (only the policy's side stored). Its win rate in those games is the curve in the log. A finished game's
decisions get GAE advantages (reward +1 win, -1 loss, 0 tie, at the last decision); a game cut off at the turn cap
bootstraps from the last decision's value. Once --batch decisions are stored, PPO updates on them.

Usage: python -m tyche.skeleton.train --out <dir> [--minutes 20] [--workers 12] [--battles 32] [--seed 0]
Writes <dir>/log.jsonl (one line per update) and <dir>/net.pt.
"""

import argparse
import json
import time
from collections import defaultdict, deque
from pathlib import Path

import numpy as np
import torch

from tyche.skeleton.net import Net, random_policy, tensors
from tyche.transport.record import RECORD
from tyche.transport.workers import Workers


def game_mode(seed, worker, game, vs_random):
    """-1 for self-play, else the side the policy plays against random actions."""
    r = np.random.default_rng([seed, worker, game]).random()
    return -1 if r >= vs_random else int(r < vs_random / 2)


def gae(values, reward, truncated, gamma, lam):
    """Advantages and returns for one side's decisions in one game; the reward comes at the last one."""
    n = len(values)
    next_values = np.append(values[1:], values[-1] if truncated else 0.0)
    rewards = np.zeros(n)
    rewards[-1] = 0.0 if truncated else reward
    deltas = rewards + gamma * next_values - values
    adv = np.zeros(n)
    acc = 0.0
    for t in range(n - 1, -1, -1):
        acc = deltas[t] + gamma * lam * acc
        adv[t] = acc
    return adv, adv + values


def ppo_update(net, opt, batch, args):
    x = tensors(batch["records"])
    actions = torch.from_numpy(batch["actions"])
    old_logp = torch.from_numpy(batch["logp"])
    adv = torch.from_numpy(batch["adv"]).float()
    adv = (adv - adv.mean()) / (adv.std() + 1e-8)
    ret = torch.from_numpy(batch["ret"]).float()
    n = len(actions)
    stats = defaultdict(list)
    for _ in range(args.epochs):
        for idx in torch.randperm(n).split(args.minibatch):
            logits, value = net({k: v[idx] for k, v in x.items()})
            logp_all = torch.log_softmax(logits, -1)
            logp = logp_all.gather(1, actions[idx, None]).squeeze(1)
            ratio = torch.exp(logp - old_logp[idx])
            a = adv[idx]
            pg = -torch.min(ratio * a, ratio.clamp(1 - args.clip, 1 + args.clip) * a).mean()
            # Masked actions have log-prob -inf; zeroing them first keeps 0 * -inf out of the gradient.
            safe = logp_all.masked_fill(x["mask"][idx] == 0, 0.0)
            entropy = -(safe.exp() * safe).sum(1).mean()
            v_loss = (value - ret[idx]).pow(2).mean()
            loss = pg + args.vf_coef * v_loss - args.ent_coef * entropy
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(net.parameters(), 0.5)
            opt.step()
            stats["pg"].append(pg.item())
            stats["value"].append(v_loss.item())
            stats["entropy"].append(entropy.item())
            stats["clip"].append(((ratio - 1).abs() > args.clip).float().mean().item())
            stats["kl"].append((old_logp[idx] - logp).mean().item())
    return {k: float(np.mean(v)) for k, v in stats.items()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--minutes", type=float, default=20)
    p.add_argument("--workers", type=int, default=12)
    p.add_argument("--battles", type=int, default=32)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--vs-random", type=float, default=0.5)
    p.add_argument("--turn-cap", type=int, default=300)
    p.add_argument("--batch", type=int, default=32768)
    p.add_argument("--minibatch", type=int, default=2048)
    p.add_argument("--epochs", type=int, default=4)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--gamma", type=float, default=0.99)
    p.add_argument("--lam", type=float, default=0.95)
    p.add_argument("--clip", type=float, default=0.2)
    p.add_argument("--ent-coef", type=float, default=0.01)
    p.add_argument("--vf-coef", type=float, default=0.5)
    p.add_argument("--threads", type=int, default=2)
    args = p.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(args.seed)
    torch.set_num_threads(args.threads)
    rng = np.random.default_rng(args.seed)

    with Workers(args.workers, battles=args.battles, seed=f"train-{args.seed}", turn_cap=args.turn_cap) as ws:
        vocab = ws.hello["vocab"]
        net = Net(vocab["species"], vocab["moves"])
        opt = torch.optim.Adam(net.parameters(), lr=args.lr)
        modes = {}
        steps = defaultdict(list)  # (worker, game, side) -> [(record, action, logp, value)]
        done = []  # finished sides: (records, actions, logp, adv, ret)
        buffered = 0
        results = deque(maxlen=500)  # the policy's results against random: 1 win, 0 otherwise
        games = decisions = updates = 0
        start = time.perf_counter()
        log = open(out / "log.jsonl", "w")
        while time.perf_counter() - start < args.minutes * 60:
            batches = ws.gather()
            for b in batches:
                for e in b.ended:
                    games += 1
                    mode = modes.pop((b.worker, int(e["game"])), -1)
                    for side in (0, 1):
                        s = steps.pop((b.worker, int(e["game"]), side), None)
                        if not s:
                            continue
                        reward = 0.0 if e["winner"] < 0 else (1.0 if e["winner"] == side else -1.0)
                        adv, ret = gae(np.array([x[3] for x in s]), reward, bool(e["truncated"]), args.gamma, args.lam)
                        done.append((np.array([x[0] for x in s], RECORD), np.array([x[1] for x in s]),
                                     np.array([x[2] for x in s], np.float32), adv, ret))
                        buffered += len(s)
                    if mode >= 0:
                        results.append(int(e["winner"] == mode))
            records = np.concatenate([b.records for b in batches])
            workers = np.concatenate([np.full(len(b.records), b.worker) for b in batches])
            with torch.no_grad():
                logits, values = net(tensors(records))
                actions = torch.distributions.Categorical(logits=logits).sample()
                logp = torch.log_softmax(logits, -1).gather(1, actions[:, None]).squeeze(1)
            actions, logp, values = actions.numpy(), logp.numpy(), values.numpy()
            randoms = random_policy(records["mask"], rng)
            for i, rec in enumerate(records):
                key = (int(workers[i]), int(rec["game"]))
                if key not in modes:
                    modes[key] = game_mode(args.seed, *key, args.vs_random)
                side = int(rec["side"])
                if modes[key] >= 0 and side != modes[key]:
                    actions[i] = randoms[i]
                else:
                    steps[(*key, side)].append((rec.copy(), int(actions[i]), float(logp[i]), float(values[i])))
            at = 0
            for b in batches:
                ws.send(b.worker, actions[at : at + len(b.records)])
                at += len(b.records)
            decisions += len(records)
            if buffered >= args.batch:
                batch = {
                    "records": np.concatenate([d[0] for d in done]), "actions": np.concatenate([d[1] for d in done]),
                    "logp": np.concatenate([d[2] for d in done]), "adv": np.concatenate([d[3] for d in done]),
                    "ret": np.concatenate([d[4] for d in done]),
                }
                done.clear()
                buffered = 0
                t = time.perf_counter()
                stats = ppo_update(net, opt, batch, args)
                updates += 1
                line = {
                    "update": updates, "minutes": (time.perf_counter() - start) / 60, "decisions": decisions,
                    "games": games, "trained": len(batch["actions"]), "updateSeconds": time.perf_counter() - t,
                    "winRateVsRandom": float(np.mean(results)) if results else None, "vsRandomGames": len(results),
                    **stats,
                }
                log.write(json.dumps(line) + "\n")
                log.flush()
                print(f"update {updates}: {line['minutes']:.1f} min, {decisions:,} decisions, {games:,} games, "
                      f"win rate vs random {line['winRateVsRandom']:.3f} (last {len(results)}), "
                      f"entropy {stats['entropy']:.3f}, value loss {stats['value']:.3f}", flush=True)
                torch.save({"net": net.state_dict(), "vocab": vocab, "args": vars(args)}, out / "net.pt")
        ws.stop()


if __name__ == "__main__":
    main()
