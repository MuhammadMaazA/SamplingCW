"""Self-describing bit-level frames for the optical channel."""

from __future__ import annotations

from dataclasses import dataclass

from .coding.pipeline import (
    CODING_IDS,
    CodingConfig,
    config_from_id,
    decode,
    encode,
    encoded_length,
)

MAGIC = bytes((0xD3, 0x91))
VERSION = 2
PREAMBLE = bytes((0xAA, 0xAA, 0xAA, 0xAA))
SYNC_WORD = PREAMBLE + MAGIC
HEADER_LENGTH = 6
HEADER_CRC_LENGTH = 2
# One fixed code for every frame, so header losses do not depend on the payload code.
HEADER_CODING = CodingConfig("repetition", 3)
SYNC_BITS = len(SYNC_WORD) * 8
HEADER_CODED_BITS = encoded_length((HEADER_LENGTH + HEADER_CRC_LENGTH) * 8, HEADER_CODING)
FRAME_OVERHEAD_BITS = SYNC_BITS + HEADER_CODED_BITS
MAX_SYNC_MISMATCHES = 9


@dataclass(frozen=True)
class Frame:
    payload: bytes
    sequence: int = 0
    coding: str = "none"
    repetitions: int = 1
    corrected_codewords: int = 0


def bytes_to_bits(data: bytes) -> list[int]:
    """Return bytes in transmission order, most-significant bit first."""
    return [(byte >> shift) & 1 for byte in data for shift in range(7, -1, -1)]


def bits_to_bytes(bits: list[int]) -> bytes:
    if len(bits) % 8:
        raise ValueError("bit stream length must be a multiple of eight")
    return bytes(
        sum(bit << (7 - offset) for offset, bit in enumerate(bits[index : index + 8]))
        for index in range(0, len(bits), 8)
    )


def crc16(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def find_sync(bits: list[int], maximum_mismatches: int = MAX_SYNC_MISMATCHES) -> int:
    """Return the earliest best-matching sync word position, or -1 if none is close enough.

    Tolerating a few flipped bits stops one corrupted sync bit from losing a whole frame.
    The magic bytes after the alternating preamble make whole-symbol shifts score badly.
    """
    pattern = bytes_to_bits(SYNC_WORD)
    width = len(pattern)
    best_start, best_mismatches = -1, maximum_mismatches + 1
    for start in range(len(bits) - width + 1):
        mismatches = sum(
            left != right for left, right in zip(bits[start : start + width], pattern)
        )
        if mismatches < best_mismatches:
            best_start, best_mismatches = start, mismatches
            if mismatches == 0:
                break
    return best_start


def build_frame(frame: Frame) -> list[int]:
    if not 0 <= frame.sequence <= 255:
        raise ValueError("sequence must fit in one byte")
    if len(frame.payload) > 65535:
        raise ValueError("payload is too large")
    config = CodingConfig(frame.coding, frame.repetitions)
    config.validate()
    protected = frame.payload + crc16(frame.payload).to_bytes(2, "big")
    encoded_bits = encode(bytes_to_bits(protected), config)
    header = bytes(
        (VERSION, CODING_IDS[config.scheme], config.repetitions, frame.sequence)
    ) + len(frame.payload).to_bytes(2, "big")
    header_bits = encode(
        bytes_to_bits(header + crc16(header).to_bytes(2, "big")), HEADER_CODING
    )
    return bytes_to_bits(SYNC_WORD) + header_bits + encoded_bits


def parse_frame(bits: list[int]) -> Frame:
    start = find_sync(bits)
    if start < 0:
        raise ValueError("frame synchronisation marker not found")
    header_start = start + SYNC_BITS
    header_end = header_start + HEADER_CODED_BITS
    if len(bits) < header_end:
        raise ValueError("incomplete frame header")
    header_bits, _ = decode(
        bits[header_start:header_end], (HEADER_LENGTH + HEADER_CRC_LENGTH) * 8, HEADER_CODING
    )
    block = bits_to_bytes(header_bits)
    header = block[:HEADER_LENGTH]
    if crc16(header) != int.from_bytes(block[HEADER_LENGTH:], "big"):
        raise ValueError("header CRC check failed")
    if header[0] != VERSION:
        raise ValueError(f"unsupported protocol version: {header[0]}")
    config = config_from_id(header[1], header[2])
    sequence = header[3]
    payload_length = int.from_bytes(header[4:6], "big")
    protected_length = (payload_length + 2) * 8
    data_end = header_end + encoded_length(protected_length, config)
    if len(bits) < data_end:
        raise ValueError("incomplete transmission")
    protected_bits, corrected = decode(bits[header_end:data_end], protected_length, config)
    protected = bits_to_bytes(protected_bits)
    payload = protected[:-2]
    received_crc = int.from_bytes(protected[-2:], "big")
    if crc16(payload) != received_crc:
        raise ValueError("CRC check failed")
    return Frame(
        payload=payload,
        sequence=sequence,
        coding=config.scheme,
        repetitions=config.repetitions,
        corrected_codewords=corrected,
    )

