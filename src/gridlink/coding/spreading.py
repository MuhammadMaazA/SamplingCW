"""Spread the repetition copies a whole message apart, so one burst cannot hit every copy of a bit."""

from __future__ import annotations


def _count(length: int, factor: int) -> int:
    if factor < 1 or length % factor:
        raise ValueError("spreading needs a whole number of copies")
    return length // factor


def spread(bits: list[int], factor: int) -> list[int]:
    """Send the whole message, then the whole message again, and so on."""
    count = _count(len(bits), factor)
    return [bits[i * factor + c] for c in range(factor) for i in range(count)]


def unspread(bits: list[int], factor: int) -> list[int]:
    """Undo spread, so the copies of each bit sit next to each other again."""
    count = _count(len(bits), factor)
    out = [0] * len(bits)
    for c in range(factor):
        for i in range(count):
            out[i * factor + c] = bits[c * count + i]
    return out
