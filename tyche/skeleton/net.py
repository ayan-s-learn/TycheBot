"""A small MLP policy and value over the skeleton's record (tyche/transport/record.py), and the random baseline.

On top of the flattened record it gathers the calcs that concern the opposing active: each own mon's best move against
it and its best move against each own mon, and the own active's 4 moves against it, so the net needn't learn that
lookup itself."""

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

from tyche.transport.record import N_ACTIONS

N_STATUS = 7


def tensors(records):
    """A batch of records (a RECORD array) as torch tensors on CPU."""
    return {
        name: torch.from_numpy(np.ascontiguousarray(records[name]))
        for name in ("species", "moves", "status", "mask", "hp", "fainted", "active", "boosts", "calcs", "kind")
    }


class Net(nn.Module):
    def __init__(self, n_species, n_moves, d=256, emb=16):
        super().__init__()
        self.species = nn.Embedding(n_species, emb)
        self.moves = nn.Embedding(n_moves, emb)
        per_mon = emb + N_STATUS + 3 + 7
        n_in = 12 * per_mon + 6 * 4 * emb + 2 * 6 * 4 * 6 + 4 + 4 + 6 + 6 + 3
        self.body = nn.Sequential(nn.Linear(n_in, d), nn.ReLU(), nn.Linear(d, d), nn.ReLU())
        self.policy = nn.Linear(d, N_ACTIONS)
        self.value = nn.Linear(d, 1)

    def forward(self, x):
        b = x["hp"].shape[0]
        mons = torch.cat([
            self.species(x["species"].long()),
            F.one_hot(x["status"].long(), N_STATUS).float(),
            torch.stack([x["hp"], x["fainted"], x["active"]], -1),
            x["boosts"] / 6,
        ], -1)
        calcs = x["calcs"]  # [b, 2, 6 attacker, 4 move, 6 defender]
        opp_active = x["active"][:, 6:]  # [b, 6]
        # Own mon i's moves against the opposing active, and the opposing active's moves against own mon i.
        own_vs = (calcs[:, 0] * opp_active[:, None, None, :]).sum(-1)  # [b, 6, 4]
        opp_vs = (calcs[:, 1] * opp_active[:, :, None, None]).sum(1)  # [b, 4, 6]
        h = torch.cat([
            mons.flatten(1),
            self.moves(x["moves"].long()).flatten(1),
            calcs.flatten(1),
            own_vs[:, 0],  # the own active (request slot 1) is mon 0 at a move request
            opp_vs[:, :, 0],
            own_vs.amax(-1),
            opp_vs.amax(1),
            F.one_hot(x["kind"].long(), 3).float(),
        ], -1)
        assert h.shape == (b, self.body[0].in_features)
        h = self.body(h)
        logits = self.policy(h).masked_fill(x["mask"] == 0, float("-inf"))
        return logits, self.value(h).squeeze(-1)


def random_policy(mask, rng):
    """The baseline: a uniformly random legal action per row of a 0/1 mask."""
    return (rng.random(mask.shape) * mask).argmax(1)
