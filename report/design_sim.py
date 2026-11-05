"""Whole-frame simulation over a fitted channel model, for design what-ifs.

Each candidate frame layout is sent through error sequences drawn from a fitted
Gilbert-Elliott model. A frame succeeds only if sync, header and payload CRC all pass,
matching the receiver. Layout options cover the two design levers the noise analysis
pointed to: how deep Hamming codewords are interleaved, and whether repetition copies
sit next to each other (as built) or are spread a whole message apart.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from gridlink.coding import hamming, repetition
from gridlink.coding.errors import UncorrectableError
from gridlink.coding.interleaving import deinterleave, interleave
from gridlink.coding.pipeline import CodingConfig, decode, encode
from gridlink.coding.spreading import spread, unspread
from gridlink.experiments.channel_model import GilbertElliott, sample_errors
from gridlink.protocol import (
    HEADER_CRC_LENGTH,
    HEADER_LENGTH,
    MAX_SYNC_MISMATCHES,
    SYNC_WORD,
    VERSION,
    bits_to_bytes,
    bytes_to_bits,
    crc16,
)


@dataclass(frozen=True)
class Layout:
    name: str
    scheme: str
    repetitions: int = 1
    depth: int = 8
    spread_repetition: bool = False
    spread_header: bool = False


def _encode_payload(bits: list[int], layout: Layout) -> list[int]:
    if layout.scheme == "repetition":
        coded = repetition.encode(bits, layout.repetitions)
        return spread(coded, layout.repetitions) if layout.spread_repetition else coded
    if layout.scheme == "hamming-interleaved":
        return interleave(hamming.encode(bits), layout.depth)
    return encode(bits, CodingConfig(layout.scheme, layout.repetitions))


def _decode_payload(bits: list[int], length: int, layout: Layout) -> list[int]:
    if layout.scheme == "repetition":
        if layout.spread_repetition:
            bits = unspread(bits, layout.repetitions)
        return repetition.decode(bits, layout.repetitions)
    if layout.scheme == "hamming-interleaved":
        return hamming.decode(deinterleave(bits, layout.depth))[0][:length]
    return decode(bits, length, CodingConfig(layout.scheme, layout.repetitions))[0]


def frame_success(
    model: GilbertElliott, layout: Layout, payload_bytes: int, trials: int, seed: int = 0
) -> dict[str, float]:
    rng = np.random.default_rng(seed)
    sync = bytes_to_bits(SYNC_WORD)
    ok = header_ok = payload_ok = 0
    for _ in range(trials):
        payload = bytes(rng.integers(0, 256, payload_bytes).tolist())
        protected = bytes_to_bits(payload + crc16(payload).to_bytes(2, "big"))
        header = bytes((VERSION, 1, layout.repetitions, 0)) + payload_bytes.to_bytes(2, "big")
        header_plain = bytes_to_bits(header + crc16(header).to_bytes(2, "big"))
        header_bits = repetition.encode(header_plain, 3)
        if layout.spread_header:
            header_bits = spread(header_bits, 3)
        body = _encode_payload(protected, layout)
        frame = sync + header_bits + body
        noise = sample_errors(model, len(frame), rng)
        noisy = [b ^ int(e) for b, e in zip(frame, noise)]

        sync_good = sum(noise[: len(sync)]) <= MAX_SYNC_MISMATCHES
        h = noisy[len(sync): len(sync) + len(header_bits)]
        if layout.spread_header:
            h = unspread(h, 3)
        block = bits_to_bytes(repetition.decode(h, 3))
        head_good = crc16(block[:HEADER_LENGTH]) == int.from_bytes(
            block[HEADER_LENGTH: HEADER_LENGTH + HEADER_CRC_LENGTH], "big"
        )
        try:
            decoded = _decode_payload(noisy[len(frame) - len(body):], len(protected), layout)
            data = bits_to_bytes(decoded)
            body_good = crc16(data[:-2]) == int.from_bytes(data[-2:], "big")
        except UncorrectableError:
            body_good = False
        header_ok += sync_good and head_good
        payload_ok += body_good
        ok += sync_good and head_good and body_good
    return {
        "frame": ok / trials, "header": header_ok / trials, "payload": payload_ok / trials,
        "bits": len(frame),
    }
