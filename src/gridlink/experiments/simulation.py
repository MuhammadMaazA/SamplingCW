"""Repeatable coding experiments for the COMP0228 lab exercises."""

from __future__ import annotations

from dataclasses import dataclass
from math import comb
from statistics import mean, pstdev

from ..coding.extended_hamming import UncorrectableError
from ..coding.pipeline import CodingConfig, decode, encode, encoded_length
from .metrics import bit_error_rate, coding_rate
from .noise import binary_symmetric_channel, burst_noise


@dataclass(frozen=True)
class TrialResult:
    coding: str
    repetitions: int
    flip_probability: float
    input_bits: int
    encoded_bits: int
    coded_bit_error_rate: float
    decoded_bit_error_rate: float | None
    corrected_codewords: int
    seed: int
    uncorrectable: bool = False


@dataclass(frozen=True)
class TrialSummary:
    coding: str
    repetitions: int
    flip_probability: float
    trials: int
    mean_decoded_ber: float | None
    standard_deviation: float | None
    coding_rate: float
    uncorrectable_trials: int = 0


def repetition_error_probability(flip_probability: float, factor: int) -> float:
    """Return the theoretical majority-vote BER for an odd repetition factor."""
    if not 0 <= flip_probability <= 1:
        raise ValueError("noise probability must be between zero and one")
    if factor < 1 or factor % 2 == 0:
        raise ValueError("repetition factor must be a positive odd number")
    threshold = (factor + 1) // 2
    return sum(
        comb(factor, errors)
        * flip_probability**errors
        * (1 - flip_probability) ** (factor - errors)
        for errors in range(threshold, factor + 1)
    )


def run_trial(
    bits: list[int],
    config: CodingConfig,
    flip_probability: float,
    seed: int,
    burst: tuple[int, int] | None = None,
) -> TrialResult:
    """Encode, corrupt, decode and score one deterministic trial."""
    encoded = encode(bits, config)
    if burst is None:
        received = binary_symmetric_channel(encoded, flip_probability, seed)
    else:
        start, length = burst
        received = burst_noise(encoded, start, length, flip_probability, seed)
    uncorrectable = False
    try:
        decoded, corrected = decode(received, len(bits), config)
    except UncorrectableError:
        decoded, corrected = None, 0
        uncorrectable = True
    return TrialResult(
        coding=config.scheme,
        repetitions=config.repetitions,
        flip_probability=flip_probability,
        input_bits=len(bits),
        encoded_bits=len(encoded),
        coded_bit_error_rate=bit_error_rate(encoded, received),
        decoded_bit_error_rate=bit_error_rate(bits, decoded) if decoded is not None else None,
        corrected_codewords=corrected,
        seed=seed,
        uncorrectable=uncorrectable,
    )


def run_trials(
    bits: list[int],
    config: CodingConfig,
    flip_probability: float,
    trials: int,
    seed: int = 0,
    burst: tuple[int, int] | None = None,
) -> list[TrialResult]:
    if trials <= 0:
        raise ValueError("trials must be positive")
    config.validate()
    if burst is not None:
        start, length = burst
        if start < 0 or length < 0 or start + length > encoded_length(len(bits), config):
            raise ValueError("burst interval must fit the encoded stream")
    return [
        run_trial(bits, config, flip_probability, seed + index, burst)
        for index in range(trials)
    ]


def summarise_trials(results: list[TrialResult]) -> TrialSummary:
    if not results:
        raise ValueError("at least one trial result is required")
    first = results[0]
    if any(
        (result.coding, result.repetitions, result.flip_probability)
        != (first.coding, first.repetitions, first.flip_probability)
        for result in results
    ):
        raise ValueError("all results must use the same experiment configuration")
    ber_values = [
        result.decoded_bit_error_rate for result in results
        if result.decoded_bit_error_rate is not None
    ]
    return TrialSummary(
        coding=first.coding,
        repetitions=first.repetitions,
        flip_probability=first.flip_probability,
        trials=len(results),
        mean_decoded_ber=mean(ber_values) if ber_values else None,
        standard_deviation=pstdev(ber_values) if ber_values else None,
        coding_rate=coding_rate(first.input_bits, first.encoded_bits),
        uncorrectable_trials=sum(result.uncorrectable for result in results),
    )

