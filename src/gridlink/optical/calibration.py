"""Black/white intensity calibration for the optical receiver."""

from __future__ import annotations

from dataclasses import dataclass
from statistics import fmean


@dataclass(frozen=True)
class CalibrationResult:
    black_level: float
    white_level: float
    threshold: float
    contrast: float
    valid: bool


def estimate_threshold(
    black_samples: list[float],
    white_samples: list[float],
    minimum_contrast: float = 20.0,
) -> CalibrationResult:
    """Estimate a midpoint threshold and report whether levels are separable.

    The midpoint is only considered valid when the measured black level is lower
    than the white level and their mean separation exceeds the requested margin.
    This prevents a poor physical setup from being reported as calibrated.
    """
    if not black_samples or not white_samples:
        raise ValueError("both black and white samples are required")
    if minimum_contrast < 0:
        raise ValueError("minimum contrast must not be negative")
    black_level = fmean(black_samples)
    white_level = fmean(white_samples)
    contrast = white_level - black_level
    return CalibrationResult(
        black_level=black_level,
        white_level=white_level,
        threshold=(black_level + white_level) / 2,
        contrast=contrast,
        valid=contrast >= minimum_contrast,
    )

