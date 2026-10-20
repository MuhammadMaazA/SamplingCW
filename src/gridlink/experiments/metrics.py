"""Pure metrics for comparing optical communication runs."""

from __future__ import annotations


def bit_error_rate(expected: list[int], received: list[int]) -> float:
    """Return aligned bit errors divided by the number of expected bits."""
    if len(expected) != len(received):
        raise ValueError("BER requires aligned streams of equal length")
    if not expected:
        return 0.0
    return sum(left != right for left, right in zip(expected, received)) / len(expected)


def frame_error_rate(failed_frames: int, total_frames: int) -> float:
    if failed_frames < 0 or total_frames <= 0 or failed_frames > total_frames:
        raise ValueError("invalid frame counts")
    return failed_frames / total_frames


def coding_rate(information_bits: int, coded_bits: int) -> float:
    if information_bits < 0 or coded_bits <= 0 or information_bits > coded_bits:
        raise ValueError("invalid coding lengths")
    return information_bits / coded_bits


def useful_throughput(information_bits: int, elapsed_seconds: float) -> float:
    if information_bits < 0 or elapsed_seconds <= 0:
        raise ValueError("information bits must be non-negative and elapsed time positive")
    return information_bits / elapsed_seconds


def synchronisation_failure_rate(failures: int, attempts: int) -> float:
    if failures < 0 or attempts <= 0 or failures > attempts:
        raise ValueError("invalid synchronisation counts")
    return failures / attempts


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

