"""Extended Hamming (8,4): single-error correction and double-error detection."""

from . import hamming


class UncorrectableError(ValueError):
    """A codeword has a nonzero syndrome but even overall parity."""


def encode(bits: list[int]) -> list[int]:
    coded = hamming.encode(bits)
    result = []
    for offset in range(0, len(coded), 7):
        word = coded[offset : offset + 7]
        result.extend(word + [sum(word) % 2])
    return result


def decode(bits: list[int]) -> tuple[list[int], int]:
    if len(bits) % 8 or any(bit not in (0, 1) for bit in bits):
        raise ValueError("extended Hamming stream must contain complete binary codewords")
    result = []
    corrected = 0
    for offset in range(0, len(bits), 8):
        word = bits[offset : offset + 8]
        data, syndrome_nonzero = hamming.decode_codeword(word[:7])
        odd_parity = sum(word) % 2
        if syndrome_nonzero and not odd_parity:
            raise UncorrectableError(f"uncorrectable codeword at index {offset // 8}")
        result.extend(data)
        corrected += odd_parity
    return result, corrected
