import argparse

import numpy as np
import torch

from tyche.skeleton.net import Net, random_policy, tensors
from tyche.skeleton.train import gae, ppo_update
from tyche.transport.workers import Workers


def test_gae():
    adv, ret = gae(np.array([0.5, 0.5]), 1.0, False, gamma=1.0, lam=1.0)
    assert np.allclose(adv, [0.5, 0.5]) and np.allclose(ret, [1.0, 1.0])
    # A game cut off at the cap bootstraps from its last value instead of scoring 0.
    adv, ret = gae(np.array([0.2, 0.4]), 1.0, True, gamma=1.0, lam=1.0)
    assert np.allclose(ret, [0.4, 0.4])


def test_net_masks_and_ppo_updates_on_real_records():
    with Workers(1, battles=4, seed="skeleton-test") as ws:
        (b,) = ws.gather()
        vocab = ws.hello["vocab"]
        ws.stop()
    records = b.records
    torch.manual_seed(0)
    net = Net(vocab["species"], vocab["moves"])
    logits, value = net(tensors(records))
    mask = torch.from_numpy(records["mask"]) == 1
    assert torch.isinf(logits[~mask]).all() and torch.isfinite(logits[mask]).all()
    assert value.shape == (len(records),)
    rng = np.random.default_rng(0)
    actions = random_policy(records["mask"], rng)
    assert (records["mask"][np.arange(len(records)), actions] == 1).all()
    batch = {
        "records": records, "actions": actions,
        "logp": torch.log_softmax(logits, -1).gather(1, torch.from_numpy(actions)[:, None]).squeeze(1).detach().numpy(),
        "adv": rng.standard_normal(len(records)), "ret": rng.uniform(-1, 1, len(records)),
    }
    before = [p.detach().clone() for p in net.parameters()]
    args = argparse.Namespace(epochs=2, minibatch=64, clip=0.2, vf_coef=0.5, ent_coef=0.01)
    stats = ppo_update(net, torch.optim.Adam(net.parameters(), lr=1e-3), batch, args)
    assert all(np.isfinite(v) for v in stats.values())
    assert any(not torch.equal(a, p) for a, p in zip(before, net.parameters()))
