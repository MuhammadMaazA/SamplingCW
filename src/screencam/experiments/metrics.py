"""Pure metrics for comparing optical communication runs."""

from __future__ import annotations


def bit_error_rate(expected: list[int], received: list[int]) -> float:
    """Return aligned bit errors divided by the number of expected bits."""
    if len(expected) != len(received):
        raise ValueError("BER requires aligned streams of equal length")
    if not expected:
        return 0.0
    return sum(left != right for left, right in zip(expected, received)) / len(expected)


def coding_rate(information_bits: int, coded_bits: int) -> float:
    if information_bits < 0 or coded_bits <= 0 or information_bits > coded_bits:
        raise ValueError("invalid coding lengths")
    return information_bits / coded_bits


def error_run_lengths(expected: list[int], received: list[int]) -> list[int]:
    """Return lengths of consecutive mismatches in two aligned streams."""
    if len(expected) != len(received):
        raise ValueError("error runs require aligned streams of equal length")
    runs: list[int] = []
    current = 0
    for left, right in zip(expected, received):
        if left != right:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    if current:
        runs.append(current)
    return runs

