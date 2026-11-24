"""Checks that PyTorch in this environment can run on the M4 Max GPU through MPS."""
import platform
import sys

import torch

print(f"Python {platform.python_version()}, torch {torch.__version__}")
available = torch.backends.mps.is_available()
print(f"torch.backends.mps.is_available(): {available}")
if available:
    x = torch.randn(1024, 1024, device="mps")
    total = (x @ x).sum().item()  # .item() waits for the GPU kernel to finish
    print(f"1024x1024 matmul on mps: ok (sum {total:.1f})")
sys.exit(0 if available else 1)
