"""Generate clean report figures from GridLink experiment data.

Reads the merged error-positions.csv (per-trial error bit positions) and a few
summary numbers taken from summary.csv, and writes two publication-style figures
into report/figures/. Run with the project venv python.
"""
from __future__ import annotations

import csv
from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
RESULTS = HERE.parent / "experiments" / "results" / "report-final"
FIGDIR = HERE / "figures"
FIGDIR.mkdir(exist_ok=True)

# ---- clean, consistent style -------------------------------------------------
INK = "#22272e"
BLUE = "#3b6ea5"      # isolated-flip regime
CLAY = "#c1553b"      # burst regime
GREY = "#d7dbe0"      # unobserved / neutral
mpl.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.edgecolor": INK,
    "axes.linewidth": 0.8,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.titlesize": 10.5,
    "axes.titleweight": "bold",
    "axes.labelcolor": INK,
    "text.color": INK,
    "xtick.color": INK,
    "ytick.color": INK,
    "figure.dpi": 200,
})

# Trials chosen from error-positions.csv to represent each regime.
# Isolated flips: the fast 8 bps direct-screen Hamming trials (all run length 1).
ISOLATED_RUNS = {"final-007", "final-012", "final-016"}
# Bursts: the glare/dim repetition-3 trials (long consecutive error runs).
BURST_RUNS = {"quiet1-001", "quiet1-002"}
ISOLATED_SRC = "final-comparison"
BURST_SRC = "quiet1b-lab"


def load_trials():
    iso, burst = [], []
    with open(RESULTS / "error-positions.csv", newline="") as fh:
        for row in csv.DictReader(fh):
            rid = row["run_id"]
            src = row["source"]
            positions = [int(x) for x in row["error_positions"].split()] if row["error_positions"] else []
            obs = int(row["observed_bits"])
            tail = int(row["unavailable_tail_bits"])
            rec = {"rid": rid, "pos": positions, "obs": obs, "tail": tail}
            if rid in ISOLATED_RUNS and ISOLATED_SRC in src:
                iso.append(rec)
            elif rid in BURST_RUNS and BURST_SRC in src:
                burst.append(rec)
    return iso, burst


def run_lengths(trials):
    """Consecutive-error run lengths aggregated over the given trials."""
    lengths = []
    for t in trials:
        pos = sorted(t["pos"])
        if not pos:
            continue
        start = prev = pos[0]
        for p in pos[1:]:
            if p == prev + 1:
                prev = p
            else:
                lengths.append(prev - start + 1)
                start = prev = p
        lengths.append(prev - start + 1)
    return lengths


# -----------------------------------------------------------------------------
def fig_noise_regimes(iso, burst):
    iso_runs = run_lengths(iso)
    burst_runs = run_lengths(burst)

    # Bin run lengths into readable buckets as a proportion of all runs.
    bins = [(1, 1), (2, 2), (3, 4), (5, 7), (8, 12), (13, 99)]
    labels = ["1", "2", "3-4", "5-7", "8-12", "13+"]

    def frac(runs):
        runs = np.array(runs)
        n = max(len(runs), 1)
        return [np.sum((runs >= lo) & (runs <= hi)) / n for lo, hi in bins]

    iso_frac = frac(iso_runs)
    burst_frac = frac(burst_runs)

    fig = plt.figure(figsize=(7.2, 5.1))
    gs = fig.add_gridspec(2, 1, height_ratios=[1.0, 1.05], hspace=0.95)

    # --- top: error-position rasters ---
    ax0 = fig.add_subplot(gs[0])
    tracks = [("isolated", iso, BLUE), ("burst", burst, CLAY)]
    y = 0
    yticks, ylabels = [], []
    for name, trials, colour in tracks:
        for t in trials:
            total = t["obs"] + t["tail"]
            # unobserved tail as a light background bar
            if t["tail"]:
                ax0.add_patch(plt.Rectangle((t["obs"], y - 0.4), t["tail"], 0.8,
                                            color=GREY, lw=0))
            for p in t["pos"]:
                ax0.add_patch(plt.Rectangle((p - 0.5, y - 0.4), 1.0, 0.8,
                                            color=colour, lw=0))
            yticks.append(y)
            ylabels.append(name)
            y += 1
        y += 0.6
    ax0.set_xlim(0, 400)
    ax0.set_ylim(-0.7, y - 0.6)
    ax0.invert_yaxis()
    ax0.set_yticks(yticks)
    ax0.set_yticklabels(ylabels, fontsize=8)
    ax0.set_xlabel("Transmitted frame bit position")
    ax0.set_title("(a) Where errors fall, isolated flips vs clustered bursts", loc="left")
    # legend
    handles = [plt.Rectangle((0, 0), 1, 1, color=BLUE),
               plt.Rectangle((0, 0), 1, 1, color=CLAY),
               plt.Rectangle((0, 0), 1, 1, color=GREY)]
    ax0.legend(handles, ["isolated-flip trial", "burst trial", "unobserved tail"],
               loc="upper center", bbox_to_anchor=(0.5, -0.32), ncol=3,
               frameon=False, fontsize=8, handlelength=1.1, columnspacing=1.4)

    # --- bottom: run-length distribution ---
    ax1 = fig.add_subplot(gs[1])
    x = np.arange(len(labels))
    w = 0.4
    ax1.bar(x - w / 2, iso_frac, w, color=BLUE, label="isolated flips (8 bps, direct)")
    ax1.bar(x + w / 2, burst_frac, w, color=CLAY, label="bursts (glare / dim)")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.set_xlabel("Consecutive error-run length (bits)")
    ax1.set_ylabel("Proportion of error runs")
    ax1.set_ylim(0, 1.0)
    ax1.yaxis.grid(True, color="#eef0f3", lw=0.9)
    ax1.set_axisbelow(True)
    ax1.set_title("(b) Error-run length distribution", loc="left")
    ax1.legend(frameon=False, fontsize=8, loc="upper right")

    fig.savefig(FIGDIR / "noise-regimes.png", bbox_inches="tight")
    plt.close(fig)
    return iso_runs, burst_runs


def fig_highnoise_bars():
    # 8 bps direct-screen slice (from summary.csv G08-G14). Decoded BER; uncoded = reference.
    methods = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."]
    decoded = [0.0417, 0.0104, 0.0312, 0.0, 0.0729, 0.0, 0.0417]
    frames = ["0/3", "2/3", "2/3", "3/3", "0/3", "1/3", "3/3"]
    uncoded = 0.0417

    colours = []
    for m, d in zip(methods, decoded):
        if m == "none":
            colours.append("#8a929b")
        elif d > uncoded + 1e-9:
            colours.append(CLAY)          # worse than uncoded
        else:
            colours.append(BLUE)          # at or better than uncoded

    fig, ax = plt.subplots(figsize=(7.2, 3.2))
    x = np.arange(len(methods))
    bars = ax.bar(x, decoded, 0.62, color=colours)
    ax.axhline(uncoded, color="#8a929b", ls="--", lw=1.1)
    ax.text(3.0, uncoded + 0.0016, "uncoded baseline", ha="center", va="bottom",
            fontsize=8, color="#5b636b")
    for xi, d in enumerate(decoded):
        ax.text(xi, d + 0.0016, f"{d:.3f}".rstrip("0").rstrip(".") if d else "0",
                ha="center", va="bottom", fontsize=8)
    ax.set_xticks(x)
    ax.set_xticklabels([f"{m}\n({fr})" for m, fr in zip(methods, frames)])
    ax.set_ylabel("Decoded BER")
    ax.set_ylim(0, 0.085)
    ax.yaxis.grid(True, color="#eef0f3", lw=0.9)
    ax.set_axisbelow(True)
    ax.set_title("High-noise slice (8 bps, direct). Hamming miscorrects above uncoded,\n"
                 "repetition-7 and 2-D parity reach zero error (x-labels show frames delivered)",
                 loc="left", fontsize=9.5)
    fig.savefig(FIGDIR / "highnoise-bars.png", bbox_inches="tight")
    plt.close(fig)


def main():
    iso, burst = load_trials()
    iso_runs, burst_runs = fig_noise_regimes(iso, burst)
    fig_highnoise_bars()
    # print quick stats for the write-up
    def share_ge3(runs):
        runs = np.array(runs)
        errs = runs.sum()
        return runs[runs >= 3].sum() / errs if errs else 0.0
    print(f"isolated: {len(iso)} trials, {sum(len(t['pos']) for t in iso)} errors, "
          f"max run {max(iso_runs) if iso_runs else 0}, share in runs>=3 {share_ge3(iso_runs):.0%}")
    print(f"burst:    {len(burst)} trials, {sum(len(t['pos']) for t in burst)} errors, "
          f"max run {max(burst_runs) if burst_runs else 0}, share in runs>=3 {share_ge3(burst_runs):.0%}")
    print("wrote", FIGDIR / "noise-regimes.png", "and", FIGDIR / "highnoise-bars.png")


if __name__ == "__main__":
    main()
