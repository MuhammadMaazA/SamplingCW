import pytest

from gridlink.protocol import (
    FRAME_OVERHEAD_BITS,
    SYNC_BITS,
    Frame,
    build_frame,
    crc16,
    parse_frame,
)


def test_crc16_matches_ccitt_false_check_value():
    assert crc16(b"123456789") == 0x29B1


@pytest.mark.parametrize("coding,repetitions", [
    ("none", 1), ("repetition", 3), ("hamming", 1), ("hamming-interleaved", 1), ("parity2d", 1),
])
def test_frame_round_trip(coding, repetitions):
    frame = Frame(b"Hi", sequence=7, coding=coding, repetitions=repetitions)
    bits = build_frame(frame)
    assert parse_frame([0, 1, 1] + bits + [0, 0]).payload == b"Hi"


def test_frame_overhead_is_sync_plus_repeated_header():
    assert FRAME_OVERHEAD_BITS == 48 + 3 * 64
    assert len(build_frame(Frame(b"", coding="none"))) == FRAME_OVERHEAD_BITS + 16


def test_sync_tolerates_a_few_flipped_bits():
    bits = build_frame(Frame(b"ok", coding="hamming"))
    for index in (3, 20, 41):
        bits[index] ^= 1
    assert parse_frame(bits).payload == b"ok"


def test_crc_detects_uncorrected_payload_damage():
    bits = build_frame(Frame(b"ok", coding="none"))
    bits[FRAME_OVERHEAD_BITS + 2] ^= 1
    with pytest.raises(ValueError, match="CRC"):
        parse_frame(bits)


def test_repeated_header_survives_one_flip_per_bit_group():
    bits = build_frame(Frame(b"ok", coding="none"))
    for group in range(0, 64, 5):
        bits[SYNC_BITS + 3 * group] ^= 1
    assert parse_frame(bits).payload == b"ok"
