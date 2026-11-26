"""CPU inference scaling across processes: N processes each run 1-thread inference at batch 64 over one shared 8 s
window. Usage: uv run python cpu_scale.py m <size>"""
import sys, time, subprocess, json
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
if sys.argv[1] == "w":
    import torch
    from net import SIZES, make, obs
    torch.set_num_threads(1); torch.set_num_interop_threads(1)
    size, start, end = sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    net = make(size, "cpu").eval(); g = torch.Generator().manual_seed(0)
    xs = [obs(SIZES[size], 64, g) for _ in range(4)]
    n, i, t0 = 0, 0, None
    while True:
        with torch.inference_mode(): net(xs[i % 4], aux=False)
        i += 1; now = time.time()
        if now >= end: break
        if now >= start:
            if t0 is None: t0 = now
            else: n += 1; t1 = now
    print(n * 64 / (t1 - t0))
else:
    size = sys.argv[2]
    for N in (1, 4, 8, 12):
        start = time.time() + 6; end = start + 8
        ps = [subprocess.Popen([sys.executable, __file__, "w", size, str(start), str(end)], stdout=subprocess.PIPE, text=True) for _ in range(N)]
        r = sorted(float(p.communicate()[0]) for p in ps)
        print(size, N, "procs: median per-proc", round(r[len(r)//2]), "total", round(sum(r)), flush=True)
