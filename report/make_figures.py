"""Regenerate every report figure, table row and quoted statistic from the per-trial data.

Inputs are the analysed results CSVs listed in data.SOURCES, read from experiments/results
or, if that is missing, from ../gridlink-results-backup/results, plus the layouts session in
PHYS_DIR. Outputs go to report/figures/ (IEEE-style vector PDF plus a PNG copy) and
report/generated/, which report.tex includes directly. Numbers in the new physical-test text
come from generated/physical.tex macros.

Run from the repository root with the project venv:
    .venv/bin/python report/make_figures.py
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib as mpl
from matplotlib import font_manager

mpl.use("Agg")
import burst_experiment
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np
from matplotlib.patches import Patch
from data import METHOD_ORDER, RESULTS, by_slice, load
from design_sim import Layout, frame_success

from gridlink.experiments.analysis import summarise_records
from gridlink.experiments.recording import read_csv
from gridlink.experiments.channel_model import (
    bic,
    fit_gilbert_elliott,
    memoryless_log_likelihood,
    run_position_context,
    sample_errors,
)
from gridlink.experiments.stats import (
    bootstrap_ratio_interval,
    burst_share,
    burstiness_permutation_test,
    fisher_exact,
    run_lengths,
    wilson_interval,
)
from gridlink.protocol import FRAME_OVERHEAD_BITS, HEADER_CRC_LENGTH, HEADER_LENGTH

HERE = Path(__file__).resolve().parent
FIGDIR = HERE / "figures"
GENDIR = HERE / "generated"
FIGDIR.mkdir(exist_ok=True)
GENDIR.mkdir(exist_ok=True)

# IEEE figure style. Figures are drawn at their printed width so fonts print at true size.
FULL_WIDTH = 7.14    # in, IEEEtran A4 text width (516 pt)
SINGLE_COL = 3.48    # in, IEEEtran A4 column width (252 pt)
# Palette. Colour carries meaning and every figure also reads in greyscale through line style,
# marker shape and hatch. INK is the baseline, facing the screen, clean and delivered. GREY2 is
# neutral. ACCENT is glare, errors, bursts and the new spread and deep layouts.
INK = "#111111"
GREY1 = "#4D4D4D"
GREY2 = "#8C8C8C"
GREY3 = "#CFCFCF"
GREY4 = "#EDEDED"
ACCENT = "#D9381E"
BLACK = INK
LIGHT = GREY3


def tint(colour, amount):
    """Colour mixed with white, amount 1 is the colour itself."""
    c = np.array(mpl.colors.to_rgb(colour))
    return tuple(1 - amount * (1 - c))


FONT_DIR = Path("C:/Windows/Fonts")
FONT_FILES = ("GIL_____.TTF", "GILB____.TTF", "GILI____.TTF")
if all((FONT_DIR / f).exists() for f in FONT_FILES):
    for f in FONT_FILES:
        font_manager.fontManager.addfont(str(FONT_DIR / f))
    FIG_FONT = "Gill Sans MT"
else:
    FIG_FONT = "DejaVu Sans"
    print("Gill Sans MT not found, figures fall back to DejaVu Sans")

mpl.rcParams.update({
    "font.family": FIG_FONT,
    "mathtext.default": "regular",
    "axes.unicode_minus": False,
    "font.size": 8, "axes.labelsize": 8, "axes.titlesize": 8,
    "xtick.labelsize": 7.5, "ytick.labelsize": 7.5, "legend.fontsize": 7.5,
    "axes.linewidth": 0.7, "axes.edgecolor": INK, "axes.labelcolor": INK,
    "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.spines.top": True, "axes.spines.right": True,
    "xtick.direction": "in", "ytick.direction": "in", "xtick.top": True, "ytick.right": True,
    "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.major.size": 3, "ytick.major.size": 3,
    "lines.linewidth": 1.1, "lines.markersize": 3.5, "hatch.linewidth": 0.5,
    "errorbar.capsize": 2,
    "grid.color": GREY3, "grid.linestyle": ":", "grid.linewidth": 0.5,
    "legend.frameon": False, "legend.handlelength": 1.8, "legend.borderaxespad": 0.4,
    "savefig.dpi": 600, "pdf.fonttype": 42, "ps.fonttype": 42,
})


def panel_label(ax, text):
    """Panel label such as (a) just above the top-left corner of the axes."""
    ax.text(0.0, 1.02, text, transform=ax.transAxes, ha="left", va="bottom", fontsize=8,
            fontweight="bold")


def save(fig, name):
    """Write vector PDF for the report and a PNG copy for slides."""
    fig.savefig(FIGDIR / f"{name}.pdf", bbox_inches="tight", pad_inches=0.02)
    fig.savefig(FIGDIR / f"{name}.png", bbox_inches="tight", pad_inches=0.02, dpi=300)
    plt.close(fig)


NL = chr(10)
FAST, CLEAN, GLARE, SLOW = "8 bps facing", "4 bps reflection", "4 bps glare", "2 bps glare"
QUIET = "3 bps facing"
RATES = {"none": "1", "rep-3": "1/3", "rep-5": "1/5", "rep-7": "1/7", "Hamming": "4/7",
         "Ham-interl.": "4/7", "2-D parity": "16/25"}
STATS: dict = {}


def by_method(trials):
    out = defaultdict(list)
    for trial in trials:
        out[trial.method].append(trial)
    return out


def ci_text(low, high, places=3):
    return f"[{low:.{places}f}, {high:.{places}f}]"


# ---------------------------------------------------------------- slice tables
def method_stats(trials):
    records = [t.record for t in trials]
    summary = summarise_records(records)[0]
    ok = sum(r.frame_valid for r in records)
    decodable = [r for r in records if r.decoded_bit_errors is not None]
    out = {
        "trials": len(records), "ok": ok, "frames_ci": wilson_interval(ok, len(records)),
        "channel_ber": summary.channel_ber, "decoded_ber": summary.decoded_ber,
        "throughput": summary.useful_throughput_bps,
        "channel_ci": bootstrap_ratio_interval(
            [len(t.error_positions) for t in trials], [t.observed for t in trials]),
    }
    if decodable:
        out["decoded_ci"] = bootstrap_ratio_interval(
            [r.decoded_bit_errors for r in decodable], [r.information_bits for r in decodable])
    return out


def write_tables(slices):
    clean = by_method(slices[CLEAN])
    rows = []
    for method in METHOD_ORDER:
        s = method_stats(clean[method])
        rows.append(f"{method} & {RATES[method]} & {s['throughput']:.3f} & "
                    f"{s['ok']}/{s['trials']} {ci_text(*s['frames_ci'], 2)} \\\\")
    (GENDIR / "table-clean.tex").write_text("\n".join(rows) + "\n")

    fast = by_method(slices[FAST])
    rows, STATS["fast"] = [], {}
    for method in METHOD_ORDER:
        s = method_stats(fast[method])
        STATS["fast"][method] = s
        dec = (f"{s['decoded_ber']:.3f} {ci_text(*s['decoded_ci'], 2)}"
               if s["decoded_ber"] is not None else "n/a")
        thr = f"{s['throughput']:.3f}" if s["throughput"] else "0"
        rows.append(f"{method} & {s['channel_ber']:.3f} & {dec} & {thr} & "
                    f"{s['ok']}/{s['trials']} {ci_text(*s['frames_ci'], 2)} \\\\")
    (GENDIR / "table-fast.tex").write_text("\n".join(rows) + "\n")

    # One wide table with both slices side by side, the layout used in the report.
    rows = []
    for method in METHOD_ORDER:
        c, f = method_stats(clean[method]), STATS["fast"][method]
        dec = (f"{f['decoded_ber']:.3f} {ci_text(*f['decoded_ci'], 2)}"
               if f["decoded_ber"] is not None else "n/a")
        thr = f"{f['throughput']:.3f}" if f["throughput"] else "0"
        rows.append(f"{method} & {RATES[method]} & {c['throughput']:.3f} & "
                    f"{c['ok']}/{c['trials']} {ci_text(*c['frames_ci'], 2)} & "
                    f"{f['channel_ber']:.3f} & {dec} & {thr} & "
                    f"{f['ok']}/{f['trials']} {ci_text(*f['frames_ci'], 2)} \\\\")
    (GENDIR / "table-slices.tex").write_text(NL.join(rows) + NL)

    # Pooled frame success over the three seven-method sessions (9 trials per method).
    pooled = defaultdict(lambda: [0, 0])
    for name in (QUIET, FAST, CLEAN):
        for method, trials in by_method(slices[name]).items():
            pooled[method][0] += sum(t.record.frame_valid for t in trials)
            pooled[method][1] += len(trials)
    STATS["pooled_frames"] = {m: tuple(v) for m, v in pooled.items()}
    best = max(METHOD_ORDER, key=lambda m: pooled[m][0])
    STATS["fisher"] = {
        m: fisher_exact(pooled[best][0], pooled[best][1] - pooled[best][0],
                        pooled[m][0], pooled[m][1] - pooled[m][0])
        for m in METHOD_ORDER if m != best
    }
    STATS["fisher_best"] = best
    f = STATS["fast"]
    STATS["fisher_fast_rep7_vs_hamming"] = fisher_exact(
        f["rep-7"]["ok"], f["rep-7"]["trials"] - f["rep-7"]["ok"],
        f["Hamming"]["ok"], f["Hamming"]["trials"] - f["Hamming"]["ok"])


# ---------------------------------------------------------------- noise structure
def context_rates(trials, cap=6):
    """Error rate by (symbol colour, position within a run of identical symbols)."""
    hits, seen = Counter(), Counter()
    after_white = [0, 0]
    after_black = [0, 0]
    for t in trials:
        sent, errors = t.record.transmitted_bits, t.error_sequence
        position = 0
        for i, e in enumerate(errors):
            position = position + 1 if i and sent[i] == sent[i - 1] else 1
            key = min(position, cap)
            seen[key] += 1
            hits[key] += e
            if i and sent[i] == 0:
                bucket = after_white if sent[i - 1] == 1 else after_black
                bucket[0] += e
                bucket[1] += 1
    flips = Counter()
    for t in trials:
        for i in t.error_positions:
            sent_black = t.record.transmitted_bits[i] == 0
            flips["black read white" if sent_black else "white read black"] += 1
    return hits, seen, after_white, after_black, flips


def codeword_failures(trials, method, size):
    """Coded groups (repetition sets) with all copies flipped, against a memoryless channel."""
    groups = errors = 0
    all_flipped = 0
    for t in trials:
        if t.method != method or t.observed < len(t.record.transmitted_bits):
            continue
        body = t.error_sequence[FRAME_OVERHEAD_BITS:]
        for i in range(0, len(body), size):
            k = sum(body[i:i + size])
            groups += 1
            errors += k
            all_flipped += k == size
    p = errors / (groups * size)
    return all_flipped, groups * p ** size, groups


def noise_analysis(slices):
    STATS["noise"] = {}
    models = {}
    for name in (FAST, GLARE, QUIET):
        trials = [t for t in slices[name] if t.observed]
        positions = [t.error_positions for t in trials]
        observed = [t.observed for t in trials]
        share, null_share, p = burstiness_permutation_test(positions, observed, permutations=5000)
        sequences = [t.error_sequence for t in trials]
        contexts = [run_position_context(t.record.transmitted_bits[:t.observed]) for t in trials]
        n = sum(observed)
        flip, ll0 = memoryless_log_likelihood(sequences)
        ge = fit_gilbert_elliott(sequences)
        gec = fit_gilbert_elliott(sequences, contexts)
        models[name] = ge
        hits, seen, after_white, after_black, flips = context_rates(trials)
        STATS["noise"][name] = {
            "bits": n, "errors": sum(map(len, positions)), "burst_share": share,
            "burst_share_null": null_share, "burst_p": p,
            "bic_bsc": bic(ll0, 1, n), "bic_ge": bic(ge.log_likelihood, ge.parameters, n),
            "bic_ge_context": bic(gec.log_likelihood, gec.parameters, n),
            "ge": {"p_gb": ge.p_good_to_bad, "p_bg": ge.p_bad_to_good,
                   "e_good": ge.error_good[0], "e_bad": ge.error_bad[0],
                   "bad_fraction": ge.bad_fraction, "mean_bad_length": ge.mean_bad_length},
            "ge_context_bad": gec.error_bad,
            "run_position_rate": {k: (hits[k], seen[k]) for k in sorted(seen)},
            "black_after_white": after_white, "black_after_black": after_black,
            "flip_direction": dict(flips),
        }
    for name in (FAST, GLARE):
        s = STATS["noise"][name]
        aw, ab = s["black_after_white"], s["black_after_black"]
        s["fisher_black_after_white"] = fisher_exact(aw[0], aw[1] - aw[0], ab[0], ab[1] - ab[0])
        early = sum(s["run_position_rate"][k][0] for k in (1, 2))
        early_n = sum(s["run_position_rate"][k][1] for k in (1, 2))
        late = sum(v[0] for k, v in s["run_position_rate"].items() if k >= 3)
        late_n = sum(v[1] for k, v in s["run_position_rate"].items() if k >= 3)
        s["early_late"] = (early, early_n, late, late_n)
        s["fisher_early_late"] = fisher_exact(early, early_n - early, late, late_n - late)
    flipped, expected, groups = codeword_failures(slices[GLARE], "rep-3", 3)
    STATS["rep3_all_copies"] = {"observed": flipped, "memoryless": expected, "groups": groups}

    # Does the fitted model reproduce burst structure that it was not fitted to?
    rng = np.random.default_rng(7)
    glare = [t for t in slices[GLARE] if t.observed]
    flip, _ = memoryless_log_likelihood([t.error_sequence for t in glare])
    sims = {"GE": [], "memoryless": []}
    run_hist = {"GE": Counter(), "memoryless": Counter()}
    for _ in range(300):
        ge_pos, bsc_pos = [], []
        for t in glare:
            ge_err = sample_errors(models[GLARE], t.observed, rng)
            bsc_err = rng.random(t.observed) < flip
            ge_pos.append(np.flatnonzero(ge_err).tolist())
            bsc_pos.append(np.flatnonzero(bsc_err).tolist())
        sims["GE"].append(burst_share(ge_pos))
        sims["memoryless"].append(burst_share(bsc_pos))
        for key, pos in (("GE", ge_pos), ("memoryless", bsc_pos)):
            for p in pos:
                run_hist[key].update(run_lengths(p))
    STATS["glare_model_check"] = {
        k: (float(np.mean(v)), *map(float, np.quantile(v, [0.025, 0.975])))
        for k, v in sims.items()
    }
    return models, run_hist


# ---------------------------------------------------------------- design what-ifs
LAYOUTS = [
    Layout("rep-3 adjacent", "repetition", 3),
    Layout("rep-5 adjacent", "repetition", 5),
    Layout("rep-7 adjacent", "repetition", 7),
    Layout("rep-3 spread", "repetition", 3, spread_repetition=True),
    Layout("rep-7 spread", "repetition", 7, spread_repetition=True),
    Layout("Hamming", "hamming"),
    Layout("Ham-int d4", "hamming-interleaved", depth=4),
    Layout("Ham-int d8", "hamming-interleaved", depth=8),
    Layout("Ham-int d16", "hamming-interleaved", depth=16),
]


def design_study(models):
    STATS["design"] = {}
    for name, payload in ((GLARE, 4), (FAST, 2)):
        STATS["design"][name] = {
            layout.name: frame_success(models[name], layout, payload, 3000, seed=11)
            for layout in LAYOUTS
        }
        for spread in (False, True):
            layout = Layout("rep-3 spread", "repetition", 3, spread_repetition=True,
                            spread_header=spread)
            key = "header spread" if spread else "header adjacent"
            STATS["design"][name][key] = frame_success(models[name], layout, payload, 3000, 11)


# ---------------------------------------------------------------- figures
BAR = {"edgecolor": INK, "lw": 0.5, "zorder": 2}
WORSE = {"facecolor": "white", "edgecolor": ACCENT, "hatch": "//////", "lw": 0.7, "zorder": 2}


def grid_below(ax, axis="y"):
    ax.set_axisbelow(True)
    (ax.yaxis if axis == "y" else ax.xaxis).grid(True)


def fig_highnoise():
    fast = STATS["fast"]
    fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(FULL_WIDTH, 1.34), layout="constrained")
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.02, wspace=0.06)
    x = np.arange(len(METHOD_ORDER))
    ok = [fast[m]["ok"] / fast[m]["trials"] for m in METHOD_ORDER]
    lo = [fast[m]["frames_ci"][0] for m in METHOD_ORDER]
    hi = [fast[m]["frames_ci"][1] for m in METHOD_ORDER]
    ax0.bar(x, ok, 0.6, facecolor=INK, **BAR)
    ax0.errorbar(x, ok, yerr=[np.subtract(ok, lo), np.subtract(hi, ok)], fmt="none",
                 ecolor=GREY2, lw=0.9, zorder=3)
    for xi, m in zip(x, METHOD_ORDER):
        ax0.text(xi, 1.035, f"{fast[m]['ok']}/{fast[m]['trials']}", ha="center", fontsize=7.5)
    ax0.set_ylim(0, 1.13)
    ax0.set_yticks(np.arange(0, 1.01, 0.25))
    ax0.set_ylabel("Frames delivered")

    base = fast["none"]["decoded_ber"]
    dec = [fast[m]["decoded_ber"] for m in METHOD_ORDER]
    cis = [fast[m].get("decoded_ci", (0, 0)) for m in METHOD_ORDER]
    for xi, m, d, c in zip(x, METHOD_ORDER, dec, cis):
        if m == "none":
            ax1.bar(xi, d, 0.6, facecolor=INK, **BAR)
            colour = GREY2
        elif d > base + 1e-9:
            ax1.bar(xi, d, 0.6, **WORSE)
            colour = INK
        else:
            ax1.bar(xi, d, 0.6, facecolor=GREY2, **BAR)
            colour = INK
        ax1.errorbar([xi], [d], yerr=[[d - c[0]], [c[1] - d]], fmt="none", ecolor=colour,
                     lw=0.9, zorder=3)
    ax1.axhline(base, color=INK, ls="--", lw=0.8, zorder=1)
    ax1.set_ylabel("Decoded BER")
    for ax, label in ((ax0, "(a)"), (ax1, "(b)")):
        ax.set_xticks(x)
        ax.set_xticklabels(METHOD_ORDER, rotation=35, ha="right")
        ax.tick_params(axis="x", which="both", top=False)
        ax.set_xlim(-0.6, len(x) - 0.4)
        grid_below(ax)
        panel_label(ax, label)
    save(fig, "highnoise-bars")


def fig_noise(slices, run_hist):
    fig = plt.figure(figsize=(FULL_WIDTH, 2.45), layout="constrained")
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.03, wspace=0.06, hspace=0.06)
    gs = fig.add_gridspec(2, 2, height_ratios=[0.95, 1.0])

    ax0 = fig.add_subplot(gs[0, :])
    examples = [("8 bps", t, INK) for t in slices[FAST] if t.method == "Hamming"]
    examples += [("glare", t, ACCENT) for t in slices[GLARE]
                 if t.observed and 30 < len(t.error_positions) < 90][:3]
    for y, (label, t, colour) in enumerate(examples):
        ax0.plot([0, t.observed], [y, y], color=GREY3, lw=0.5, zorder=1, solid_capstyle="butt")
        if t.observed < 400:
            ax0.add_patch(plt.Rectangle((t.observed, y - 0.36), 400 - t.observed, 0.72,
                                        facecolor="none", edgecolor=GREY2, hatch="//////",
                                        lw=0))
        for p in t.error_positions:
            ax0.add_patch(plt.Rectangle((p - 0.5, y - 0.36), 1.0, 0.72, facecolor=colour,
                                        lw=0, zorder=2))
    ax0.set_xlim(0, 400)
    ax0.set_ylim(len(examples) - 0.4, -0.6)
    ax0.set_yticks(range(len(examples)))
    ax0.set_yticklabels([e[0] for e in examples])
    ax0.tick_params(axis="y", which="both", length=0, pad=3)
    ax0.set_xticks(np.arange(0, 401, 50))
    ax0.set_xlabel("Transmitted frame bit position")
    handles = [Patch(facecolor=INK, lw=0, label="Facing the screen, 8 bps"),
               Patch(facecolor=ACCENT, lw=0, label="Reflection with glare, 4 bps"),
               Patch(facecolor="none", edgecolor=GREY2, hatch="//////", lw=0,
                     label="Not observed")]
    ax0.legend(handles=handles, loc="lower right", bbox_to_anchor=(1.0, 1.0), ncol=3,
               handlelength=1.2, columnspacing=1.6, borderaxespad=0.15)
    panel_label(ax0, "(a)")

    ax1 = fig.add_subplot(gs[1, 0])
    labels = ["1", "2", "3 to 4", "5 to 7", "8+"]
    bins = [(1, 1), (2, 2), (3, 4), (5, 7), (8, 10**6)]

    def errors_by_run(counter):
        total = sum(k * v for k, v in counter.items())
        return [sum(k * v for k, v in counter.items() if lo <= k <= hi) / total for lo, hi in bins]

    observed = {name: Counter(length for t in slices[name] for length in
                              run_lengths(t.error_positions)) for name in (FAST, GLARE)}
    x = np.arange(len(labels))
    ax1.bar(x - 0.2, errors_by_run(observed[FAST]), 0.38, facecolor=INK, **BAR,
            label="8 bps, observed")
    ax1.bar(x + 0.2, errors_by_run(observed[GLARE]), 0.38, facecolor="white", edgecolor=ACCENT,
            hatch="/////", lw=0.7, zorder=2, label="Glare, observed")
    ax1.plot(x + 0.2, errors_by_run(run_hist["GE"]), "o", color=INK, ms=3.5, zorder=3,
             label="Glare, fitted G-E model")
    ax1.plot(x + 0.2, errors_by_run(run_hist["memoryless"]), "x", color=GREY1, ms=4.5,
             mew=1.0, zorder=3, label="Glare, memoryless model")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.tick_params(axis="x", which="both", top=False)
    ax1.set_xlim(-0.6, len(labels) - 0.4)
    ax1.set_ylim(0, 1.5)
    ax1.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
    ax1.set_xlabel("Error-run length (bits)")
    ax1.set_ylabel("Share of errors")
    ax1.legend(loc="upper right", ncol=2, columnspacing=1.2, borderaxespad=0.2)
    panel_label(ax1, "(b)")

    ax2 = fig.add_subplot(gs[1, 1])
    for name, colour, style, mfc, label in (
            (FAST, INK, "o-", INK, "Facing the screen, 8 bps"),
            (GLARE, ACCENT, "s--", "white", "Reflection with glare, 4 bps")):
        rates = STATS["noise"][name]["run_position_rate"]
        keys = sorted(rates)
        ax2.plot(keys, [rates[k][0] / rates[k][1] for k in keys], style, color=colour,
                 mfc=mfc, label=label)
    ax2.set_xticks(range(1, 7))
    ax2.set_xticklabels(["1", "2", "3", "4", "5", "6+"])
    ax2.set_xlabel("Position within a run of the same colour")
    ax2.set_ylabel("Bit error rate")
    ax2.set_ylim(0, 0.5)
    ax2.set_yticks([0, 0.1, 0.2, 0.3, 0.4])
    ax2.legend(loc="upper left")
    panel_label(ax2, "(c)")
    for ax in (ax1, ax2):
        grid_below(ax)
    save(fig, "noise-regimes")


def fig_extension():
    fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(FULL_WIDTH, 1.52), layout="constrained",
                                   gridspec_kw={"width_ratios": [1, 1.15]})
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.02, wspace=0.06)
    bursts = burst_experiment.run()
    STATS["controlled_burst"] = {name: means for name, (means, _) in bursts.items()}
    lengths = np.arange(1, burst_experiment.MAX_BURST + 1)
    styles = {"Hamming": (INK, "s", "--", "white"),
              "Hamming-interleaved": (ACCENT, "o", "-", ACCENT),
              "repetition-3": (GREY2, "^", ":", GREY2)}
    for name, (means, ses) in bursts.items():
        colour, marker, ls, mfc = styles[name]
        ax0.errorbar(lengths, means, yerr=ses, color=colour, marker=marker, ls=ls, mfc=mfc,
                     ms=3, lw=1.0, elinewidth=0.6, label=name)
    ax0.axvline(8, color=GREY2, ls=":", lw=0.8)
    ax0.set_xlabel("Burst length (bits flipped)")
    ax0.set_ylabel("Mean decoded BER")
    ax0.set_xticks([1, 4, 8, 12, 16])
    ax0.set_xlim(0.5, 16.5)
    grid_below(ax0)
    ax0.legend(loc="upper left")
    panel_label(ax0, "(a)")

    design = STATS["design"][GLARE]
    names = [layout.name for layout in LAYOUTS]
    values = [design[n]["payload"] for n in names]
    x = np.arange(len(names))
    for xi, n, v in zip(x, names, values):
        if "adjacent" in n or n == "Hamming":
            ax1.bar(xi, v, 0.6, facecolor="white", edgecolor=INK, hatch="//////", lw=0.7,
                    zorder=2)
        else:
            ax1.bar(xi, v, 0.6, facecolor=ACCENT, **BAR)
        ax1.text(xi, v + 0.015, f"{v:.2f}", ha="center", fontsize=7.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(names, rotation=35, ha="right")
    ax1.tick_params(axis="x", which="both", top=False)
    ax1.set_xlim(-0.6, len(x) - 0.4)
    ax1.set_ylabel("P(payload decoded)")
    ax1.set_ylim(0, max(values) * 1.18)
    grid_below(ax1)
    panel_label(ax1, "(b)")
    save(fig, "extension")


# ---------------------------------------------------------------- diagrams drawn as figures
def _cell(ax, x, y, size, text="", fill="white", fontsize=7.5, lw=0.5):
    ax.add_patch(plt.Rectangle((x, y), size, size, facecolor=fill, edgecolor=INK, lw=lw,
                               zorder=2))
    if text:
        ax.text(x + size / 2, y + size / 2 - 0.01, text, ha="center", va="center",
                fontsize=fontsize, zorder=3)


def _arrow(ax, p, q, colour, lw=1.0, ls="-"):
    ax.annotate("", xy=q, xytext=p, zorder=4, arrowprops=dict(
        arrowstyle="-|>", color=colour, lw=lw, ls=ls, shrinkA=0, shrinkB=0, mutation_scale=7))


def fig_system():
    """The channel and the frame, drawn at one column. Units are about one centimetre."""
    fig = plt.figure(figsize=(SINGLE_COL, 1.72))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 8.7)
    ax.set_ylim(0, 4.36)
    ax.axis("off")

    def box(x, y, w, h, lines, bold_first=True):
        ax.add_patch(plt.Rectangle((x, y), w, h, facecolor=GREY4, edgecolor=INK, lw=0.6,
                                   zorder=2))
        n = len(lines)
        for i, line in enumerate(lines):
            ax.text(x + w / 2, y + h / 2 + (n - 1) * 0.15 - i * 0.3, line, ha="center",
                    va="center", fontsize=7.5, zorder=3,
                    fontweight="bold" if (bold_first and i == 0) else "normal")

    box(0.0, 3.1, 2.5, 1.12, ["Laptop 1", "flashing patch", "white 1, black 0"])
    box(5.8, 3.1, 2.9, 1.12, ["Laptop 2", "built-in webcam", "threshold, sample, decode"])
    box(3.1, 1.55, 2.5, 0.8, ["iPad screen", "reflection path only"])
    # facing the screen, the baseline path
    _arrow(ax, (2.5, 3.66), (5.8, 3.66), INK, lw=1.1)
    ax.text(4.15, 3.78, "facing the screen", ha="center", va="bottom", fontsize=7.5)
    # reflection, the glare path
    ax.plot([1.25, 1.25], [3.1, 1.95], color=ACCENT, lw=1.1, zorder=4, solid_capstyle="butt")
    _arrow(ax, (1.25, 1.95), (3.1, 1.95), ACCENT, lw=1.1)
    ax.plot([5.6, 7.35], [1.95, 1.95], color=ACCENT, lw=1.1, zorder=4, solid_capstyle="butt")
    _arrow(ax, (7.35, 1.95), (7.35, 3.1), ACCENT, lw=1.1)
    ax.text(1.4, 2.12, "reflection", ha="left", va="bottom", fontsize=7.5, color=ACCENT)
    ax.text(4.35, 0.95, "lamp glare in a dim room", ha="center", va="center", fontsize=7.5,
            color=GREY1)
    _arrow(ax, (4.35, 1.12), (4.35, 1.55), GREY1, lw=0.8)
    # the frame, not to scale
    segs = [(0.0, 1.5, GREY4, ["Sync", "48 bits"]),
            (1.5, 3.3, GREY3, ["Header, 192 bits", "repetition-3"]),
            (4.8, 3.9, "white", ["Payload and CRC-16", "coded with the chosen code"])]
    for x, w, fill, lines in segs:
        ax.add_patch(plt.Rectangle((x, 0.0), w, 0.62, facecolor=fill, edgecolor=INK, lw=0.6,
                                   zorder=2))
        for i, line in enumerate(lines):
            ax.text(x + w / 2, 0.31 + 0.15 - i * 0.3, line, ha="center", va="center",
                    fontsize=7.5, zorder=3)
    save(fig, "system")


def fig_layouts():
    """Adjacent against spread copies, and the interleaver grid, drawn at one column."""
    fig = plt.figure(figsize=(SINGLE_COL, 1.62))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 8.7)
    ax.set_ylim(0, 4.04)
    ax.axis("off")
    burst = tint(ACCENT, 0.42)
    ax.text(0.0, 3.85, "(a)", fontsize=8, fontweight="bold", va="center")
    for label, y, letters, note in (
            ("adjacent", 3.0, "aaabbbccc", "all three copies\nof b are lost"),
            ("spread", 2.25, "abcabcabc", "one copy of each\nbit is lost")):
        ax.text(1.75, y + 0.2, label, ha="right", va="center", fontsize=7.5)
        for i, letter in enumerate(letters):
            _cell(ax, 1.85 + 0.4 * i, y, 0.4, letter, fill=burst if 3 <= i <= 5 else "white")
        ax.text(5.55, y + 0.2, note, ha="left", va="center", fontsize=7.5, linespacing=1.15)
    ax.text(1.85, 1.9, "a burst of 3 bits is shaded", ha="left", va="center", fontsize=7.5,
            color=ACCENT)
    ax.text(0.0, 1.5, "(b)", fontsize=8, fontweight="bold", va="center")
    for r in range(8):
        for c in range(7):
            _cell(ax, 1.85 + 0.19 * c, 0.05 + 0.19 * r, 0.19,
                  fill=burst if c == 3 else "white", lw=0.4)
    ax.text(1.75, 0.8, "8 codewords\nof 7 bits", ha="right", va="center", fontsize=7.5,
            linespacing=1.15)
    ax.text(3.4, 0.8, "Sent column by column, so a burst of 8 bits\n"
            "meets each codeword once. Depth 16 stacks\n"
            "16 codewords and covers bursts up to 16 bits.",
            ha="left", va="center", fontsize=7.5, linespacing=1.2)
    save(fig, "layouts")


# ---------------------------------------------------------------- what changed between sessions
def group_bers(trials):
    """Pooled channel BER of each recorded group inside a slice."""
    out = {}
    for g in sorted({t.group for t in trials}):
        ts = [t for t in trials if t.group == g and t.observed]
        out[g] = sum(len(t.error_positions) for t in ts) / sum(t.observed for t in ts)
    return out


def session_contrasts(slices):
    """The four one-change contrasts the report discusses, from the per-group results."""
    def frames(*names):
        ts = [t for n in names for t in slices[n]]
        return sum(t.record.frame_valid for t in ts), len(ts)

    def span(name):
        v = list(group_bers(slices[name]).values())
        return min(v), max(v)

    STATS["contrasts"] = {
        "speed": {"ber": [span(QUIET), span(FAST)], "frames": [frames(QUIET), frames(FAST)]},
        "path": {"frames": [frames(CLEAN, "4 bps reflection (rep-3 check)"),
                            frames("4 bps facing (rep-3 check)")]},
        "light": {"ber": [span(CLEAN), span(GLARE)], "frames": [frames(CLEAN), frames(GLARE)]},
        "slow": {"ber": span(SLOW), "frames": [frames(GLARE), frames(SLOW)]},
    }


def write_contrast_tex():
    c = STATS["contrasts"]

    def rng(pair):
        return f"{pair[0]:.3f} to {pair[1]:.3f}"

    macros = {
        "speedBerA": rng(c["speed"]["ber"][0]), "speedBerB": rng(c["speed"]["ber"][1]),
        "speedOkA": c["speed"]["frames"][0][0], "speedOkB": c["speed"]["frames"][1][0],
        "speedN": c["speed"]["frames"][0][1],
        "pathOkA": c["path"]["frames"][0][0], "pathNA": c["path"]["frames"][0][1],
        "pathOkB": c["path"]["frames"][1][0], "pathNB": c["path"]["frames"][1][1],
        "lightBerA": rng(c["light"]["ber"][0]), "lightBerB": rng(c["light"]["ber"][1]),
        "lightOkA": c["light"]["frames"][0][0], "lightNA": c["light"]["frames"][0][1],
        "lightOkB": c["light"]["frames"][1][0], "lightNB": c["light"]["frames"][1][1],
        "slowBer": f"{c['slow']['ber'][0]:.3f}",
        "slowOk": c["slow"]["frames"][1][0], "slowN": c["slow"]["frames"][1][1],
    }
    lines = [f"\\newcommand{{\\{name}}}{{{value}}}" for name, value in macros.items()]
    (GENDIR / "contrasts.tex").write_text(NL.join(lines) + NL)


# ---------------------------------------------------------------- physical test of the new layouts
PHYS_DIR = "glare-layouts-room-comparison-20261106-021921-294106Z"
# (scheme, repetitions, spread header), label, index of the as-built baseline in this list
PHYS_LAYOUTS = [
    (("repetition", 3, False), "rep-3 adjacent", None),
    (("repetition-spread", 3, False), "rep-3 spread", 0),
    (("repetition-spread", 3, True), "rep-3 spread + header", 0),
    (("hamming-interleaved", 1, False), "Ham-int depth 8", None),
    (("hamming-interleaved-16", 1, False), "Ham-int depth 16", 3),
    (("hamming-interleaved-16", 1, True), "Ham-int depth 16 + header", 3),
]
EPISODE_BER = 0.05      # a frame with over 5 percent of its bits wrong marks a strong glare episode
HEADER_COPY_BITS = 8 * (HEADER_LENGTH + HEADER_CRC_LENGTH)       # one copy of the coded header
SYNC_BITS = FRAME_OVERHEAD_BITS - 3 * HEADER_COPY_BITS
PHYS_TRIALS: list[dict] = []


def error_offsets(record):
    return [i for i, (a, b) in enumerate(zip(record.transmitted_bits, record.received_bits or []))
            if a != b]


def run_position(bits, i):
    """Position of symbol i within its run of identical symbols, 1 for the first."""
    k = 1
    while i - k >= 0 and bits[i - k] == bits[i]:
        k += 1
    return k


def coincident_bits(errors, spread, copy_bits):
    """Bits with two or more wrong copies, as shared offsets (spread) or triples (adjacent)."""
    keys = [e % copy_bits if spread else e // 3 for e in errors]
    return {k for k, n in Counter(keys).items() if n >= 2}


def same_offset_test(per_frame, region_bits, spread, copy_bits, permutations=10000, seed=3):
    """Frames with two wrong copies of one bit, against the same errors placed at random."""
    rng = np.random.default_rng(seed)
    observed = sum(bool(coincident_bits(e, spread, copy_bits)) for e in per_frame)
    null = np.array([
        sum(bool(coincident_bits(rng.choice(region_bits, size=len(e), replace=False).tolist(),
                                 spread, copy_bits)) for e in per_frame)
        for _ in range(permutations)])
    return {"frames": len(per_frame), "errors": sum(map(len, per_frame)), "observed": observed,
            "null_mean": float(null.mean()), "p": float((null >= observed).mean())}


def physical_test(slices):
    """Frames, BER and Fisher tests for the six layouts run in one 72-trial session."""
    session_dir = RESULTS / PHYS_DIR
    records = sorted(read_csv(session_dir / "results.csv"), key=lambda r: r.trial_index)
    meta = json.loads((session_dir / "session.json").read_text())
    groups = defaultdict(list)
    for r in records:
        groups[(r.coding_scheme, r.repetition_factor or 1, r.spread_header)].append(r)
    label_of = {key: label for key, label, _ in PHYS_LAYOUTS}

    layouts = {}
    for key, label, base in PHYS_LAYOUTS:
        recs = groups[key]
        errors = [r.channel_bit_errors or 0 for r in recs]
        seen = [len(r.received_bits or []) for r in recs]
        ok = sum(r.frame_valid for r in recs)
        decodable = [r for r in recs if r.decoded_bit_errors is not None]
        dec_bits = sum(r.information_bits or 0 for r in decodable)
        layouts[label] = {
            "trials": len(recs), "ok": ok, "frames_ci": wilson_interval(ok, len(recs)),
            "header_failures": sum((r.failure_reason or "").startswith("header") for r in recs),
            "channel_ber": sum(errors) / sum(seen),
            "channel_ci": bootstrap_ratio_interval(errors, seen),
            "decoded_ber": (sum(r.decoded_bit_errors for r in decodable) / dec_bits
                            if dec_bits else None),
            "baseline": PHYS_LAYOUTS[base][1] if base is not None else None,
        }
    for key, label, base in PHYS_LAYOUTS:
        if base is not None:
            a, b = layouts[label], layouts[PHYS_LAYOUTS[base][1]]
            a["fisher_p"] = fisher_exact(a["ok"], a["trials"] - a["ok"],
                                         b["ok"], b["trials"] - b["ok"])

    # The original glare runs, G22 to G26, pooled per group, as the harsh reference.
    glare = [t for t in slices[GLARE] if t.observed]
    earlier = {}
    for g in sorted({t.group for t in glare}):
        ts = [t for t in glare if t.group == g]
        earlier[g] = sum(len(t.error_positions) for t in ts) / sum(t.observed for t in ts)
    earlier_ok = sum(t.record.frame_valid for t in slices[GLARE])

    # Strong glare episodes inside the session, found from the data and not chosen by hand.
    strong = [r for r in records
              if (r.channel_bit_errors or 0) > EPISODE_BER * max(1, len(r.received_bits or []))]
    episode = {}
    if strong:
        key = (strong[0].coding_scheme, strong[0].repetition_factor or 1, strong[0].spread_header)
        rest = [r for r in groups[key] if r not in strong]
        episode = {
            "layout": label_of[key], "trials": [r.trial_index for r in strong],
            "errors": [r.channel_bit_errors for r in strong],
            "failed": sum(not r.frame_valid for r in strong),
            "seconds": strong[-1].frame_start - strong[0].frame_start + strong[-1].elapsed_seconds,
            "ber_without": (sum(r.channel_bit_errors or 0 for r in rest)
                            / sum(len(r.received_bits or []) for r in rest)),
        }

    # Header copies. A spread header repeats the same pattern at the same offset in each copy.
    def header_failed(r):
        return (r.failure_reason or "").startswith("header")

    spread_hdr = [r for r in records if r.spread_header]
    other_hdr = [r for r in records if not r.spread_header]
    mild_spread = [r for r in spread_hdr if r not in strong]

    def header_errors(r):
        return [i - SYNC_BITS for i in error_offsets(r) if SYNC_BITS <= i < FRAME_OVERHEAD_BITS]

    n_head = 3 * HEADER_COPY_BITS
    spread_test = same_offset_test([header_errors(r) for r in mild_spread], n_head, True,
                                   HEADER_COPY_BITS)
    adjacent_test = same_offset_test([header_errors(r) for r in other_hdr], n_head, False,
                                     HEADER_COPY_BITS)
    runs, blacks = [], []
    for r in mild_spread:
        for k in coincident_bits(header_errors(r), True, HEADER_COPY_BITS):
            for c in range(3):
                i = SYNC_BITS + k + c * HEADER_COPY_BITS
                if i in set(error_offsets(r)):
                    runs.append(run_position(r.transmitted_bits, i))
                    blacks.append(r.transmitted_bits[i] == 0)
    spread_payload = [r for r in records if r.coding_scheme == "repetition-spread"
                      and r not in strong]
    copy_bits = (len(spread_payload[0].transmitted_bits) - FRAME_OVERHEAD_BITS) // 3

    def payload_errors(r):
        return [i - FRAME_OVERHEAD_BITS for i in error_offsets(r) if i >= FRAME_OVERHEAD_BITS]

    payload_test = same_offset_test([payload_errors(r) for r in spread_payload], 3 * copy_bits,
                                    True, copy_bits)
    payload_test["failed"] = sum((r.failure_reason or "") == "CRC check failed"
                                 for r in spread_payload)
    hs, ho = sum(map(header_failed, spread_hdr)), sum(map(header_failed, other_hdr))
    mild_fail = sum(map(header_failed, mild_spread))
    header = {
        "spread": {"frames": len(spread_hdr), "failed": hs},
        "other": {"frames": len(other_hdr), "failed": ho},
        "fisher_p": fisher_exact(hs, len(spread_hdr) - hs, ho, len(other_hdr) - ho),
        "mild_fisher_p": fisher_exact(mild_fail, len(mild_spread) - mild_fail,
                                      ho, len(other_hdr) - ho),
        "mild_spread": {**spread_test, "failed": mild_fail},
        "adjacent": adjacent_test,
        "coincident_run_positions": [min(runs), max(runs)] if runs else [],
        "coincident_all_black": bool(runs) and all(blacks),
        "spread_payload": payload_test,
    }

    PHYS_TRIALS[:] = [
        {"index": r.trial_index, "valid": bool(r.frame_valid), "header": header_failed(r),
         "errors": r.channel_bit_errors or 0,
         "label": label_of[(r.coding_scheme, r.repetition_factor or 1, r.spread_header)]}
        for r in records]

    new = [v for v in layouts.values() if v["baseline"]]
    chans = [v["channel_ber"] for v in layouts.values()]
    decs = [v["decoded_ber"] for v in layouts.values() if v["decoded_ber"] is not None]
    oks = [v["ok"] for v in layouts.values()]
    STATS["physical"] = {
        "session": {"trials": len(records), "per_layout": len(records) // len(layouts),
                    "bit_rate": meta["bit_rate"], "threshold": meta["threshold"],
                    "minutes": float(meta["capture"]["elapsed_seconds"]) / 60,
                    "payload_bits": records[0].payload_bits},
        "layouts": layouts,
        "ranges": {"frames": [min(oks), max(oks)], "channel_ber": [min(chans), max(chans)],
                   "decoded_ber": [min(decs), max(decs)],
                   "fisher_p": [min(v["fisher_p"] for v in new), max(v["fisher_p"] for v in new)]},
        "earlier_glare": earlier,
        "earlier_range": [min(earlier.values()), max(earlier.values())],
        "earlier_frames": {"ok": earlier_ok, "trials": len(slices[GLARE]),
                           "ci": wilson_interval(earlier_ok, len(slices[GLARE]))},
        "episode": episode,
        "header": header,
    }


def write_physical_tex():
    """Table rows and number macros for the physical-test text, so no figure is typed by hand."""
    P = STATS["physical"]

    def pct(x, places=2):
        return f"{100 * x:.{places}f}"

    rows = []
    for _, label, base in PHYS_LAYOUTS:
        v = P["layouts"][label]
        p = "base" if base is None else f"{v['fisher_p']:.2f}"
        dec = pct(v["decoded_ber"]) if v["decoded_ber"] is not None else "n/a"
        rows.append(f"{label} & {v['ok']}/{v['trials']} {ci_text(*v['frames_ci'], 2)} & "
                    f"{v['header_failures']} & {pct(v['channel_ber'])} & {dec} & {p} \\\\")
    (GENDIR / "table-physical.tex").write_text(NL.join(rows) + NL)

    r, s, e, h = P["ranges"], P["session"], P["episode"], P["header"]
    macros = {
        "physTrials": s["trials"], "physPerLayout": s["per_layout"],
        "physMinutes": round(s["minutes"]), "physThreshold": f"{s['threshold']:g}",
        "physFramesLo": r["frames"][0], "physFramesHi": r["frames"][1],
        "physChLo": pct(r["channel_ber"][0], 1), "physChHi": pct(r["channel_ber"][1], 1),
        "physDecHi": pct(r["decoded_ber"][1]),
        "physPLo": f"{r['fisher_p'][0]:.2f}",
        "physPHi": "1.0" if r["fisher_p"][1] > 0.995 else f"{r['fisher_p'][1]:.2f}",
        "earlyChLo": pct(P["earlier_range"][0], 1), "earlyChHi": pct(P["earlier_range"][1], 1),
        "earlyFramesOk": P["earlier_frames"]["ok"], "earlyFramesN": P["earlier_frames"]["trials"],
        "earlyFramesLo": f"{P['earlier_frames']['ci'][0]:.2f}",
        "earlyFramesHi": f"{P['earlier_frames']['ci'][1]:.2f}",
        "hdrFailSh": h["spread"]["failed"], "hdrFailShN": h["spread"]["frames"],
        "hdrFailOt": h["other"]["failed"], "hdrFailOtN": h["other"]["frames"],
        "hdrFisher": f"{h['fisher_p']:.3f}",
        "hdrMildN": h["mild_spread"]["frames"], "hdrMildFail": h["mild_spread"]["failed"],
        "hdrCoObs": h["mild_spread"]["observed"],
        "hdrCoNull": f"{h['mild_spread']['null_mean']:.1f}",
        "hdrCoP": f"{h['mild_spread']['p']:.3f}",
        "hdrAdjObs": h["adjacent"]["observed"], "hdrAdjNull": f"{h['adjacent']['null_mean']:.1f}",
        "hdrRunLo": h["coincident_run_positions"][0], "hdrRunHi": h["coincident_run_positions"][1],
        "payCoObs": h["spread_payload"]["observed"], "payCoN": h["spread_payload"]["frames"],
        "payCoNull": f"{h['spread_payload']['null_mean']:.1f}",
        "payCoP": f"{h['spread_payload']['p']:.3f}",
        "payFail": h["spread_payload"]["failed"],
    }
    if e:
        macros.update({
            "epiTrials": len(e["trials"]), "epiErrA": e["errors"][0], "epiErrB": e["errors"][-1],
            "epiFailed": e["failed"], "epiMinutes": round(e["seconds"] / 60),
            "epiBerWithout": pct(e["ber_without"]),
            "epiBerWith": pct(P["layouts"][e["layout"]]["channel_ber"], 1),
        })
    lines = [f"\\newcommand{{\\{name}}}{{{value}}}" for name, value in macros.items()]
    (GENDIR / "physical.tex").write_text(NL.join(lines) + NL)


def fig_physical():
    """Frames, channel BER and per-frame errors for the six layouts. As built is INK, the new
    spread and deep layouts are ACCENT, the earlier glare runs are GREY2 for reference."""
    P = STATS["physical"]
    labels = [label for _, label, _ in PHYS_LAYOUTS]
    rows = labels + ["Earlier glare, rep-3"]
    colour = {label: (INK if base is None else ACCENT) for _, label, base in PHYS_LAYOUTS}
    marker = {label: ("o" if base is None else "s") for _, label, base in PHYS_LAYOUTS}
    fig = plt.figure(figsize=(FULL_WIDTH, 1.5), layout="constrained")
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.02, wspace=0.05)
    gs = fig.add_gridspec(1, 3, width_ratios=[1.12, 1.0, 1.35])
    n = len(rows)

    ax0 = fig.add_subplot(gs[0, 0])
    for i, lab in enumerate(labels):
        v = P["layouts"][lab]
        lo, hi = v["frames_ci"]
        ax0.hlines(i, lo, hi, color=colour[lab], lw=1.2, zorder=2)
        ax0.plot([v["ok"] / v["trials"]], [i], marker[lab], color=colour[lab], ms=4, zorder=3)
        ax0.text(1.04, i, f"{v['ok']}/{v['trials']}", va="center", fontsize=7.5)
    ef = P["earlier_frames"]
    lo, hi = ef["ci"]
    ax0.hlines(n - 1, lo, hi, color=GREY2, lw=1.2, zorder=2)
    ax0.plot([ef["ok"] / ef["trials"]], [n - 1], "o", mfc="white", mec=GREY2, ms=4, zorder=3)
    ax0.text(1.04, n - 1, f"{ef['ok']}/{ef['trials']}", va="center", fontsize=7.5, color=GREY1)
    ax0.axhline(n - 1.5, color=GREY3, lw=0.6, ls=":")
    ax0.set_yticks(range(n))
    ax0.set_yticklabels(rows)
    ax0.set_ylim(n - 0.4, -0.6)
    ax0.tick_params(axis="y", length=0, pad=3)
    ax0.set_xlim(0, 1.17)
    ax0.set_xticks([0, 0.25, 0.5, 0.75, 1.0])
    ax0.set_xlabel("Share of frames delivered")
    grid_below(ax0, "x")
    panel_label(ax0, "(a)")

    ax1 = fig.add_subplot(gs[0, 1], sharey=ax0)
    for i, lab in enumerate(labels):
        v = P["layouts"][lab]
        lo, hi = (100 * c for c in v["channel_ci"])
        ax1.hlines(i, lo, hi, color=colour[lab], lw=1.2, zorder=2)
        ax1.plot([100 * v["channel_ber"]], [i], marker[lab], color=colour[lab], ms=4, zorder=3)
    early = [100 * b for b in P["earlier_glare"].values()]
    ax1.plot(early, [n - 1] * len(early), "o", mfc="white", mec=GREY2, ms=4, zorder=3)
    ax1.axhline(n - 1.5, color=GREY3, lw=0.6, ls=":")
    ax1.set_xscale("log")
    ax1.set_xlim(0.1, 60)
    ax1.set_xticks([0.1, 1, 10])
    ax1.set_xticklabels(["0.1", "1", "10"])
    ax1.tick_params(axis="y", labelleft=False, length=0)
    ax1.set_xlabel("Channel BER (%)")
    grid_below(ax1, "x")
    panel_label(ax1, "(b)")

    ax2 = fig.add_subplot(gs[0, 2])
    good = [t for t in PHYS_TRIALS if t["valid"]]
    head = [t for t in PHYS_TRIALS if not t["valid"] and t["header"]]
    pay = [t for t in PHYS_TRIALS if not t["valid"] and not t["header"]]
    ax2.plot([t["index"] for t in good], [t["errors"] for t in good], "o", color=INK,
             ms=2.6, mew=0, label="Delivered")
    ax2.plot([t["index"] for t in head], [t["errors"] for t in head], "x", color=ACCENT,
             ms=4.5, mew=1.1, label="Header CRC failed")
    ax2.plot([t["index"] for t in pay], [t["errors"] for t in pay], "+", color=ACCENT,
             ms=5.5, mew=1.1, label="Payload CRC failed")
    ax2.set_yscale("symlog", linthresh=2, linscale=0.7)
    ax2.set_ylim(-0.4, 90)
    ax2.set_yticks([0, 2, 5, 10, 20, 50])
    ax2.set_yticklabels(["0", "2", "5", "10", "20", "50"])
    ax2.set_xlim(-2, 74)
    ax2.set_xlabel("Trial, in the order recorded")
    ax2.set_ylabel("Channel errors in the frame")
    ax2.legend(loc="upper left", ncol=1, handletextpad=0.3, labelspacing=0.2)
    grid_below(ax2)
    panel_label(ax2, "(c)")
    save(fig, "physical-test")


def main():
    trials = load()
    slices = by_slice(trials)
    write_tables(slices)
    models, run_hist = noise_analysis(slices)
    design_study(models)
    physical_test(slices)
    write_physical_tex()
    session_contrasts(slices)
    write_contrast_tex()
    fig_highnoise()
    fig_noise(slices, run_hist)
    fig_extension()
    fig_physical()
    fig_system()
    fig_layouts()
    STATS["slow_glare"] = {
        "errors": sum(len(t.error_positions) for t in slices[SLOW]),
        "bits": sum(t.observed for t in slices[SLOW]),
        "ok": sum(t.record.frame_valid for t in slices[SLOW]), "trials": len(slices[SLOW]),
    }
    (GENDIR / "stats.json").write_text(json.dumps(STATS, indent=1, default=float))
    print(json.dumps(STATS, indent=1, default=float))


if __name__ == "__main__":
    main()
