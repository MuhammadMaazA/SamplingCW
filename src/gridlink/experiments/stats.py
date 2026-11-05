"""Small-sample statistics for trial outcomes and error patterns."""

from __future__ import annotations

from math import comb, sqrt

import numpy as np


def wilson_interval(successes: int, trials: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a binomial proportion; sensible even at 0/n and n/n."""
    if trials <= 0:
        raise ValueError("trials must be positive")
    if not 0 <= successes <= trials:
        raise ValueError("successes must lie between zero and trials")
    p = successes / trials
    denominator = 1 + z * z / trials
    centre = (p + z * z / (2 * trials)) / denominator
    half = z * sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / denominator
    return max(0.0, centre - half), min(1.0, centre + half)


def fisher_exact(a: int, b: int, c: int, d: int) -> float:
    """Two-sided Fisher exact p-value for the table [[a, b], [c, d]]."""
    row1, row2, col1 = a + b, c + d, a + c
    total = row1 + row2

    def probability(x: int) -> float:
        return comb(row1, x) * comb(row2, col1 - x) / comb(total, col1)

    observed = probability(a)
    low, high = max(0, col1 - row2), min(row1, col1)
    return min(1.0, sum(
        probability(x) for x in range(low, high + 1) if probability(x) <= observed * (1 + 1e-9)
    ))


def bootstrap_ratio_interval(
    numerators: list[int],
    denominators: list[int],
    resamples: int = 10000,
    seed: int = 0,
    level: float = 0.95,
) -> tuple[float, float]:
    """Percentile interval for sum(numerators) / sum(denominators), resampling whole trials.

    Resampling trials rather than bits keeps the within-frame correlation of bursty errors,
    which a per-bit binomial interval would wrongly treat as independent evidence.
    """
    num = np.asarray(numerators, dtype=float)
    den = np.asarray(denominators, dtype=float)
    if len(num) != len(den) or not len(num):
        raise ValueError("need matching, non-empty per-trial counts")
    rng = np.random.default_rng(seed)
    picks = rng.integers(0, len(num), size=(resamples, len(num)))
    totals = den[picks].sum(axis=1)
    ratios = np.divide(num[picks].sum(axis=1), totals, out=np.zeros(resamples), where=totals > 0)
    tail = (1 - level) / 2
    return float(np.quantile(ratios, tail)), float(np.quantile(ratios, 1 - tail))


def run_lengths(positions: list[int]) -> list[int]:
    """Lengths of consecutive runs in a sorted list of error positions."""
    lengths: list[int] = []
    previous = None
    for position in sorted(positions):
        if lengths and position == previous + 1:
            lengths[-1] += 1
        else:
            lengths.append(1)
        previous = position
    return lengths


def burst_share(trials: list[list[int]], minimum_run: int = 3) -> float:
    """Fraction of all errors that sit in runs of at least ``minimum_run`` bits."""
    runs = [length for positions in trials for length in run_lengths(positions)]
    total = sum(runs)
    return sum(length for length in runs if length >= minimum_run) / total if total else 0.0


def burstiness_permutation_test(
    trials: list[list[int]],
    observed_bits: list[int],
    minimum_run: int = 3,
    permutations: int = 5000,
    seed: int = 0,
) -> tuple[float, float, float]:
    """Test errors against a memoryless channel with the same per-trial error counts.

    Under the null, each trial's errors fall uniformly at random over its observed bits.
    Returns (observed burst share, mean share under the null, one-sided p-value).
    """
    observed = burst_share(trials, minimum_run)
    rng = np.random.default_rng(seed)
    null = np.empty(permutations)
    for index in range(permutations):
        shuffled = [
            rng.choice(length, size=len(positions), replace=False).tolist()
            for positions, length in zip(trials, observed_bits)
        ]
        null[index] = burst_share(shuffled, minimum_run)
    p_value = (1 + np.sum(null >= observed - 1e-12)) / (1 + permutations)
    return observed, float(null.mean()), float(p_value)
