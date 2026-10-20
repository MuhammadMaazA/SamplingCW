"""Preamble acquisition and symbol-centre sampling without camera dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil


@dataclass(frozen=True)
class TimedSample:
    """One classified camera observation and the monotonic time of its capture."""

    timestamp: float
    bit: int


def _nearest_sample(
    samples: list[TimedSample], target: float, tolerance: float
) -> TimedSample | None:
    nearest = min(samples, key=lambda sample: abs(sample.timestamp - target), default=None)
    if nearest is None or abs(nearest.timestamp - target) > tolerance:
        return None
    return nearest


def find_preamble_start(
    samples: list[TimedSample],
    symbol_duration: float,
    preamble: list[int],
    minimum_match_fraction: float = 0.8,
) -> float | None:
    """Estimate the start of a frame by matching preamble bits at symbol centres.

    Candidate starts are derived from observed camera timestamps. This avoids assuming
    that the first camera frame coincides with the first displayed symbol. A small timing
    tolerance permits ordinary frame jitter while rejecting gaps larger than a symbol.
    """
    if symbol_duration <= 0 or not preamble or not samples:
        raise ValueError("symbol duration, preamble and samples must be non-empty")
    if not 0 < minimum_match_fraction <= 1:
        raise ValueError("minimum match fraction must be in (0, 1]")
    ordered = sorted(samples, key=lambda sample: sample.timestamp)
    tolerance = symbol_duration * 0.45
    candidates = {
        sample.timestamp - (index + 0.5) * symbol_duration
        for sample in ordered
        for index in range(len(preamble))
    }
    required = ceil(len(preamble) * minimum_match_fraction)
    best: tuple[int, int, float] | None = None
    for candidate in candidates:
        matches = 0
        observed = 0
        for index, expected in enumerate(preamble):
            sample = _nearest_sample(
                ordered, candidate + (index + 0.5) * symbol_duration, tolerance
            )
            if sample is not None:
                observed += 1
                matches += sample.bit == expected
        score = (matches, observed, -candidate)
        if observed >= required and matches >= required and (best is None or score > best):
            best = score
            best_start = candidate
    return best_start if best is not None else None


def sample_symbols(
    samples: list[TimedSample],
    start: float,
    symbol_duration: float,
    maximum_symbols: int | None = None,
) -> list[int]:
    """Sample symbol centres after an acquired frame start.

    Sampling stops at the first centre with no nearby camera observation. Missing
    observations are therefore not silently converted into bit flips.
    """
    if symbol_duration <= 0:
        raise ValueError("symbol duration must be positive")
    ordered = sorted(samples, key=lambda sample: sample.timestamp)
    tolerance = symbol_duration * 0.45
    result: list[int] = []
    index = 0
    while maximum_symbols is None or index < maximum_symbols:
        sample = _nearest_sample(
            ordered, start + (index + 0.5) * symbol_duration, tolerance
        )
        if sample is None:
            break
        result.append(sample.bit)
        index += 1
    return result


def recover_symbols(
    samples: list[TimedSample],
    symbol_duration: float,
    preamble: list[int],
) -> list[int] | None:
    """Return the recovered symbol stream, including the preamble, if acquired."""
    start = find_preamble_start(samples, symbol_duration, preamble)
    if start is None:
        return None
    return sample_symbols(samples, start, symbol_duration)

