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
VERSION = 1
PREAMBLE = bytes((0xAA, 0xAA, 0xAA, 0xAA))
HEADER_LENGTH = 16
HEADER_CRC_LENGTH = 2


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


def _find_bits(bits: list[int], pattern: list[int]) -> int:
    width = len(pattern)
    for start in range(len(bits) - width + 1):
        if bits[start : start + width] == pattern:
            return start
    return -1


def build_frame(frame: Frame) -> list[int]:
    if not 0 <= frame.sequence <= 255:
        raise ValueError("sequence must fit in one byte")
    if len(frame.payload) > 65535:
        raise ValueError("payload is too large")
    config = CodingConfig(frame.coding, frame.repetitions)
    config.validate()
    protected = frame.payload + crc16(frame.payload).to_bytes(2, "big")
    protected_bits = bytes_to_bits(protected)
    encoded_bits = encode(protected_bits, config)
    header = (
        MAGIC
        + bytes((VERSION, CODING_IDS[config.scheme], config.repetitions, frame.sequence))
        + len(frame.payload).to_bytes(2, "big")
        + len(protected_bits).to_bytes(4, "big")
        + len(encoded_bits).to_bytes(4, "big")
    )
    # The header remains readable before FEC decoding and has its own CRC.
    return bytes_to_bits(PREAMBLE + header + crc16(header).to_bytes(2, "big")) + encoded_bits


def parse_frame(bits: list[int]) -> Frame:
    preamble_bits = bytes_to_bits(PREAMBLE)
    start = _find_bits(bits, preamble_bits)
    if start < 0:
        raise ValueError("frame synchronisation marker not found")
    header_start = start + len(preamble_bits)
    header_end = header_start + HEADER_LENGTH * 8
    header_crc_end = header_end + HEADER_CRC_LENGTH * 8
    if len(bits) < header_crc_end:
        raise ValueError("incomplete frame header")
    header = bits_to_bytes(bits[header_start:header_end])
    received_header_crc = int.from_bytes(bits_to_bytes(bits[header_end:header_crc_end]), "big")
    if crc16(header) != received_header_crc:
        raise ValueError("header CRC check failed")
    if header[:2] != MAGIC:
        raise ValueError("frame marker not found")
    if header[2] != VERSION:
        raise ValueError(f"unsupported protocol version: {header[2]}")
    config = config_from_id(header[3], header[4])
    sequence = header[5]
    payload_length = int.from_bytes(header[6:8], "big")
    protected_length = int.from_bytes(header[8:12], "big")
    encoded_length_in_header = int.from_bytes(header[12:16], "big")
    expected_protected_length = (payload_length + 2) * 8
    if protected_length != expected_protected_length:
        raise ValueError("protected length does not match payload length")
    if encoded_length(protected_length, config) != encoded_length_in_header:
        raise ValueError("encoded length does not match coding configuration")
    data_start = header_crc_end
    data_end = data_start + encoded_length_in_header
    if len(bits) < data_end:
        raise ValueError("incomplete transmission")
    protected_bits, corrected = decode(bits[data_start:data_end], protected_length, config)
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

