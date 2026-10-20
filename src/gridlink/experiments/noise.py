"""Deterministic software models of bit-level channel noise."""

from __future__ import annotations

import random


def _validate_probability(probability: float) -> None:
    if not 0 <= probability <= 1:
        raise ValueError("noise probability must be between zero and one")


def binary_symmetric_channel(
    bits: list[int], flip_probability: float, seed: int | None = None
) -> list[int]:
    """Flip each bit independently with probability ``flip_probability``."""
    _validate_probability(flip_probability)
    generator = random.Random(seed)
    return [bit ^ int(generator.random() < flip_probability) for bit in bits]


def burst_noise(
    bits: list[int], start: int, length: int, flip_probability: float, seed: int | None = None
) -> list[int]:
    """Apply independent flips only inside one contiguous burst interval."""
    _validate_probability(flip_probability)
    if start < 0 or length < 0 or start + length > len(bits):
        raise ValueError("burst interval must lie inside the bit stream")
    generator = random.Random(seed)
    noisy = bits[:]
    for index in range(start, start + length):
        noisy[index] ^= int(generator.random() < flip_probability)
    return noisy

