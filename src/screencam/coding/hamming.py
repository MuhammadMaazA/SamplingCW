"""Systematic Hamming (7,4), using even parity and positions 1..7."""

from __future__ import annotations

DATA_POSITIONS = (3, 5, 6, 7)
PARITY_POSITIONS = (1, 2, 4)


def encode_nibble(data: list[int]) -> list[int]:
    if len(data) != 4 or any(bit not in (0, 1) for bit in data):
        raise ValueError("Hamming input must contain four binary values")
    code = [0] * 8
    for position, bit in zip(DATA_POSITIONS, data):
        code[position] = bit
    for parity in PARITY_POSITIONS:
        code[parity] = sum(code[position] for position in range(1, 8) if position & parity) % 2
    return code[1:]


def encode(bits: list[int]) -> list[int]:
    if len(bits) % 4:
        raise ValueError("Hamming input length must be a multiple of four")
    return [bit for i in range(0, len(bits), 4) for bit in encode_nibble(bits[i : i + 4])]


def decode_codeword(codeword: list[int]) -> tuple[list[int], bool]:
    if len(codeword) != 7 or any(bit not in (0, 1) for bit in codeword):
        raise ValueError("Hamming codeword must contain seven binary values")
    code = [0] + codeword[:]
    syndrome = sum(
        parity
        for parity in PARITY_POSITIONS
        if sum(code[position] for position in range(1, 8) if position & parity) % 2
    )
    corrected = syndrome != 0
    if syndrome <= 7 and syndrome:
        code[syndrome] ^= 1
    return [code[position] for position in DATA_POSITIONS], corrected


def decode(bits: list[int]) -> tuple[list[int], int]:
    if len(bits) % 7:
        raise ValueError("Hamming stream is incomplete")
    output: list[int] = []
    corrected = 0
    for i in range(0, len(bits), 7):
        data, was_corrected = decode_codeword(bits[i : i + 7])
        output.extend(data)
        corrected += int(was_corrected)
    return output, corrected

