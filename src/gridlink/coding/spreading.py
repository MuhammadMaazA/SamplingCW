"""Reorder repetition copies so they sit a whole message apart.

Repetition encoding sends the copies of each bit next to each other, so one burst can
hit every copy of the same bit. Copy-major order sends the whole message once, then the
whole message again, so a burst no longer than one copy hits at most one copy of a bit.
"""

from __future__ import annotations


def _count(length: int, factor: int) -> int:
    if factor < 1 or length % factor:
        raise ValueError("spreading needs a whole number of copies")
    return length // factor


def spread(bits: list[int], factor: int) -> list[int]:
    """Copy-major order: the whole message, then the whole message again, and so on."""
    count = _count(len(bits), factor)
    return [bits[i * factor + c] for c in range(factor) for i in range(count)]


def unspread(bits: list[int], factor: int) -> list[int]:
    """Undo ``spread``, putting the copies of each bit back next to each other."""
    count = _count(len(bits), factor)
    out = [0] * len(bits)
    for c in range(factor):
        for i in range(count):
            out[i * factor + c] = bits[c * count + i]
    return out
