"""Small dispatcher for the coding modes used by our frames."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from . import hamming, parity2d, repetition
from .interleaving import deinterleave, interleave
from .spreading import spread, unspread

CODING_IDS = {
    "none": 0,
    "repetition": 1,
    "hamming": 2,
    "hamming-interleaved": 3,
    "parity2d": 4,
    "repetition-spread": 5,
    "hamming-interleaved-16": 6,
}
CODING_NAMES = {value: key for key, value in CODING_IDS.items()}
REPETITION_SCHEMES = ("repetition", "repetition-spread")
INTERLEAVING_DEPTHS = {"hamming-interleaved": 8, "hamming-interleaved-16": 16}


@dataclass(frozen=True)
class CodingConfig:
    scheme: str = "none"
    repetitions: int = 1
    # Frame option: send the repetition-3 header in copy-major order. Payload coding ignores it.
    spread_header: bool = False

    def validate(self) -> None:
        if self.scheme not in CODING_IDS:
            raise ValueError(f"unsupported coding scheme: {self.scheme}")
        if self.scheme in REPETITION_SCHEMES:
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


def method_label(config: CodingConfig) -> str:
    """Readable name for tables and logs, such as ``repetition-spread x3 +sh``."""
    label = config.scheme
    if config.scheme in REPETITION_SCHEMES:
        label += f" x{config.repetitions}"
    return label + " +sh" if config.spread_header else label


def encoded_length(information_bits: int, config: CodingConfig) -> int:
    config.validate()
    if information_bits < 0:
        raise ValueError("information bit length must be non-negative")
    if config.scheme == "none":
        return information_bits
    if config.scheme in REPETITION_SCHEMES:
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
    if config.scheme == "repetition-spread":
        return spread(repetition.encode(bits, config.repetitions), config.repetitions)
    if config.scheme == "parity2d":
        return parity2d.encode(bits + [0] * ((-len(bits)) % 16))
    padded = bits + [0] * ((-len(bits)) % 4)
    coded = hamming.encode(padded)
    if config.scheme in INTERLEAVING_DEPTHS:
        return interleave(coded, INTERLEAVING_DEPTHS[config.scheme])
    return coded


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
    if config.scheme == "repetition-spread":
        adjacent = unspread(encoded_bits, config.repetitions)
        return repetition.decode(adjacent, config.repetitions), 0
    if config.scheme == "parity2d":
        decoded, corrected = parity2d.decode(encoded_bits)
        return decoded[:information_length], corrected
    if config.scheme in INTERLEAVING_DEPTHS:
        encoded_bits = deinterleave(encoded_bits, INTERLEAVING_DEPTHS[config.scheme])
    decoded, corrected = hamming.decode(encoded_bits)
    return decoded[:information_length], corrected
