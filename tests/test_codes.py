import itertools

import pytest

from screencam.coding import hamming, parity2d, repetition
from screencam.coding.errors import UncorrectableError
from screencam.coding.interleaving import deinterleave, interleave
from screencam.coding.pipeline import CodingConfig, decode, encode, encoded_length

ALL_NIBBLES = [list(bits) for bits in itertools.product((0, 1), repeat=4)]
CONFIGS = [
    CodingConfig("none"),
    CodingConfig("repetition", 3),
    CodingConfig("repetition", 5),
    CodingConfig("repetition", 7),
    CodingConfig("hamming"),
    CodingConfig("hamming-interleaved"),
    CodingConfig("parity2d"),
]


@pytest.mark.parametrize("config", CONFIGS, ids=lambda c: f"{c.scheme}-{c.repetitions}")
def test_round_trip_without_noise(config):
    bits = [1, 0, 1, 1, 0, 0, 1, 0] * 4 + [1, 1, 0]
    encoded = encode(bits, config)
    assert len(encoded) == encoded_length(len(bits), config)
    assert decode(encoded, len(bits), config)[0] == bits


@pytest.mark.parametrize("factor", [3, 5, 7])
def test_repetition_corrects_up_to_half_the_copies(factor):
    encoded = repetition.encode([1, 0], factor)
    for flips in range(factor // 2 + 1):
        noisy = encoded[:]
        for index in range(flips):
            noisy[index] ^= 1
        assert repetition.decode(noisy, factor) == [1, 0]


def test_repetition_majority_fails_when_most_copies_flip():
    assert repetition.decode([0, 0, 1], 3) == [0]


def test_hamming_corrects_every_single_error_in_every_codeword():
    for data in ALL_NIBBLES:
        codeword = hamming.encode_nibble(data)
        for position in range(7):
            noisy = codeword[:]
            noisy[position] ^= 1
            decoded, corrected = hamming.decode_codeword(noisy)
            assert decoded == data and corrected


def test_hamming_miscorrects_every_double_error():
    for data in ALL_NIBBLES:
        codeword = hamming.encode_nibble(data)
        for first, second in itertools.combinations(range(7), 2):
            noisy = codeword[:]
            noisy[first] ^= 1
            noisy[second] ^= 1
            decoded, corrected = hamming.decode_codeword(noisy)
            assert corrected and decoded != data


def test_parity2d_corrects_any_single_error_and_rejects_doubles_in_one_row():
    data = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1]
    codeword = parity2d.encode(data)
    for position in range(25):
        noisy = codeword[:]
        noisy[position] ^= 1
        assert parity2d.decode(noisy) == (data, 1)
    noisy = codeword[:]
    noisy[0] ^= 1
    noisy[1] ^= 1
    with pytest.raises(UncorrectableError):
        parity2d.decode(noisy)


@pytest.mark.parametrize("depth", [1, 2, 4, 8, 16])
def test_interleaver_is_a_permutation(depth):
    bits = [(i * 7 + 3) % 2 for i in range(7 * 20)]
    assert deinterleave(interleave(bits, depth), depth) == bits


def test_interleaving_spreads_a_burst_up_to_depth_across_codewords():
    config = CodingConfig("hamming-interleaved")
    data = [1, 0, 0, 1] * 8
    encoded = encode(data, config)
    for start in range(len(encoded) - 8 + 1):
        noisy = encoded[:]
        for index in range(start, start + 8):
            noisy[index] ^= 1
        assert decode(noisy, len(data), config)[0] == data
