"""Preamble acquisition and symbol-centre sampling without camera dependencies."""

from __future__ import annotations

from bisect import bisect_left
from dataclasses import dataclass
from math import ceil, floor


@dataclass(frozen=True)
class TimedSample:
    """One classified camera observation and the monotonic time of its capture."""

    timestamp: float
    bit: int
    intensity: float | None = None


CANDIDATE_STEP_FRACTION = 0.125
TOLERANCE_FRACTION = 0.45


class _Timeline:
    """Time-ordered samples with logarithmic nearest-observation lookup."""

    def __init__(self, samples: list[TimedSample]) -> None:
        self.samples = sorted(samples, key=lambda sample: sample.timestamp)
        self.times = [sample.timestamp for sample in self.samples]

    def nearest(self, target: float, tolerance: float) -> TimedSample | None:
        index = bisect_left(self.times, target)
        best: TimedSample | None = None
        for neighbour in (index - 1, index):
            if 0 <= neighbour < len(self.samples):
                sample = self.samples[neighbour]
                if best is None or abs(sample.timestamp - target) < abs(best.timestamp - target):
                    best = sample
        if best is None or abs(best.timestamp - target) > tolerance:
            return None
        return best

    def score(
        self, start: float, symbol_duration: float, pattern: list[int]
    ) -> tuple[int, int]:
        tolerance = symbol_duration * TOLERANCE_FRACTION
        matches = 0
        observed = 0
        for index, expected in enumerate(pattern):
            sample = self.nearest(start + (index + 0.5) * symbol_duration, tolerance)
            if sample is not None:
                observed += 1
                matches += sample.bit == expected
        return matches, observed


def _validate(symbol_duration: float, pattern: list[int], minimum_match_fraction: float) -> None:
    if symbol_duration <= 0 or not pattern:
        raise ValueError("symbol duration and pattern must be non-empty")
    if not 0 < minimum_match_fraction <= 1:
        raise ValueError("minimum match fraction must be in (0, 1]")


def _candidate_grid(first: float, last: float, step: float) -> list[float]:
    count = max(floor((last - first) / step), 0)
    return [first + index * step for index in range(count + 1)]


def _centre_of_best_run(scored: list[tuple[float, tuple[int, int]]]) -> float:
    """Return the middle of the first contiguous run of best-scoring candidates.

    Several neighbouring candidate starts usually decode a clean pattern identically.
    Taking the middle of that run places symbol centres away from transition edges.
    """
    best = max(score for _, score in scored)
    run: list[float] = []
    for candidate, score in scored:
        if score == best:
            run.append(candidate)
        elif run:
            break
    return run[len(run) // 2]


def find_preamble_start(
    samples: list[TimedSample],
    symbol_duration: float,
    preamble: list[int],
    minimum_match_fraction: float = 0.8,
) -> float | None:
    """Estimate the start of a frame by matching preamble bits at symbol centres.

    Candidate starts are spaced at a fraction of a symbol over the captured interval.
    This avoids assuming that the first camera frame coincides with the first displayed
    symbol. A small timing tolerance permits ordinary frame jitter while rejecting gaps
    larger than a symbol.
    """
    if not samples:
        raise ValueError("samples must be non-empty")
    _validate(symbol_duration, preamble, minimum_match_fraction)
    timeline = _Timeline(samples)
    required = ceil(len(preamble) * minimum_match_fraction)
    scored = [
        (candidate, timeline.score(candidate, symbol_duration, preamble))
        for candidate in _candidate_grid(
            timeline.times[0] - len(preamble) * symbol_duration,
            timeline.times[-1],
            symbol_duration * CANDIDATE_STEP_FRACTION,
        )
    ]
    matches, _ = max(score for _, score in scored)
    if matches < required:
        return None
    return _centre_of_best_run(scored)


def find_first_pattern(
    samples: list[TimedSample],
    symbol_duration: float,
    pattern: list[int],
    not_before: float,
    not_after: float,
    minimum_match_fraction: float = 0.8,
) -> float | None:
    """Return the start of the earliest occurrence of ``pattern`` in a time window.

    The earliest qualifying candidate is refined over the following pattern length,
    because a periodic preamble also partially matches when shifted by whole symbols.
    """
    _validate(symbol_duration, pattern, minimum_match_fraction)
    if not samples or not_after < not_before:
        return None
    timeline = _Timeline(samples)
    required = ceil(len(pattern) * minimum_match_fraction)
    step = symbol_duration * CANDIDATE_STEP_FRACTION
    for candidate in _candidate_grid(not_before, not_after, step):
        matches, observed = timeline.score(candidate, symbol_duration, pattern)
        if matches >= required and observed >= required:
            refinement = [
                (start, timeline.score(start, symbol_duration, pattern))
                for start in _candidate_grid(
                    candidate, min(not_after, candidate + len(pattern) * symbol_duration), step
                )
            ]
            return _centre_of_best_run(refinement)
    return None


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
    timeline = _Timeline(samples)
    tolerance = symbol_duration * TOLERANCE_FRACTION
    result: list[int] = []
    index = 0
    while maximum_symbols is None or index < maximum_symbols:
        sample = timeline.nearest(start + (index + 0.5) * symbol_duration, tolerance)
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
