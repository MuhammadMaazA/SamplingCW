"""Regenerate every report figure, table row and quoted statistic from the per-trial data.

Inputs are the analysed results CSVs listed in data.SOURCES, read from experiments/results
or, if that is missing, from ../gridlink-results-backup/results. Outputs go to
report/figures/ (IEEE-style vector PDF plus a PNG copy) and report/generated/,
which report.tex includes directly, so no number in the report is typed by hand.

Run from the repository root with the project venv:
    .venv/bin/python report/make_figures.py
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib as mpl

mpl.use("Agg")
import burst_experiment
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np
from matplotlib.patches import Patch
from data import METHOD_ORDER, by_slice, load
from design_sim import Layout, frame_success

from gridlink.experiments.analysis import summarise_records
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
from gridlink.protocol import FRAME_OVERHEAD_BITS

HERE = Path(__file__).resolve().parent
FIGDIR = HERE / "figures"
GENDIR = HERE / "generated"
FIGDIR.mkdir(exist_ok=True)
GENDIR.mkdir(exist_ok=True)

# IEEE figure style. Figures are drawn at their printed width so fonts print at true size.
FULL_WIDTH = 6.5     # in, the text width of report.tex
SINGLE_COL = 3.5     # in
BLACK = "#000000"
BLUE = "#1f4e79"
RED = "#a23b2a"
GREY = "#7f7f7f"
LIGHT = "#d9d9d9"
mpl.rcParams.update({
    "font.family": "serif",
    "font.serif": ["Times New Roman", "Times", "DejaVu Serif"],
    "mathtext.fontset": "stix",
    "font.size": 8, "axes.labelsize": 8, "axes.titlesize": 8,
    "xtick.labelsize": 7, "ytick.labelsize": 7, "legend.fontsize": 7,
    "axes.linewidth": 0.7, "axes.edgecolor": BLACK, "axes.labelcolor": BLACK,
    "text.color": BLACK, "xtick.color": BLACK, "ytick.color": BLACK,
    "axes.spines.top": True, "axes.spines.right": True,
    "xtick.direction": "in", "ytick.direction": "in", "xtick.top": True, "ytick.right": True,
    "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.major.size": 3, "ytick.major.size": 3,
    "lines.linewidth": 1.1, "lines.markersize": 3.5, "hatch.linewidth": 0.5,
    "errorbar.capsize": 2,
    "grid.color": "#b0b0b0", "grid.linestyle": ":", "grid.linewidth": 0.5,
    "legend.frameon": False, "legend.handlelength": 1.8, "legend.borderaxespad": 0.4,
    "savefig.dpi": 600, "pdf.fonttype": 42, "ps.fonttype": 42,
})


def panel_label(ax, text):
    """Panel label such as (a) just above the top-left corner of the axes."""
    ax.text(0.0, 1.02, text, transform=ax.transAxes, ha="left", va="bottom", fontsize=8)


def save(fig, name):
    """Write vector PDF for the report and a PNG copy for slides."""
    for ext in ("pdf", "png"):
        fig.savefig(FIGDIR / f"{name}.{ext}", bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)


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
BAR = {"edgecolor": BLACK, "lw": 0.5, "zorder": 2}
WORSE = {"facecolor": "white", "edgecolor": RED, "hatch": "//////", "lw": 0.6, "zorder": 2}


def fig_highnoise():
    fast = STATS["fast"]
    fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(FULL_WIDTH, 1.95), layout="constrained")
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.02, wspace=0.06)
    x = np.arange(len(METHOD_ORDER))
    ok = [fast[m]["ok"] / fast[m]["trials"] for m in METHOD_ORDER]
    lo = [fast[m]["frames_ci"][0] for m in METHOD_ORDER]
    hi = [fast[m]["frames_ci"][1] for m in METHOD_ORDER]
    ax0.bar(x, ok, 0.6, facecolor=BLUE, **BAR)
    ax0.errorbar(x, ok, yerr=[np.subtract(ok, lo), np.subtract(hi, ok)], fmt="none",
                 ecolor=BLACK, lw=0.7, zorder=3)
    for xi, m in zip(x, METHOD_ORDER):
        ax0.text(xi, 1.035, f"{fast[m]['ok']}/{fast[m]['trials']}", ha="center", fontsize=7)
    ax0.set_ylim(0, 1.13)
    ax0.set_yticks(np.arange(0, 1.01, 0.25))
    ax0.set_ylabel("Frames delivered")

    base = fast["none"]["decoded_ber"]
    dec = [fast[m]["decoded_ber"] for m in METHOD_ORDER]
    cis = [fast[m].get("decoded_ci", (0, 0)) for m in METHOD_ORDER]
    for xi, m, d in zip(x, METHOD_ORDER, dec):
        if m == "none":
            ax1.bar(xi, d, 0.6, facecolor=GREY, **BAR)
        elif d > base + 1e-9:
            ax1.bar(xi, d, 0.6, **WORSE)
        else:
            ax1.bar(xi, d, 0.6, facecolor=BLUE, **BAR)
    ax1.errorbar(x, dec, yerr=[[d - c[0] for d, c in zip(dec, cis)],
                               [c[1] - d for d, c in zip(dec, cis)]],
                 fmt="none", ecolor=BLACK, lw=0.7, zorder=3)
    ax1.axhline(base, color=BLACK, ls="--", lw=0.8, zorder=1)
    ax1.set_ylabel("Decoded BER")
    for ax, label in ((ax0, "(a)"), (ax1, "(b)")):
        ax.set_xticks(x)
        ax.set_xticklabels(METHOD_ORDER, rotation=35, ha="right")
        ax.tick_params(axis="x", which="both", top=False)
        ax.set_xlim(-0.6, len(x) - 0.4)
        ax.yaxis.grid(True)
        ax.set_axisbelow(True)
        panel_label(ax, label)
    save(fig, "highnoise-bars")


def fig_noise(slices, run_hist):
    fig = plt.figure(figsize=(FULL_WIDTH, 3.1), layout="constrained")
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.03, wspace=0.06, hspace=0.06)
    gs = fig.add_gridspec(2, 2, height_ratios=[0.8, 1.0])

    ax0 = fig.add_subplot(gs[0, :])
    examples = [("8 bps", t, BLUE) for t in slices[FAST] if t.method == "Hamming"]
    examples += [("glare", t, RED) for t in slices[GLARE]
                 if t.observed and 30 < len(t.error_positions) < 90][:3]
    for y, (label, t, colour) in enumerate(examples):
        ax0.plot([0, t.observed], [y, y], color=LIGHT, lw=0.5, zorder=1,
                 solid_capstyle="butt")
        if t.observed < 400:
            ax0.add_patch(plt.Rectangle((t.observed, y - 0.36), 400 - t.observed, 0.72,
                                        facecolor="none", edgecolor=GREY, hatch="//////",
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
    handles = [Patch(facecolor=BLUE, lw=0, label="Facing the screen, 8 bps"),
               Patch(facecolor=RED, lw=0, label="Reflection with glare, 4 bps"),
               Patch(facecolor="none", edgecolor=GREY, hatch="//////", lw=0,
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
    ax1.bar(x - 0.2, errors_by_run(observed[FAST]), 0.38, facecolor=BLUE, **BAR,
            label="8 bps, observed")
    ax1.bar(x + 0.2, errors_by_run(observed[GLARE]), 0.38, facecolor="white", edgecolor=RED,
            hatch="/////", lw=0.6, zorder=2, label="Glare, observed")
    ax1.plot(x + 0.2, errors_by_run(run_hist["GE"]), "o", color=BLACK, ms=3.5, zorder=3,
             label="Glare, fitted G-E model")
    ax1.plot(x + 0.2, errors_by_run(run_hist["memoryless"]), "x", color=GREY, ms=4.5,
             mew=1.0, zorder=3, label="Glare, memoryless model")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.tick_params(axis="x", which="both", top=False)
    ax1.set_xlim(-0.6, len(labels) - 0.4)
    ax1.set_ylim(0, 1.0)
    ax1.set_xlabel("Error-run length (bits)")
    ax1.set_ylabel("Share of errors")
    ax1.legend(loc="upper right", borderaxespad=0.3)
    panel_label(ax1, "(b)")

    ax2 = fig.add_subplot(gs[1, 1])
    for name, colour, style, mfc, label in (
            (FAST, BLUE, "o-", BLUE, "Facing the screen, 8 bps"),
            (GLARE, RED, "s--", "white", "Reflection with glare, 4 bps")):
        rates = STATS["noise"][name]["run_position_rate"]
        keys = sorted(rates)
        ax2.plot(keys, [rates[k][0] / rates[k][1] for k in keys], style, color=colour,
                 mfc=mfc, label=label)
    ax2.set_xticks(range(1, 7))
    ax2.set_xticklabels(["1", "2", "3", "4", "5", "6+"])
    ax2.set_xlabel("Position within a run of the same colour")
    ax2.set_ylabel("Bit error rate")
    ax2.set_ylim(0, 0.4)
    ax2.legend(loc="upper left")
    panel_label(ax2, "(c)")
    for ax in (ax1, ax2):
        ax.yaxis.grid(True)
        ax.set_axisbelow(True)
    save(fig, "noise-regimes")


def fig_extension():
    fig, (ax0, ax1) = plt.subplots(1, 2, figsize=(FULL_WIDTH, 2.05), layout="constrained",
                                   gridspec_kw={"width_ratios": [1, 1.15]})
    fig.get_layout_engine().set(w_pad=0.02, h_pad=0.02, wspace=0.06)
    bursts = burst_experiment.run()
    STATS["controlled_burst"] = {name: means for name, (means, _) in bursts.items()}
    lengths = np.arange(1, burst_experiment.MAX_BURST + 1)
    styles = {"Hamming": (RED, "s", "--", "white"),
              "Hamming-interleaved": (BLUE, "o", "-", BLUE),
              "repetition-3": (BLACK, "^", ":", BLACK)}
    for name, (means, ses) in bursts.items():
        colour, marker, ls, mfc = styles[name]
        ax0.errorbar(lengths, means, yerr=ses, color=colour, marker=marker, ls=ls, mfc=mfc,
                     ms=3, lw=0.9, elinewidth=0.6, label=name)
    ax0.axvline(8, color=GREY, ls=":", lw=0.8)
    ax0.set_xlabel("Burst length (bits flipped)")
    ax0.set_ylabel("Mean decoded BER")
    ax0.set_xticks([1, 4, 8, 12, 16])
    ax0.set_xlim(0.5, 16.5)
    ax0.yaxis.grid(True)
    ax0.set_axisbelow(True)
    ax0.legend(loc="upper left")
    panel_label(ax0, "(a)")

    design = STATS["design"][GLARE]
    names = [layout.name for layout in LAYOUTS]
    values = [design[n]["payload"] for n in names]
    x = np.arange(len(names))
    for xi, n, v in zip(x, names, values):
        if "adjacent" in n or n == "Hamming":
            ax1.bar(xi, v, 0.6, **WORSE)
        else:
            ax1.bar(xi, v, 0.6, facecolor=BLUE, **BAR)
        ax1.text(xi, v + 0.015, f"{v:.2f}", ha="center", fontsize=6.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(names, rotation=35, ha="right")
    ax1.tick_params(axis="x", which="both", top=False)
    ax1.set_xlim(-0.6, len(x) - 0.4)
    ax1.set_ylabel("P(payload decoded)")
    ax1.set_ylim(0, max(values) * 1.18)
    ax1.yaxis.grid(True)
    ax1.set_axisbelow(True)
    panel_label(ax1, "(b)")
    save(fig, "extension")


def main():
    trials = load()
    slices = by_slice(trials)
    write_tables(slices)
    models, run_hist = noise_analysis(slices)
    design_study(models)
    fig_highnoise()
    fig_noise(slices, run_hist)
    fig_extension()
    STATS["slow_glare"] = {
        "errors": sum(len(t.error_positions) for t in slices[SLOW]),
        "bits": sum(t.observed for t in slices[SLOW]),
        "ok": sum(t.record.frame_valid for t in slices[SLOW]), "trials": len(slices[SLOW]),
    }
    (GENDIR / "stats.json").write_text(json.dumps(STATS, indent=1, default=float))
    print(json.dumps(STATS, indent=1, default=float))


if __name__ == "__main__":
    main()
