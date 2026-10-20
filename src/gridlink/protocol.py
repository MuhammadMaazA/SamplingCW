"""Bit-level framing for the optical channel."""

from __future__ import annotations

from dataclasses import dataclass

MAGIC = bytes((0xD3, 0x91))
VERSION = 1
HEADER_LENGTH = 6  # magic, version, sequence, payload length
PREAMBLE = bytes((0xAA, 0xAA, 0xAA, 0xAA))


@dataclass(frozen=True)
class Frame:
    payload: bytes
    sequence: int = 0


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


def build_frame(frame: Frame) -> list[int]:
    if not 0 <= frame.sequence <= 255:
        raise ValueError("sequence must fit in one byte")
    if len(frame.payload) > 65535:
        raise ValueError("payload is too large")
    body = (
        MAGIC
        + bytes((VERSION, frame.sequence))
        + len(frame.payload).to_bytes(2, "big")
        + frame.payload
    )
    return bytes_to_bits(PREAMBLE + body + crc16(body).to_bytes(2, "big"))


def parse_frame(bits: list[int]) -> Frame:
    raw = bits_to_bytes(bits)
    start = raw.find(MAGIC)
    if start < 0:
        raise ValueError("frame synchronisation marker not found")
    raw = raw[start:]
    if len(raw) < HEADER_LENGTH + 2:
        raise ValueError("incomplete frame")
    if raw[2] != VERSION:
        raise ValueError(f"unsupported protocol version: {raw[2]}")
    payload_length = int.from_bytes(raw[4:6], "big")
    total = HEADER_LENGTH + payload_length + 2
    if len(raw) < total:
        raise ValueError("incomplete payload")
    encoded = raw[:total]
    if crc16(encoded[:-2]) != int.from_bytes(encoded[-2:], "big"):
        raise ValueError("CRC check failed")
    return Frame(payload=encoded[6:-2], sequence=encoded[3])

