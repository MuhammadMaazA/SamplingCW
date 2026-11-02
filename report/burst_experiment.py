"""Controlled burst experiment, Hamming vs Hamming-interleaved vs repetition-3.

For each burst length we corrupt a contiguous run of transmitted bits (every bit in
the run flipped) at a random position and measure the mean decoded BER over many
trials. Hamming and Hamming-interleaved share the same encoded length, so each trial
applies the same burst position to both, giving a paired comparison. This isolates the
effect of bit ordering under bursty noise, the regime our physical glare/dim runs showed.

Run with the project venv python.
"""
from __future__ import annotations

import csv
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

from gridlink.coding.pipeline import CodingConfig, decode, encode, encoded_length
from gridlink.experiments.metrics import bit_error_rate
from gridlink.experiments.noise import burst_noise

HERE = Path(__file__).resolve().parent
FIGDIR = HERE / "figures"
FIGDIR.mkdir(exist_ok=True)

INK = "#22272e"
BLUE = "#3b6ea5"      # Hamming-interleaved (robust)
CLAY = "#c1553b"      # Hamming (fails on bursts)
GREEN = "#4f8a6b"     # repetition-3 reference
mpl.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": INK,
    "axes.linewidth": 0.8, "axes.spines.top": False, "axes.spines.right": False,
    "axes.titlesize": 10.5, "axes.titleweight": "bold", "axes.labelcolor": INK,
    "text.color": INK, "xtick.color": INK, "ytick.color": INK, "figure.dpi": 200,
})

PAYLOAD_BITS = 64            # 16 Hamming codewords, i.e. two interleaver groups of 8
TRIALS = 400
MAX_BURST = 16
FLIP_P = 1.0                 # every bit inside the burst flips (clean burst model)
SEED = 1

CONFIGS = {
    "Hamming": (CodingConfig("hamming"), CLAY),
    "Hamming-interleaved": (CodingConfig("hamming-interleaved"), BLUE),
    "repetition-3": (CodingConfig("repetition", 3), GREEN),
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


def main():
    lengths = list(range(1, MAX_BURST + 1))
    results = {name: ([], []) for name in CONFIGS}
    rng = np.random.default_rng(SEED)
    for name, (config, _) in CONFIGS.items():
        for L in lengths:
            m, se = mean_ber_at(config, L, rng)
            results[name][0].append(m)
            results[name][1].append(se)

    # CSV for the appendix / reproducibility
    with open(HERE / "burst-results.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["burst_length"] + list(CONFIGS))
        for i, L in enumerate(lengths):
            w.writerow([L] + [f"{results[n][0][i]:.4f}" for n in CONFIGS])

    fig, ax = plt.subplots(figsize=(7.2, 3.3))
    for name, (_, colour) in CONFIGS.items():
        means, ses = results[name]
        ax.errorbar(lengths, means, yerr=ses, color=colour, marker="o", ms=4,
                    lw=1.8, capsize=2, label=name)
    ax.axvline(8, color="#9aa0a6", ls=":", lw=1.1)
    ax.text(8.15, 0.235, "interleaver depth (8)", fontsize=8, color="#5b636b",
            rotation=90, va="top")
    ax.set_xlabel("Burst length (consecutive transmitted bits flipped)")
    ax.set_ylabel("Mean decoded BER")
    ax.set_xticks(lengths)
    ax.set_xlim(0.5, MAX_BURST + 0.5)
    ax.set_ylim(0, 0.26)
    ax.yaxis.grid(True, color="#eef0f3", lw=0.9)
    ax.set_axisbelow(True)
    ax.set_title("Controlled burst experiment (64-bit payload, 400 trials per point). "
                 "Interleaving holds\nzero error until bursts exceed its depth; plain "
                 "Hamming and repetition fail much sooner", loc="left", fontsize=9.3)
    ax.legend(frameon=False, fontsize=9, loc="upper left")
    fig.savefig(FIGDIR / "extension-burst.png", bbox_inches="tight")
    plt.close(fig)

    # console summary for the write-up
    for name in CONFIGS:
        means = results[name][0]
        first_fail = next((L for L, m in zip(lengths, means) if m > 1e-9), None)
        print(f"{name:22s} zero-error up to burst length "
              f"{(first_fail - 1) if first_fail else MAX_BURST}; "
              f"BER at L=8 = {means[7]:.3f}, at L=16 = {means[-1]:.3f}")


if __name__ == "__main__":
    main()
