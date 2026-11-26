"""Stand-in for plan.md's Network v0: same token layout, trunk and heads, fed synthetic inputs.

Token layout (77 tokens): field (1), own mons (6), opposing mons (6), own mons' moves (24), opposing mons' moves (24),
last events (16). Own mon 0 is the active one, and the first 4 own move tokens are its moves. The @53 sizes drop the
opposing moves; the @33 sizes keep only the active mon's 4 moves, which is plan.md's token list as written.
"""

import math
from dataclasses import dataclass

import torch
import torch.nn.functional as F
from torch import nn

# gen9nationaldex at the pin (T06, support.json), plus "unknown" and padding ids.
N_SPECIES, N_ITEMS, N_ABILITIES, N_MOVES = 1206 + 2, 531 + 2, 304 + 2, 874 + 2
N_EVENT_TYPES = 64
N_SPREAD = 16
EMB = 64
FIELD_F, MON_F, MOVE_F, EVENT_F = 32, 128, 48, 16  # numeric features per token (MON_F includes the 24 calcs)
N_ACTIONS = 4 * 3 + 6  # 4 moves x {plain, Mega, Z}, plus a switch per team slot


@dataclass(frozen=True)
class Size:
    name: str
    d: int
    layers: int
    own_moves: int = 24
    opp_moves: int = 24
    move_enc: bool = False  # per-move shared MLP over all 48 mon moves (emb + dex feats + its 6 calcs), pooled into mon tokens
    extra: int = 0  # extra generic tokens (e.g. matchup tokens), built like move tokens

    @property
    def tokens(self):
        return 1 + 12 + self.own_moves + self.opp_moves + 16 + self.extra


SIZES = {
    "3M": Size("3M", 192, 5),
    "5M": Size("5M", 256, 5),
    "9M": Size("9M", 320, 6),
    "5M@53": Size("5M@53", 256, 5, opp_moves=0),
    "3M@33": Size("3M@33", 192, 5, own_moves=4, opp_moves=0),
    "5M@33": Size("5M@33", 256, 5, own_moves=4, opp_moves=0),
    "9M@33": Size("9M@33", 320, 6, own_moves=4, opp_moves=0),
    "5M@33enc": Size("5M@33enc", 256, 5, own_moves=4, opp_moves=0, move_enc=True),
    "5M@37": Size("5M@37", 256, 5, own_moves=4, opp_moves=4),
    "5M@37enc": Size("5M@37enc", 256, 5, own_moves=4, opp_moves=4, move_enc=True),
    "5M@39enc": Size("5M@39enc", 256, 5, own_moves=4, opp_moves=0, move_enc=True, extra=6),
    "5M@53enc": Size("5M@53enc", 256, 5, opp_moves=0, move_enc=True),
    "5M@77enc": Size("5M@77enc", 256, 5, move_enc=True),
}
ENC_H = 128


class Block(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.heads = d // 64
        self.n1, self.n2 = nn.RMSNorm(d), nn.RMSNorm(d)
        self.qkv, self.proj = nn.Linear(d, 3 * d), nn.Linear(d, d)
        self.fc1, self.fc2 = nn.Linear(d, 4 * d), nn.Linear(4 * d, d)

    def forward(self, x, attn_mask):
        b, t, d = x.shape
        q, k, v = self.qkv(self.n1(x)).view(b, t, 3, self.heads, d // self.heads).permute(2, 0, 3, 1, 4)
        a = F.scaled_dot_product_attention(q, k, v, attn_mask=attn_mask)
        x = x + self.proj(a.transpose(1, 2).reshape(b, t, d))
        return x + self.fc2(F.gelu(self.fc1(self.n2(x))))


class Net(nn.Module):
    def __init__(self, size: Size):
        super().__init__()
        d = size.d
        self.size = size
        self.species, self.items = nn.Embedding(N_SPECIES, EMB), nn.Embedding(N_ITEMS, EMB)
        self.abilities, self.moves = nn.Embedding(N_ABILITIES, EMB), nn.Embedding(N_MOVES, EMB)
        self.events = nn.Embedding(N_EVENT_TYPES, EMB)
        self.in_field = nn.Linear(FIELD_F, d)
        if size.move_enc:
            self.enc = nn.Sequential(nn.Linear(EMB + MOVE_F, ENC_H), nn.GELU(), nn.Linear(ENC_H, ENC_H))
            self.in_own = nn.Linear(3 * EMB + 2 * ENC_H + MON_F - 24, d)
            self.in_opp = nn.Linear(3 * EMB + 2 * ENC_H + MON_F - 24, d)
            self.in_move = nn.Linear(ENC_H, d)
        else:
            self.in_own = nn.Linear(7 * EMB + MON_F, d)
            self.in_opp = nn.Linear(7 * EMB + MON_F, d)
            self.in_move = nn.Linear(EMB + MOVE_F, d)
        self.in_event = nn.Linear(3 * EMB + EVENT_F, d)
        self.pos = nn.Parameter(torch.randn(size.tokens, d) * 0.02)
        self.blocks = nn.ModuleList(Block(d) for _ in range(size.layers))
        self.norm = nn.RMSNorm(d)
        self.move_head = nn.Linear(d, 3)
        self.switch_head = nn.Linear(d, 1)
        self.value_head = nn.Sequential(nn.Linear(d, d), nn.GELU(), nn.Linear(d, 1))
        self.aux_moves, self.aux_item = nn.Linear(d, N_MOVES), nn.Linear(d, N_ITEMS)
        self.aux_ability, self.aux_spread = nn.Linear(d, N_ABILITIES), nn.Linear(d, N_SPREAD)
        self.aux_next = nn.Linear(d, N_ACTIONS)

    def mon_tokens(self, ids, num, proj):
        e = torch.cat([self.species(ids[..., 0]), self.items(ids[..., 1]), self.abilities(ids[..., 2]),
                       self.moves(ids[..., 3:]).flatten(-2)], -1)
        return proj(torch.cat([e, num], -1))

    def enc_mon_tokens(self, ids, num, mnum, proj):
        m = self.enc(torch.cat([self.moves(ids[..., 3:]), mnum], -1))  # (b, 6, 4, H)
        e = torch.cat([self.species(ids[..., 0]), self.items(ids[..., 1]), self.abilities(ids[..., 2]),
                       m.sum(-2), m.amax(-2), num[..., 24:]], -1)
        return proj(e), m

    def trunk(self, x):
        if self.size.move_enc:
            own, om = self.enc_mon_tokens(x["own_ids"], x["own_num"], x["own_mnum"], self.in_own)
            opp, pm = self.enc_mon_tokens(x["opp_ids"], x["opp_num"], x["opp_mnum"], self.in_opp)
            mv = torch.cat([om.flatten(1, 2)[:, :self.size.own_moves], pm.flatten(1, 2)[:, :self.size.opp_moves],
                            om[:, :self.size.extra, 0]], 1)  # extra stand-ins reuse encoder outputs
            mon_and_moves = [own, opp, self.in_move(mv)]
        else:
            mon_and_moves = [self.mon_tokens(x["own_ids"], x["own_num"], self.in_own),
                             self.mon_tokens(x["opp_ids"], x["opp_num"], self.in_opp),
                             self.in_move(torch.cat([self.moves(x["move_ids"]), x["move_num"]], -1))]
        tok = torch.cat([
            self.in_field(x["field"]),
            *mon_and_moves,
            self.in_event(torch.cat([self.events(x["event_ids"][..., 0]), self.species(x["event_ids"][..., 1]),
                                     self.moves(x["event_ids"][..., 2]), x["event_num"]], -1)),
        ], 1) + self.pos
        attn_mask = x["present"][:, None, None, :]  # absent tokens (no event yet, fainted) are not attended to
        for blk in self.blocks:
            tok = blk(tok, attn_mask)
        return self.norm(tok)

    def forward(self, x, aux=True):
        h = self.trunk(x)
        # Heads run in fp32: masking with -inf and log-softmax over 18 actions are cheap and fp16-unsafe.
        h = h.float()
        with torch.autocast(h.device.type, enabled=False):
            logits = torch.cat([self.move_head(h[:, 13:17]).flatten(1), self.switch_head(h[:, 1:7]).squeeze(-1)], 1)
            logits = logits.masked_fill(~x["action_mask"], float("-inf"))
            value = self.value_head(h[:, 0]).squeeze(-1)
            if not aux:
                return logits, value
            opp = h[:, 7:13]
            return logits, value, (self.aux_moves(opp), self.aux_item(opp), self.aux_ability(opp),
                                   self.aux_spread(opp), self.aux_next(h[:, 0]))


def n_params(module):
    return sum(p.numel() for p in module.parameters())


def trunk_params(net):
    return n_params(net.blocks) + n_params(net.norm)


def obs(size: Size, b, gen):
    """A synthetic observation batch on CPU, drawn from generator `gen`."""
    r = lambda *s: torch.randn(*s, generator=gen)
    i = lambda hi, *s: torch.randint(0, hi, s, generator=gen)
    present = torch.rand(b, size.tokens, generator=gen) > 0.1
    present[:, :13] = True
    mask = torch.rand(b, N_ACTIONS, generator=gen) > 0.3
    mask[:, 12] = True  # at least one legal action
    return {
        "field": r(b, 1, FIELD_F),
        "own_ids": torch.stack([i(N_SPECIES, b, 6), i(N_ITEMS, b, 6), i(N_ABILITIES, b, 6)]
                               + [i(N_MOVES, b, 6) for _ in range(4)], -1),
        "own_num": r(b, 6, MON_F),
        "opp_ids": torch.stack([i(N_SPECIES, b, 6), i(N_ITEMS, b, 6), i(N_ABILITIES, b, 6)]
                               + [i(N_MOVES, b, 6) for _ in range(4)], -1),
        "opp_num": r(b, 6, MON_F),
        "move_ids": i(N_MOVES, b, size.own_moves + size.opp_moves + size.extra),
        "move_num": r(b, size.own_moves + size.opp_moves + size.extra, MOVE_F),
        "own_mnum": r(b, 6, 4, MOVE_F),
        "opp_mnum": r(b, 6, 4, MOVE_F),
        "event_ids": torch.stack([i(N_EVENT_TYPES, b, 16), i(N_SPECIES, b, 16), i(N_MOVES, b, 16)], -1),
        "event_num": r(b, 16, EVENT_F),
        "present": present,
        "action_mask": mask,
    }


def rollout(size: Size, b, gen):
    """A synthetic PPO minibatch: an observation plus the stored behaviour data and aux targets."""
    x = obs(size, b, gen)
    legal = x["action_mask"].float()
    x["action"] = torch.multinomial(legal, 1, generator=gen).squeeze(1)
    x["old_logp"] = -torch.rand(b, generator=gen) * 2
    x["adv"] = torch.randn(b, generator=gen)
    x["ret"] = torch.rand(b, generator=gen) * 2 - 1
    x["t_moves"] = (torch.rand(b, 6, N_MOVES, generator=gen) < 4 / N_MOVES).float()
    x["t_item"] = torch.randint(0, N_ITEMS, (b, 6), generator=gen)
    x["t_ability"] = torch.randint(0, N_ABILITIES, (b, 6), generator=gen)
    x["t_spread"] = torch.randint(0, N_SPREAD, (b, 6), generator=gen)
    x["t_next"] = torch.multinomial(legal, 1, generator=gen).squeeze(1)
    return x


def ppo_loss(net, x, clip=0.2, ent_coef=0.01, kl_coef=0.01, vf_coef=0.5, aux_coef=0.1):
    logits, value, (a_moves, a_item, a_ability, a_spread, a_next) = net(x)
    logp = torch.log_softmax(logits, -1)
    new_logp = logp.gather(1, x["action"][:, None]).squeeze(1)
    ratio = torch.exp(new_logp - x["old_logp"])
    pg = -torch.min(ratio * x["adv"], ratio.clamp(1 - clip, 1 + clip) * x["adv"]).mean()
    legal = x["action_mask"]
    n_legal = legal.sum(1)
    safe_logp = logp.masked_fill(~legal, 0)
    entropy = -(safe_logp.exp() * safe_logp).sum(1).mean()
    kl_uniform = (-safe_logp.sum(1) / n_legal - torch.log(n_legal.float())).mean()  # KL(uniform || pi)
    v_loss = F.mse_loss(value, x["ret"])
    aux = (F.binary_cross_entropy_with_logits(a_moves.float(), x["t_moves"])
           + F.cross_entropy(a_item.float().flatten(0, 1), x["t_item"].flatten())
           + F.cross_entropy(a_ability.float().flatten(0, 1), x["t_ability"].flatten())
           + F.cross_entropy(a_spread.float().flatten(0, 1), x["t_spread"].flatten())
           + F.cross_entropy(a_next.float(), x["t_next"]))
    return pg + vf_coef * v_loss - ent_coef * entropy + kl_coef * kl_uniform + aux_coef * aux


def to(x, device):
    return {k: v.to(device, non_blocking=True) for k, v in x.items()}


def make(size_name, device, seed=0):
    torch.manual_seed(seed)
    return Net(SIZES[size_name]).to(device)


def autocast_ctx(device, dtype):
    """dtype None means fp32."""
    if dtype is None:
        return torch.autocast(device, enabled=False)
    return torch.autocast(device, dtype=dtype)


DTYPES = {"fp32": None, "fp16": torch.float16, "bf16": torch.bfloat16}


class Trainer:
    """One PPO minibatch step: forward, backward, grad clip, AdamW. fp16 uses a GradScaler."""

    def __init__(self, net, device, dtype_name, lr=3e-4):
        self.net, self.device, self.dtype = net, device, DTYPES[dtype_name]
        self.opt = torch.optim.AdamW(net.parameters(), lr=lr)
        self.scaler = torch.amp.GradScaler(device, enabled=dtype_name == "fp16")

    def step(self, x):
        with autocast_ctx(self.device, self.dtype):
            loss = ppo_loss(self.net, x)
        self.opt.zero_grad(set_to_none=True)
        self.scaler.scale(loss).backward()
        self.scaler.unscale_(self.opt)
        torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
        self.scaler.step(self.opt)
        self.scaler.update()
        return loss


if __name__ == "__main__":
    for name, s in SIZES.items():
        net = Net(s)
        print(f"{name}: d={s.d} layers={s.layers} tokens={s.tokens} params={n_params(net) / 1e6:.2f}M "
              f"trunk={trunk_params(net) / 1e6:.2f}M")
