"""Odd-factor repetition coding with majority-vote decoding."""

from __future__ import annotations


def encode(bits: list[int], factor: int) -> list[int]:
    if factor < 1 or factor % 2 == 0:
        raise ValueError("repetition factor must be a positive odd number")
    return [bit for bit in bits for _ in range(factor)]


def decode(bits: list[int], factor: int) -> list[int]:
    if factor < 1 or factor % 2 == 0:
        raise ValueError("repetition factor must be a positive odd number")
    if len(bits) % factor:
        raise ValueError("encoded stream is incomplete")
    midpoint = factor // 2
    groups = (bits[i : i + factor] for i in range(0, len(bits), factor))
    return [int(sum(group) > midpoint) for group in groups]

