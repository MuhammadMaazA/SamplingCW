"""Send Hamming codewords by columns in groups of up to eight words."""

WORD_BITS = 7
DEPTH = 8


def _order(length: int) -> list[int]:
    if length % WORD_BITS:
        raise ValueError("interleaving needs complete Hamming codewords")
    return [
        start + row * WORD_BITS + column
        for start in range(0, length, WORD_BITS * DEPTH)
        for column in range(WORD_BITS)
        for row in range(min(DEPTH, (length - start) // WORD_BITS))
    ]


def interleave(bits: list[int]) -> list[int]:
    return [bits[index] for index in _order(len(bits))]


def deinterleave(bits: list[int]) -> list[int]:
    result = [0] * len(bits)
    for index, bit in zip(_order(len(bits)), bits):
        result[index] = bit
    return result
