"""Send Hamming codewords by columns in groups of up to eight words."""

WORD_BITS = 7
DEPTH = 8


def _order(length: int, depth: int) -> list[int]:
    if length % WORD_BITS:
        raise ValueError("interleaving needs complete Hamming codewords")
    if depth < 1:
        raise ValueError("interleaver depth must be positive")
    order = []
    for start in range(0, length, WORD_BITS * depth):
        words = min(depth, (length - start) // WORD_BITS)
        # Send one column from every word, then move to the next column.
        for column in range(WORD_BITS):
            for row in range(words):
                order.append(start + row * WORD_BITS + column)
    return order


def interleave(bits: list[int], depth: int = DEPTH) -> list[int]:
    return [bits[index] for index in _order(len(bits), depth)]


def deinterleave(bits: list[int], depth: int = DEPTH) -> list[int]:
    result = [0] * len(bits)
    for index, bit in zip(_order(len(bits), depth), bits):
        result[index] = bit
    return result
