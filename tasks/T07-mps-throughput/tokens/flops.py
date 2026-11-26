"""FLOPs per decision of the stand-in net, counted by torch's FlopCounterMode (matmuls and attention only),
for an inference forward (policy and value heads) and a PPO training step's forward + backward (all heads).

Usage: uv run python flops.py
"""

import torch
from torch.utils.flop_counter import FlopCounterMode

from net import SIZES, make, n_params, obs, ppo_loss, rollout, trunk_params

B = 64


def count(fn):
    with FlopCounterMode(display=False) as m:
        fn()
    return m.get_total_flops() / B


def main():
    gen = torch.Generator().manual_seed(0)
    for name, size in SIZES.items():
        net = make(name, "cpu")
        x, r = obs(size, B, gen), rollout(size, B, gen)
        infer = count(lambda: net(x, aux=False))
        train = count(lambda: ppo_loss(net, r).backward())
        rule = 6 * trunk_params(net) * size.tokens  # 2 per param per token forward, 4 backward
        print(f"{name}: params {n_params(net) / 1e6:.2f}M, trunk {trunk_params(net) / 1e6:.2f}M, "
              f"{size.tokens} tokens | GFLOP per decision: inference {infer / 1e9:.3f}, "
              f"train fwd+bwd {train / 1e9:.3f} (6 x trunk params x tokens: {rule / 1e9:.3f})")


if __name__ == "__main__":
    main()
