"""Controlled burst experiment, Hamming vs Hamming-interleaved vs repetition-3.

For each burst length we corrupt a contiguous run of transmitted bits (every bit in
the run flipped) at a random position and measure the mean decoded BER over many
trials. The comparison is not paired. Each code draws its own fresh payload and burst
positions from one shared generator, so each point is an independent average. Hamming and
Hamming-interleaved share code and rate, so the gap between them reflects bit ordering
under bursty noise, the regime our physical glare runs showed.

make_figures.py calls run() and plots the result; running this file writes the CSV only.
"""
from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

from gridlink.coding.pipeline import CodingConfig, decode, encode, encoded_length
from gridlink.experiments.metrics import bit_error_rate
from gridlink.experiments.noise import burst_noise

HERE = Path(__file__).resolve().parent

PAYLOAD_BITS = 64            # 16 Hamming codewords, i.e. two interleaver groups of 8
TRIALS = 400
MAX_BURST = 16
FLIP_P = 1.0                 # every bit inside the burst flips (clean burst model)
SEED = 1

CONFIGS = {
    "Hamming": CodingConfig("hamming"),
    "Hamming-interleaved": CodingConfig("hamming-interleaved"),
    "repetition-3": CodingConfig("repetition", 3),
}


def mean_ber_at(config, length, rng):
    enc_len = encoded_length(PAYLOAD_BITS, config)
    bits = [int(b) for b in rng.integers(0, 2, PAYLOAD_BITS)]
    encoded = encode(bits, config)
    bers = []
    for t in range(TRIALS):
        start = int(rng.integers(0, enc_len - length + 1))
        received = burst_noise(encoded, start, length, FLIP_P, SEED + t)
        decoded, _ = decode(received, PAYLOAD_BITS, config)
        bers.append(bit_error_rate(bits, decoded))
    return float(np.mean(bers)), float(np.std(bers) / np.sqrt(TRIALS))


def run() -> dict[str, tuple[list[float], list[float]]]:
    rng = np.random.default_rng(SEED)
    results = {}
    for name, config in CONFIGS.items():
        pairs = [mean_ber_at(config, length, rng) for length in range(1, MAX_BURST + 1)]
        results[name] = ([m for m, _ in pairs], [s for _, s in pairs])
    return results


def main():
    results = run()
    with open(HERE / "generated" / "burst-results.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["burst_length"] + [f"{n} {k}" for n in CONFIGS for k in ("mean", "se")])
        for i in range(MAX_BURST):
            w.writerow([i + 1] + [f"{results[n][j][i]:.4f}" for n in CONFIGS for j in (0, 1)])


if __name__ == "__main__":
    main()
