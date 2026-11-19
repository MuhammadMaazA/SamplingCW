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
from .coding.spreading import spread, unspread

MAGIC = bytes((0xD3, 0x91))
VERSION = 2
PREAMBLE = bytes((0xAA, 0xAA, 0xAA, 0xAA))
SYNC_WORD = PREAMBLE + MAGIC
HEADER_LENGTH = 6
HEADER_CRC_LENGTH = 2
# One fixed code for every frame, so header losses do not depend on the payload code.
HEADER_CODING = CodingConfig("repetition", 3)
HEADER_PLAIN_BITS = (HEADER_LENGTH + HEADER_CRC_LENGTH) * 8
SYNC_BITS = len(SYNC_WORD) * 8
HEADER_CODED_BITS = encoded_length(HEADER_PLAIN_BITS, HEADER_CODING)
FRAME_OVERHEAD_BITS = SYNC_BITS + HEADER_CODED_BITS
MAX_SYNC_MISMATCHES = 9


@dataclass(frozen=True)
class Frame:
    payload: bytes
    sequence: int = 0
    coding: str = "none"
    repetitions: int = 1
    corrected_codewords: int = 0
    spread_header: bool = False


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
    """Position of the best matching sync word, or -1 if none is close enough.

    A few wrong bits are allowed so one bad sync bit does not lose the frame. The bytes after the
    alternating preamble make shifts by whole symbols match badly.
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


def _encode_header(header: bytes, spread_header: bool) -> list[int]:
    bits = encode(bytes_to_bits(header + crc16(header).to_bytes(2, "big")), HEADER_CODING)
    return spread(bits, HEADER_CODING.repetitions) if spread_header else bits


def _decode_header(bits: list[int], spread_header: bool) -> bytes:
    """Return the six header bytes, or raise if the CRC or version check fails."""
    if spread_header:
        bits = unspread(bits, HEADER_CODING.repetitions)
    block = bits_to_bytes(decode(bits, HEADER_PLAIN_BITS, HEADER_CODING)[0])
    header = block[:HEADER_LENGTH]
    if crc16(header) != int.from_bytes(block[HEADER_LENGTH:], "big"):
        raise ValueError("header CRC check failed")
    if header[0] != VERSION:
        raise ValueError(f"unsupported protocol version: {header[0]}")
    return header


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
    header_bits = _encode_header(header, frame.spread_header)
    return bytes_to_bits(SYNC_WORD) + header_bits + encoded_bits


def parse_frame(bits: list[int], spread_header: bool | None = None) -> Frame:
    """Decode one frame after the first sync word.

    We cannot know the header layout before reading it, so the normal layout is tried first and
    the spread one if that fails. The analysis already knows the layout, so it passes it in.
    """
    start = find_sync(bits)
    if start < 0:
        raise ValueError("frame synchronisation marker not found")
    header_start = start + SYNC_BITS
    header_end = header_start + HEADER_CODED_BITS
    if len(bits) < header_end:
        raise ValueError("incomplete frame header")
    layouts = (False, True) if spread_header is None else (spread_header,)
    first_error = None
    for layout in layouts:
        try:
            header = _decode_header(bits[header_start:header_end], layout)
        except ValueError as error:
            first_error = first_error or error
        else:
            break
    else:
        raise first_error
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
        spread_header=layout,
    )
