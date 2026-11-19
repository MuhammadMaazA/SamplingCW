"""High-contrast patterns for display and hardware-independent tests."""

from __future__ import annotations

import numpy as np


def symbol_image(bit: int, width: int = 800, height: int = 600) -> np.ndarray:
    if bit not in (0, 1) or width <= 0 or height <= 0:
        raise ValueError("bit must be 0 or 1 and dimensions must be positive")
    return np.full((height, width), 255 if bit else 0, dtype=np.uint8)

