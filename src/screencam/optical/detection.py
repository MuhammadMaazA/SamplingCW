"""Small, hardware-independent operations used by the webcam receiver."""

from __future__ import annotations

import numpy as np


def classify_intensity(intensity: float, threshold: float) -> int:
    return int(intensity >= threshold)


def sample_roi(gray_frame: np.ndarray, roi: tuple[int, int, int, int]) -> float:
    x, y, width, height = roi
    if width <= 0 or height <= 0:
        raise ValueError("ROI must have positive dimensions")
    region = gray_frame[y : y + height, x : x + width]
    if region.size == 0:
        raise ValueError("ROI is outside the image")
    return float(np.median(region))

