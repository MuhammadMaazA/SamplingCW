"""Small dispatcher for the coding modes used by GridLink frames."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from . import hamming, parity2d, repetition
from .interleaving import deinterleave, interleave

CODING_IDS = {
    "none": 0,
    "repetition": 1,
    "hamming": 2,
    # ID 3 belonged to the removed extended-Hamming mode; do not reuse it.
    "hamming-interleaved": 4,
    "parity2d": 5,
}
CODING_NAMES = {value: key for key, value in CODING_IDS.items()}


@dataclass(frozen=True)
class CodingConfig:
    scheme: str = "none"
    repetitions: int = 1

    def validate(self) -> None:
        if self.scheme not in CODING_IDS:
            raise ValueError(f"unsupported coding scheme: {self.scheme}")
        if self.scheme == "repetition":
            if self.repetitions < 1 or self.repetitions % 2 == 0:
                raise ValueError("repetition factor must be a positive odd number")
        elif self.repetitions != 1:
            raise ValueError("repetition factor is only valid for repetition coding")


def config_from_id(coding_id: int, repetitions: int) -> CodingConfig:
    try:
        scheme = CODING_NAMES[coding_id]
    except KeyError as error:
        raise ValueError(f"unsupported coding identifier: {coding_id}") from error
    config = CodingConfig(scheme, repetitions)
    config.validate()
    return config


def encoded_length(information_bits: int, config: CodingConfig) -> int:
    config.validate()
    if information_bits < 0:
        raise ValueError("information bit length must be non-negative")
    if config.scheme == "none":
        return information_bits
    if config.scheme == "repetition":
        return information_bits * config.repetitions
    if config.scheme == "parity2d":
        return ceil(information_bits / 16) * 25
    return ceil(information_bits / 4) * 7


def encode(bits: list[int], config: CodingConfig) -> list[int]:
    config.validate()
    if any(bit not in (0, 1) for bit in bits):
        raise ValueError("coding input must contain binary values")
    if config.scheme == "none":
        return bits[:]
    if config.scheme == "repetition":
        return repetition.encode(bits, config.repetitions)
    if config.scheme == "parity2d":
        return parity2d.encode(bits + [0] * ((-len(bits)) % 16))
    padded = bits + [0] * ((-len(bits)) % 4)
    coded = hamming.encode(padded)
    return interleave(coded) if config.scheme == "hamming-interleaved" else coded


def decode(
    encoded_bits: list[int], information_length: int, config: CodingConfig
) -> tuple[list[int], int]:
    config.validate()
    expected_length = encoded_length(information_length, config)
    if len(encoded_bits) != expected_length:
        raise ValueError("encoded stream length does not match the frame header")
    if config.scheme == "none":
        return encoded_bits[:information_length], 0
    if config.scheme == "repetition":
        return repetition.decode(encoded_bits, config.repetitions), 0
    if config.scheme == "parity2d":
        decoded, corrected = parity2d.decode(encoded_bits)
        return decoded[:information_length], corrected
    if config.scheme == "hamming-interleaved":
        encoded_bits = deinterleave(encoded_bits)
    decoded, corrected = hamming.decode(encoded_bits)
    return decoded[:information_length], corrected

