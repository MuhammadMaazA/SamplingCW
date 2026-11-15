"""Plots and statistics for the presentation.

Reads the recorded measurements in ../experiments/results (and the backup folder for the one
short pipeline test kept only there) and writes PNG figures, plots/stats.json and
plots/manifest.json into plots/. Every figure is drawn at the size it is placed on the slide.
Run with gridlink/.venv/Scripts/python.exe make_plots.py from presentation/, or pass figure
names to redraw only some of them, for example: make_plots.py traces wilson
"""
from __future__ import annotations

import csv
import collections
import itertools
import json
import math
import ntpath
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

import plotstyle as ps
from plotstyle import ACCENT, GREY1, GREY2, GREY3, GREY4, INK, WHITE, box, new_fig, overlay, panel

import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Rectangle

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
RES = REPO / "experiments" / "results"
BACKUP = REPO.parent / "gridlink-results-backup" / "results"
OUT = HERE / "plots"
OUT.mkdir(exist_ok=True)

sys.path.insert(0, str(REPO / "report"))
from data import by_slice, load as load_trials  # noqa: E402  same loader and groups as the report
from gridlink.experiments.channel_model import (  # noqa: E402
    GilbertElliott, fit_gilbert_elliott, memoryless_log_likelihood, sample_errors)
from gridlink.experiments.stats import fisher_exact, wilson_interval  # noqa: E402

SESS = {
    "facing3": "monitor-room-comparison-20261030-180441-714350Z",
    "facing3_abort": "monitor-room-comparison-20261030-180312-849922Z",
    "facing8": "final-comparison-20261031-150350-900428Z",
    "reflect4": "full1b-lab-comparison-20261027-174408-573804Z",
    "reflect4b": "test-lab-repetition-3-20261027-163916-214973Z",
    "facing4": "quick-lab-repetition-3-20261027-173212-078354Z",
    "outside": "full1-laboutside-comparison-20261027-170708-296161Z",
    "glare_a": "quiet1-lab-repetition-3-20261026-163304-310902Z",
    "glare_b": "quiet1b-lab-repetition-3-20261026-164839-135418Z",
    "glare_c": "quiet1c-lab-repetition-3-20261026-170042-409100Z",
    "glare_d": "quiet1d-lab-repetition-3-20261026-171013-285528Z",
    "glare_e": "quiet1e-lab-repetition-3-20261026-171657-143340Z",
    "glare2": "quiet2bps-lab-repetition-3-20261026-172410-806159Z",
}
PHYSICAL = "glare-layouts-room-comparison-20261106-021921-294106Z"
GLARE4 = ["glare_a", "glare_b", "glare_c", "glare_d", "glare_e"]
RESULTS_FILE = {"facing3": "results-t114.csv", "reflect4": "results-corrected.csv"}
stats: dict = {}
manifest: dict = {}


def put(fig, name, what):
    """Save a figure at its drawn size and record it in the manifest for the slide builder."""
    w, h = fig.get_size_inches()
    ps.save(fig, OUT, name)
    manifest[name] = {"inches": [round(w, 2), round(h, 2)], "pixels": list(Image.open(OUT / name).size), "shows": what}


# ---------------------------------------------------------------- loading
def load_summary():
    with open(RES / "report-final" / "summary.csv", newline="") as fh:
        return {r["group"]: r for r in csv.DictReader(fh)}


def load_results(key):
    f = RESULTS_FILE.get(key, "results.csv")
    with open(RES / SESS[key] / f, newline="") as fh:
        return list(csv.DictReader(fh))


def load_capture(key):
    folder = RES / SESS[key]
    f = folder / ("capture-dedup.csv" if (folder / "capture-dedup.csv").exists() else "capture.csv")
    ts, v = [], []
    for line in open(f):
        if line.startswith("#") or line.startswith("timestamp"):
            continue
        a, b = line.strip().split(",")
        ts.append(float(a)); v.append(float(b))
    return np.array(ts), np.array(v)


def trials_by_session():
    """Transmitted and received bits per trial, with where the capture ended, from error-positions.csv."""
    out = collections.defaultdict(list)
    cache = {}
    with open(RES / "report-final" / "error-positions.csv", newline="") as fh:
        rows = list(csv.DictReader(fh))
    folder_to_key = {v: k for k, v in SESS.items()}
    for r in rows:
        d = ntpath.basename(ntpath.dirname(r["source"])); f = ntpath.basename(r["source"])
        if (d, f) not in cache:
            with open(RES / d / f, newline="") as fh:
                cache[(d, f)] = {x["run_id"]: x for x in csv.DictReader(fh)}
        x = cache[(d, f)][r["run_id"]]
        obs = int(r["observed_bits"])
        pos = [int(p) for p in r["error_positions"].split()]
        t, rc = x["transmitted_bits"][:obs], x["received_bits"][:obs]
        assert [i for i in range(obs) if t[i] != rc[i]] == pos
        out[folder_to_key[d]].append({"tx": t, "rx": rc, "frame_len": len(x["transmitted_bits"]), "obs": obs,
                                      "tail": int(r["unavailable_tail_bits"]), "pos": pos, "run_id": r["run_id"]})
    return out


summary = load_summary()
TR = trials_by_session()


def wilson(k, n):
    return wilson_interval(k, n)


def pooled(groups):
    """Frames delivered, trials, and the per-group channel BER for a list of summary groups."""
    k = sum(int(summary[g]["valid_frames"]) for g in groups)
    n = sum(int(summary[g]["trials"]) for g in groups)
    return k, n, [float(summary[g]["channel_ber"]) for g in groups]


# ---------------------------------------------------------------- setup numbers
def symbol_levels(key):
    ts, v = load_capture(key)
    ones, zeros = [], []
    for x in load_results(key):
        if not x["frame_start"]:
            continue
        fs, dur = float(x["frame_start"]), float(x["symbol_duration"])
        for i, b in enumerate(x["transmitted_bits"]):
            c = fs + (i + 0.5) * dur
            j = np.searchsorted(ts, c)
            if j >= len(ts):
                break
            if j > 0 and abs(ts[j - 1] - c) < abs(ts[j] - c):
                j -= 1
            if abs(ts[j] - c) > dur:
                continue
            (ones if b == "1" else zeros).append(v[j])
    return np.array(ones), np.array(zeros), ts


def setup_numbers():
    rows = []
    for env, keys in [("Facing screen, 3 bps", ["facing3"]), ("Facing screen, 8 bps", ["facing8"]),
                      ("Reflection, 4 bps", ["reflect4"]), ("Reflection with glare, 4 bps", GLARE4),
                      ("Reflection with glare, 2 bps", ["glare2"])]:
        fps, thr, white, black, overlap, roi, rates, spb = [], [], [], [], [], [], set(), []
        for k in keys:
            sj = json.load(open(RES / SESS[k] / "session.json"))
            ones, zeros, ts = symbol_levels(k)
            fps.append((len(ts) - 1) / (ts[-1] - ts[0])); spb.append(fps[-1] / sj["bit_rate"])
            t = float(load_results(k)[0]["threshold"]); thr.append(t)
            white.append(np.median(ones)); black.append(np.median(zeros))
            overlap.append(((zeros > t).sum() + (ones < t).sum()) / (len(ones) + len(zeros)))
            roi_line = [l for l in open(RES / SESS[k] / "capture.csv") if l.startswith("# roi=")][0]
            w, h = roi_line.strip().split("=")[1].split(",")[2:]
            roi.append((int(w) * int(h), f"{w} by {h}")); rates.add(sj["bit_rate"])
        rows.append({
            "env": env, "bit_rates": sorted(rates),
            "fps_min": round(min(fps), 1), "fps_max": round(max(fps), 1),
            "thr_min": round(min(thr), 1), "thr_max": round(max(thr), 1),
            "white_med": round(float(np.median(white))), "black_med": round(float(np.median(black))),
            "spb_min": round(min(spb), 1), "spb_max": round(max(spb), 1), "roi_min": min(roi)[1], "roi_max": max(roi)[1], "sessions": len(keys),
        })
    stats["setup"] = rows


# ---------------------------------------------------------------- failure breakdown
def failures():
    envs = [("Facing screen, 3 bps", [f"G{i:02d}" for i in range(1, 8)]),
            ("Facing screen, 8 bps", [f"G{i:02d}" for i in range(8, 15)]),
            ("Reflection, 4 bps", [f"G{i:02d}" for i in range(15, 22)] + ["G29"]),
            ("Reflection with glare, 4 bps", [f"G{i:02d}" for i in range(22, 27)]),
            ("Reflection with glare, 2 bps", ["G27"]),
            ("Facing screen, 4 bps", ["G28"])]
    cols = ["valid_frames", "sync_failures", "truncated", "header_crc_failures", "payload_crc_failures", "uncorrectable", "other_failures"]
    rows = []
    for name, gs in envs:
        d = {c: sum(int(summary[g][c]) for g in gs) for c in cols}
        d["trials"] = sum(int(summary[g]["trials"]) for g in gs)
        assert d["trials"] == sum(d[c] for c in cols), name
        d["env"] = name
        rows.append(d)
    stats["failures"] = rows


def spread(ys, gap):
    """Nudge label heights apart so direct labels never overlap, keeping their order."""
    order = sorted(range(len(ys)), key=lambda i: ys[i])
    out = list(ys)
    for a, b in zip(order, order[1:]):
        if out[b] - out[a] < gap:
            out[b] = out[a] + gap
    return out


# ---------------------------------------------------------------- 1. raw brightness traces
def fig_traces():
    cases = [("reflect4", "full1b-000", "(a)", "Reflection, 4 bps, repetition-5"),
             ("glare_b", "quiet1-001", "(b)", "Reflection with glare, 4 bps, repetition-3")]
    W, H, ax_l, ax_w, ax_h = 9.0, 3.95, 0.95, 6.55, 1.3
    fig = new_fig(W, H)
    ov = overlay(fig)
    t0, t1 = 10, 40
    info = []
    for n_case, ((key, rid, letter, desc), top) in enumerate(zip(cases, [0.48, 2.1])):
        ax = box(fig, ax_l, top, ax_w, ax_h)
        x = [r for r in load_results(key) if r["run_id"] == rid][0]
        ts, v = load_capture(key)
        fs, dur, thr = float(x["frame_start"]), float(x["symbol_duration"]), float(x["threshold"])
        tx, rx = x["transmitted_bits"], x["received_bits"]
        for i, b in enumerate(tx):
            a = i * dur
            if b == "1" and t0 - dur <= a <= t1:
                ax.axvspan(a, a + dur, color=GREY4, alpha=0.85, lw=0, zorder=0)
        m = (ts - fs >= t0) & (ts - fs <= t1)
        ax.plot(ts[m] - fs, v[m], color=INK, lw=1.3, zorder=2)
        ax.axhline(thr, color=GREY1, lw=1.4, ls=(0, (5, 3)), zorder=3)
        n_bits = min(len(tx), len(rx))
        err_idx = [i for i in range(n_bits) if tx[i] != rx[i]]
        errs = [(i + 0.5) * dur for i in err_idx if t0 <= (i + 0.5) * dur <= t1]
        ax.plot(errs, [262] * len(errs), "|", color=ACCENT, ms=8, mew=1.5, zorder=4)
        ax.set_ylim(0, 280); ax.set_xlim(t0, t1); ax.set_yticks([0, 100, 200])
        ax.set_ylabel("Brightness\n(0 to 255)", fontsize=11)
        if n_case == 0:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("Time since frame start (s)")
        panel(ax, letter, f"{desc}, {len(err_idx) if err_idx else 'no'} errors in this frame")
        # direct labels in the right margin, at the height of the line they name
        y_in = lambda val: H - top - ax_h + val / 280 * ax_h
        labels = [("camera brightness", INK, float(v[m][-1])), (f"threshold {thr:.0f}", GREY1, thr)]
        if errs:
            labels.append(("bit errors", ACCENT, 262))
        heights = spread([y_in(val) for _, _, val in labels], 0.2)
        for (text, col, _), yy in zip(labels, heights):
            ov.text(ax_l + ax_w + 0.12, yy, text, color=col, fontsize=11, va="center", ha="left")
        if n_case == 0:
            ov.add_patch(Rectangle((ax_l + ax_w + 0.12, y_in(255) - 0.06), 0.2, 0.12, fc=GREY4, ec="none"))
            ov.text(ax_l + ax_w + 0.4, y_in(255), "white sent", color=GREY1, fontsize=11, va="center", ha="left")
        info.append({"run": rid, "threshold": thr, "errors_in_window": len(errs), "errors_in_frame": len(err_idx)})
    put(fig, "raw-traces.png", "Camera brightness over 30 s for a clean reflection frame and a glare frame, threshold and bit errors marked")
    stats["traces"] = info
    for key, name in [("reflect4", "crop-clean.png"), ("glare_b", "crop-glare.png"), ("glare_c", "crop-glare-c.png")]:
        if not (OUT / name).exists():
            im = Image.open(RES / SESS[key] / "capture.png").convert("RGB")
            s = max(1, 400 // max(im.size))
            im = im.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST) if s > 1 else im
            im.save(OUT / name)
    stats["crops"] = {k: Image.open(RES / SESS[k] / "capture.png").size for k in ["reflect4", "glare_b", "glare_c"]}


# ---------------------------------------------------------------- 2. Wilson intervals
def label(r):
    c = r["coding"]
    return {"none": "none", "hamming": "Hamming", "hamming-interleaved": "Ham-interl.", "parity2d": "2-D parity"}.get(
        c, f"rep-{r['repetitions']}")


ORDER = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."]
OUTCOME = {"all": (INK, "o", "3 of 3 delivered"), "some": (GREY2, "D", "1 or 2 of 3"), "none": (ACCENT, "s", "0 of 3")}


def outcome(k, n):
    return "all" if k == n else ("none" if k == 0 else "some")


def fisher_one_sided(a, b, n):
    """P(group A has >= a successes) given a+b successes in two groups of n, hypergeometric."""
    K = a + b
    tot = math.comb(2 * n, K)
    return sum(math.comb(n, i) * math.comb(n, K - i) for i in range(a, min(n, K) + 1)) / tot


def outcome_key(ov, x, y):
    """One line key for the three outcome markers, drawn in inch coordinates."""
    for name in ("all", "some", "none"):
        col, mk, text = OUTCOME[name]
        ov.plot(x, y, mk, color=col, ms=8 if mk != "D" else 7, mec="none")
        ov.text(x + 0.15, y, text, va="center", ha="left", fontsize=11, color=GREY1)
        x += 0.35 + 0.085 * len(text)


def fig_wilson():
    panels = [("Facing screen, 3 bps", "Facing, 3 bps", range(1, 8)), ("Facing screen, 8 bps", "Facing, 8 bps", range(8, 15)),
              ("Reflection, 4 bps", "Reflection, 4 bps", range(15, 22))]
    W, H = 9.0, 3.95
    fig = new_fig(W, H); ov = overlay(fig)
    lw, gap, left0, top, ph = 2.05, 0.62, 1.15, 0.5, 2.5
    out = []
    for j, (name, short, rng) in enumerate(panels):
        ax = box(fig, left0 + j * (lw + gap), top, lw, ph)
        rows = {label(summary[f"G{i:02d}"]): summary[f"G{i:02d}"] for i in rng}
        for y, m in enumerate(ORDER):
            r = rows[m]; k, n = int(r["valid_frames"]), int(r["trials"])
            lo, hi = wilson(k, n)
            col, mk, _ = OUTCOME[outcome(k, n)]
            ax.plot([lo, hi], [y, y], color=col, lw=2.0, solid_capstyle="round", zorder=2)
            ax.plot(k / n, y, mk, color=col, ms=8 if mk != "D" else 7, mec="none", zorder=3)
            ax.text(1.12, y, f"{k}/{n}", ha="left", va="center", fontsize=11, color=GREY1, clip_on=False)
            out.append({"env": name, "method": m, "k": k, "n": n, "lo": round(lo, 2), "hi": round(hi, 2)})
        panel(ax, f"({'abc'[j]})", short)
        ax.set_xlim(-0.04, 1.04); ax.set_xticks([0, 0.5, 1]); ax.set_xticklabels(["0", "0.5", "1"])
        ax.set_ylim(len(ORDER) - 0.5, -0.5)
        ax.grid(axis="x"); ax.set_axisbelow(True)
        ax.set_yticks(range(len(ORDER)))
        if j:
            ax.set_yticklabels([]); ax.tick_params(left=False)
        else:
            ax.set_yticklabels(ORDER)
    ov.text(left0 + (3 * lw + 2 * gap) / 2, 0.52, "Fraction of frames delivered, with 95% Wilson intervals",
            ha="center", va="center", fontsize=12, color=INK)
    outcome_key(ov, left0 + 0.9, 0.17)
    put(fig, "wilson.png", "Frames delivered per method with Wilson 95 percent intervals for the three seven-method sessions")
    stats["wilson"] = out
    stats["wilson_3of3"] = [round(x, 2) for x in wilson(3, 3)]
    stats["wilson_0of3"] = [round(x, 2) for x in wilson(0, 3)]
    stats["fisher_rep7_vs_hamming_8bps_one_sided"] = round(fisher_one_sided(3, 0, 3), 3)


# ---------------------------------------------------------------- 3. rate against reliability
RATE = {"none": 1.0, "2-D parity": 16 / 25, "Hamming": 4 / 7, "Ham-interl.": 4 / 7, "rep-3": 1 / 3, "rep-5": 1 / 5, "rep-7": 1 / 7}
# label offsets in points (dx, dy, alignment) per panel and method, chosen so labels never collide
OFFS = {
    (0, "none"): (-7, 10, "right"), (0, "2-D parity"): (7, -13, "left"), (0, "Ham-interl."): (-7, 10, "right"),
    (0, "Hamming"): (9, 0, "left"), (0, "rep-3"): (9, 0, "left"), (0, "rep-5"): (9, 0, "left"), (0, "rep-7"): (9, -3, "left"),
    (1, "none"): (0, 12, "center"), (1, "Hamming"): (9, 0, "left"), (1, "2-D parity"): (9, 0, "left"),
    (1, "Ham-interl."): (-9, 0, "right"), (1, "rep-7"): (9, 6, "left"), (1, "rep-3"): (9, 0, "left"), (1, "rep-5"): (9, 0, "left"),
}


def fig_tradeoff():
    panels = [("Reflection, 4 bps", range(15, 22)), ("Facing screen, 8 bps", range(8, 15))]
    W, H = 9.0, 3.95
    fig = new_fig(W, H); ov = overlay(fig)
    lw, gap, left0, top, ph = 3.5, 0.6, 1.0, 0.5, 2.5
    out = []
    for j, (name, rng) in enumerate(panels):
        ax = box(fig, left0 + j * (lw + gap), top, lw, ph)
        for i in rng:
            r = summary[f"G{i:02d}"]; m = label(r)
            k, n = int(r["valid_frames"]), int(r["trials"])
            x, y = RATE[m], float(r["useful_throughput_bps"])
            col, mk, _ = OUTCOME[outcome(k, n)]
            ax.plot(x, y, mk, color=col, ms=9 if mk != "D" else 8, mec="none", zorder=3)
            dx, dy, ha = OFFS[(j, m)]
            ax.annotate(f"{m} {k}/{n}", (x, y), xytext=(dx, dy), textcoords="offset points", ha=ha, va="center", fontsize=11, color=INK)
            out.append({"env": name, "method": m, "code_rate": round(x, 3), "throughput": round(y, 3), "ok": f"{k}/{n}"})
        panel(ax, f"({'ab'[j]})", name)
        ax.set_xlim(0, 1.1); ax.set_ylim(-0.02, 0.31)
        ax.set_xticks([1 / 7, 1 / 3, 4 / 7, 1]); ax.set_xticklabels(["1/7", "1/3", "4/7", "1"])
        ax.set_yticks([0, 0.1, 0.2, 0.3]); ax.set_yticklabels(["0", "0.1", "0.2", "0.3"])
        ax.grid(True); ax.set_axisbelow(True)
        if j:
            ax.set_yticklabels([]); ax.tick_params(left=False)
        else:
            ax.set_ylabel("Useful throughput (bps)")
    ov.text(left0 + (2 * lw + gap) / 2, 0.52, "Code rate, information bits per bit sent", ha="center", va="center", fontsize=12)
    outcome_key(ov, left0 + 0.9, 0.17)
    put(fig, "tradeoff.png", "Useful throughput against code rate for every method, labelled with frames delivered of 3, two setups")
    stats["tradeoff"] = out


# ---------------------------------------------------------------- 4. two kinds of noise
ISOLATED = ("final-comparison", {"final-007", "final-012", "final-016"})
BURSTS = ("quiet1b-lab", {"quiet1-001", "quiet1-002"})


def fig_noise_regimes():
    iso, bur = [], []
    with open(RES / "report-final" / "error-positions.csv", newline="") as fh:
        for r in csv.DictReader(fh):
            rec = {"pos": [int(x) for x in r["error_positions"].split()], "obs": int(r["observed_bits"]),
                   "tail": int(r["unavailable_tail_bits"])}
            for (src, ids), dst in [(ISOLATED, iso), (BURSTS, bur)]:
                if r["run_id"] in ids and src in r["source"]:
                    dst.append(rec)

    def runs(trials):
        out = []
        for t in trials:
            e = set(t["pos"])
            out += [len(list(g)) for v, g in itertools.groupby(range(max(e) + 1), key=lambda i: i in e) if v] if e else []
        return np.array(out)

    bins = [(1, 1), (2, 2), (3, 4), (5, 7), (8, 12), (13, 99)]
    names = ["1", "2", "3-4", "5-7", "8-12", "13+"]
    frac = lambda r: [((r >= lo) & (r <= hi)).sum() / max(len(r), 1) for lo, hi in bins]
    ri, rb = runs(iso), runs(bur)
    W, H = 9.0, 3.6
    fig = new_fig(W, H); ov = overlay(fig)
    ax0 = box(fig, 1.55, 0.5, 4.3, 2.55)
    y, centres = 0, {}
    for name, trials, col in [("iso", iso, INK), ("bur", bur, ACCENT)]:
        first = y
        for t in trials:
            ax0.add_patch(Rectangle((0, y - 0.38), t["obs"], 0.76, fc=GREY4, ec="none", alpha=0.6))
            for p in t["pos"]:
                ax0.add_patch(Rectangle((p - 0.5, y - 0.38), 1.0, 0.76, fc=col, ec="none"))
            y += 1
        centres[name] = (first + y - 1) / 2
        y += 0.7
    ax0.set_xlim(0, 400); ax0.set_ylim(y - 0.7 - 0.5, -0.6); ax0.set_yticks([])
    ax0.spines["left"].set_visible(False)
    ax0.set_xlabel("Position in the transmitted frame (bit)")
    panel(ax0, "(a)", "One row per trial, one tick per wrong bit")
    h_in = lambda yy: H - 0.5 - 2.55 + (ax0.get_ylim()[0] - yy) / (ax0.get_ylim()[0] - ax0.get_ylim()[1]) * 2.55
    ov.text(1.45, h_in(centres["iso"]), "Facing, 8 bps\nisolated flips", color=INK, ha="right", va="center", fontsize=11)
    ov.text(1.45, h_in(centres["bur"]), "Glare, 4 bps\nbursts", color=ACCENT, ha="right", va="center", fontsize=11)
    ax1 = box(fig, 6.5, 0.5, 2.4, 2.55)
    x = np.arange(len(names)); w = 0.4
    ax1.bar(x - w / 2, frac(ri), w, color=INK)
    ax1.bar(x + w / 2, frac(rb), w, color=ACCENT)
    ax1.set_xticks(x); ax1.set_xticklabels(names, fontsize=11)
    ax1.set_xlabel("Error run length (bits)"); ax1.set_ylim(0, 1.05)
    ax1.set_yticks([0, 0.5, 1]); ax1.set_yticklabels(["0", "50%", "100%"])
    ax1.grid(axis="y"); ax1.set_axisbelow(True)
    panel(ax1, "(b)", "Share of runs")
    ax1.text(5.4, 0.93, "isolated", color=INK, ha="right", fontsize=11)
    ax1.text(5.4, 0.8, "glare", color=ACCENT, ha="right", fontsize=11)
    put(fig, "noise-regimes.png", "Error positions and run length shares for isolated flips against bursts")
    stats["noise_regimes"] = {"isolated_single_share": round(float((ri == 1).mean()), 3),
                              "burst_errors_in_runs_ge3": round(float(rb[rb >= 3].sum() / rb.sum()), 3),
                              "longest_burst": int(rb.max())}


# ---------------------------------------------------------------- 5. bit pattern dependence and random flip test
def depth_curve(keys, maxd=12):
    n = collections.Counter(); e = collections.Counter()
    for k in keys:
        for t in TR[k]:
            tx, rx = t["tx"], t["rx"]
            d = 0
            for i in range(len(tx)):
                d = d + 1 if i > 0 and tx[i] == tx[i - 1] else 1
                if tx[i] != "0":
                    continue
                n[min(d, maxd + 1)] += 1; e[min(d, maxd + 1)] += tx[i] != rx[i]
    return [{"depth": d, "errors": e[d], "bits": n[d], "rate": round(e[d] / n[d], 4)} for d in range(1, maxd + 1)]


def flip_sides(keys):
    up = down = 0
    one_dir_trials = err_trials = 0
    for k in keys:
        for t in TR[k]:
            u = sum(1 for a, b in zip(t["tx"], t["rx"]) if a == "0" and b == "1")
            dn = sum(1 for a, b in zip(t["tx"], t["rx"]) if a == "1" and b == "0")
            up += u; down += dn
            if u + dn:
                err_trials += 1
                if min(u, dn) <= max(1, 0.05 * (u + dn)):
                    one_dir_trials += 1
    return {"black_read_white": up, "white_read_black": down, "trials_with_errors": err_trials, "trials_mostly_one_way": one_dir_trials}


def quarters(keys):
    """Observed errors per quarter of the frame, and the count predicted by the bit pattern alone."""
    n = collections.Counter(); e = collections.Counter(); items = []
    for k in keys:
        for t in TR[k]:
            tx, rx, L = t["tx"], t["rx"], t["frame_len"]
            d = 0
            for i in range(len(tx)):
                d = d + 1 if i > 0 and tx[i] == tx[i - 1] else 1
                key = (tx[i], min(d, 13))
                n[key] += 1; err = tx[i] != rx[i]; e[key] += err
                items.append((min(int(4 * i / L), 3), key, err))
    obs = np.zeros(4); pred = np.zeros(4)
    for q, key, err in items:
        obs[q] += err; pred[q] += e[key] / n[key]
    return [int(x) for x in obs], [round(float(x)) for x in pred]


def pattern():
    stats["depth_facing8"] = depth_curve(["facing8"])
    stats["depth_glare4"] = depth_curve(GLARE4)
    stats["flips_facing8"] = flip_sides(["facing8"])
    stats["flips_glare4"] = flip_sides(GLARE4)
    o, p = quarters(GLARE4)
    stats["quarters_glare4"] = {"observed": o, "pattern_predicted": p}
    o, p = quarters(["facing8"])
    stats["quarters_facing8"] = {"observed": o, "pattern_predicted": p}
    stats["glare_mean_pos"] = {}
    for k in GLARE4:
        ps_ = [i / t["frame_len"] for t in TR[k] for i in range(len(t["tx"])) if t["tx"][i] != t["rx"][i]]
        stats["glare_mean_pos"][k] = round(float(np.mean(ps_)), 2)


def regime(keys):
    runs = []; N = E = 0; R = ER = VR = 0.0; ee = eprev = oe = oprev = 0
    for k in keys:
        for t in TR[k]:
            e = [int(a != b) for a, b in zip(t["tx"], t["rx"])]
            if not e:
                continue
            n = len(e); n1 = sum(e); n0 = n - n1
            N += n; E += n1
            runs += [len(list(g)) for v, g in itertools.groupby(e) if v == 1]
            R += 1 + sum(e[i] != e[i - 1] for i in range(1, n))
            if n1 and n0:
                ER += 2 * n1 * n0 / n + 1
                VR += 2 * n1 * n0 * (2 * n1 * n0 - n) / (n * n * (n - 1))
            else:
                ER += 1
            for i in range(1, n):
                if e[i - 1]:
                    eprev += 1; ee += e[i]
                else:
                    oprev += 1; oe += e[i]
    runs = np.array(runs); p = E / N
    return {
        "bits": N, "errors": E, "ber": round(p, 4), "n_runs": len(runs), "max_run": int(runs.max()),
        "mean_run": round(float(runs.mean()), 2),
        "frac_errors_in_runs_ge3": round(float(runs[runs >= 3].sum() / runs.sum()), 3),
        "frac_runs_ge3": round(float((runs >= 3).mean()), 3),
        "geom_frac_runs_ge3": round(p * p, 4),
        "runs_test_R": int(R), "runs_test_expected": round(ER, 1), "runs_test_z": round((R - ER) / math.sqrt(VR), 2),
        "p_err_after_err": round(ee / eprev, 3), "p_err_after_ok": round(oe / oprev, 4),
        "_runs": runs.tolist(),
    }


def pct(v, _pos=None):
    return f"{v * 100:g}%"


def fig_run_lengths():
    regs = [("Facing screen, 8 bps", ["facing8"], INK, "Facing, 8 bps"),
            ("Reflection with glare, 4 bps", GLARE4, ACCENT, "Glare, 4 bps")]
    W, H = 4.6, 3.4
    fig = new_fig(W, H)
    ax = box(fig, 0.95, 0.2, 3.5, 2.55)
    ks = np.arange(1, 17)
    res = {}
    for j, (name, keys, col, short) in enumerate(regs):
        r = regime(keys); runs = np.array(r.pop("_runs")); p = r["ber"]
        obs = np.array([(runs == k).sum() for k in ks]) / len(runs)
        geo = (1 - p) * p ** (ks - 1)
        ax.bar(ks + (j - 0.5) * 0.4, np.where(obs > 0, obs, np.nan), 0.4, color=col, zorder=3)
        ax.plot(ks, geo, "--", color=col, lw=1.4, zorder=4)
        ax.plot(ks, geo, "o", color=col, ms=3.5, mfc="white", zorder=4)
        res[name] = r
    ax.set_yscale("log"); ax.set_ylim(3e-4, 1.6)
    ax.set_yticks([1e-3, 1e-2, 1e-1, 1]); ax.yaxis.set_major_formatter(plt.FuncFormatter(pct)); ax.minorticks_off()
    ax.set_xlim(0.3, 16.7); ax.set_xticks([1, 4, 8, 12, 16])
    ax.set_xlabel("Error run length (bits)"); ax.set_ylabel("Share of error runs")
    ax.grid(axis="y"); ax.set_axisbelow(True)
    ax.text(16.4, 0.62, "Facing, 8 bps", color=INK, ha="right", va="center", fontsize=11)
    ax.text(16.4, 0.27, "Glare, 4 bps", color=ACCENT, ha="right", va="center", fontsize=11)
    ax.text(16.4, 0.09, "dashed: independent flips", color=GREY1, ha="right", va="center", fontsize=11)
    put(fig, "fig-run-lengths.png", "Share of error runs by length for facing 8 bps and glare against the independent flip expectation")
    stats["model"] = res


# ---------------------------------------------------------------- 6. repetition, theory against reality
def maj(p, n):
    return sum(math.comb(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n // 2 + 1, n + 1))


def fig_repetition():
    pts = []
    for g, r in summary.items():
        if r["coding"] != "repetition" or int(r["decoded_trials"]) == 0:
            continue
        pts.append({"group": g, "n": int(r["repetitions"]), "channel": float(r["channel_ber"]),
                    "decoded": float(r["decoded_ber"]), "theory": maj(float(r["channel_ber"]), int(r["repetitions"]))})
    W, H, ax_l, ax_w, top, ph = 6.6, 4.2, 0.95, 4.35, 0.2, 3.3
    fig = new_fig(W, H); ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, ph)
    p = np.linspace(0, 0.33, 200)
    sty = {3: (INK, "-", "o"), 5: (GREY1, "--", "s"), 7: (GREY2, "-.", "^")}
    ax.plot(p, p, color=GREY2, lw=1.2, ls=":")
    ends = [("no coding", GREY2, 0.30)]
    for n in (3, 5, 7):
        col, ls, _ = sty[n]
        ax.plot(p, [maj(x, n) for x in p], color=col, lw=1.8, ls=ls)
        ends.append((f"rep-{n} theory", col, maj(0.33, n)))
    glare = {f"G{i}" for i in range(22, 28)}
    for pt in pts:
        col, _, mk = sty[pt["n"]]
        if pt["group"] in glare:
            ax.plot(pt["channel"], pt["decoded"], "o", color=ACCENT, ms=8, mec="none", zorder=4)
        else:
            ax.plot(pt["channel"], pt["decoded"], mk, color=INK, ms=6, mec="white", mew=0.6, zorder=3)
    g25 = [q for q in pts if q["group"] == "G25"][0]
    ax.plot([g25["channel"]] * 2, [g25["theory"], g25["decoded"]], color=ACCENT, lw=1.2, ls=":", zorder=2)
    ax.annotate(f"G25 in glare, measured {g25['decoded']:.3f}\ntheory predicts {g25['theory']:.3f}",
                (g25["channel"], g25["decoded"]), xytext=(0.095, 0.246), textcoords="data", color=ACCENT, fontsize=11, va="center",
                arrowprops=dict(arrowstyle="-", color=ACCENT, lw=0.9, shrinkA=2, shrinkB=4))
    ax.set_xlim(0, 0.33); ax.set_ylim(-0.005, 0.31); ax.set_xticks(np.arange(0, 0.31, 0.05))
    ax.set_xlabel("Channel BER, whole frame (errors per bit)")
    ax.set_ylabel("Decoded BER (errors per bit)")
    ax.grid(True); ax.set_axisbelow(True)
    ys = spread([H - top - ph + (v + 0.005) / 0.315 * ph for _, _, v in ends], 0.22)
    for (text, col, _), yy in zip(ends, ys):
        ov.text(ax_l + ax_w + 0.1, yy, text, color=col, fontsize=11, va="center", ha="left")
    ov.plot(ax_l + ax_w + 0.16, 0.62, "o", color=ACCENT, ms=7, mec="none")
    ov.text(ax_l + ax_w + 0.3, 0.62, "glare runs", color=ACCENT, fontsize=11, va="center")
    ov.plot(ax_l + ax_w + 0.16, 0.38, "o", color=INK, ms=6, mec="none")
    ov.text(ax_l + ax_w + 0.3, 0.38, "other runs", color=INK, fontsize=11, va="center")
    put(fig, "repetition-theory.png", "Majority vote theory curves for repetition 3, 5 and 7 with every measured repetition run overlaid")
    for pt in pts:
        pt["theory"] = round(pt["theory"], 4)
    stats["repetition"] = pts


# ---------------------------------------------------------------- 7. every recording on a date axis
def results_counts(path):
    rows = list(csv.DictReader(open(path, newline="")))
    return len(rows), sum(1 for r in rows if r["frame_start"]), sum(1 for r in rows if r["frame_valid"] == "True")


def session_start(key):
    return datetime.fromisoformat(json.load(open(RES / SESS[key] / "session.json"))["created_utc"][:19])


def recordings():
    """Every recording with its lane, planned trials, frames delivered and outcome, all read from the saved files."""
    out = []

    def add(lane, start, planned, filmed, valid, note=""):
        if planned == 0 or filmed < planned / 2:
            kind = "unusable"
        else:
            kind = "delivered" if valid >= planned / 2 else "lost"
        if kind != "unusable":
            text = f"{valid} of {planned}"
        elif planned == 0:
            text = "pipeline test"
        elif filmed == 0:
            text = note
        else:
            text = f"{valid} of {planned}, only {filmed} filmed"
        out.append({"lane": lane, "start": start.isoformat(), "planned": planned, "filmed": filmed, "valid": valid,
                    "kind": kind, "label": text})

    total = [results_counts(RES / SESS[k] / "results.csv") for k in GLARE4]
    add("Glare, 4 bps", session_start("glare_a"), sum(t[0] for t in total), sum(t[1] for t in total), sum(t[2] for t in total))
    c = results_counts(RES / SESS["glare2"] / "results.csv")
    add("Glare, 2 bps", session_start("glare2"), *c)
    log = open(BACKUP / "debug1.log").readline().split()[0]
    add("Pipeline test", datetime.fromisoformat(log[:19]), 0, 0, 0)
    add("Reflection, 4 bps", session_start("reflect4b"), *results_counts(RES / SESS["reflect4b"] / "results.csv"))
    outside = results_counts(REPO / "experiments" / "extra-analysis" / "full1-A-thr93-results.csv")
    add("Outside the lab, 2 bps", session_start("outside"), *outside)
    add("Facing, 4 bps", session_start("facing4"), *results_counts(RES / SESS["facing4"] / "results.csv"))
    add("Reflection, 4 bps", session_start("reflect4"), *results_counts(RES / SESS["reflect4"] / RESULTS_FILE["reflect4"]))
    elapsed = re.search(r"elapsed=([\d.]+)s", open(RES / SESS["facing3_abort"] / "capture.log").read()).group(1)
    planned = json.load(open(RES / SESS["facing3_abort"] / "session.json"))["trials"]
    add("Facing, 3 bps", session_start("facing3_abort"), planned, 0, 0, note=f"stopped at {float(elapsed):.1f} s")
    add("Facing, 3 bps", session_start("facing3"), *results_counts(RES / SESS["facing3"] / RESULTS_FILE["facing3"]))
    add("Facing, 8 bps", session_start("facing8"), *results_counts(RES / SESS["facing8"] / "results.csv"))
    return sorted(out, key=lambda r: r["start"])


KIND_COLOUR = {"delivered": INK, "lost": ACCENT, "unusable": GREY2}
LABEL_LEFT = {("Outside the lab, 2 bps", "unusable"), ("Facing, 3 bps", "unusable"), ("Facing, 8 bps", "lost")}


def fig_sessions_timeline():
    recs = recordings()
    stats["sessions"] = recs
    lanes = []
    for r in recs:
        if r["lane"] not in lanes:
            lanes.append(r["lane"])
    days = sorted({r["start"][:10] for r in recs})
    first, last = datetime.fromisoformat(days[0]).date(), datetime.fromisoformat(days[-1]).date()
    cols, d = [], first
    while d <= last:
        cols.append(d); d = datetime.fromordinal(d.toordinal() + 1).date()
    per_day = {c: [r for r in recs if r["start"][:10] == c.isoformat()] for c in cols}
    weight = {c: (len(v) + 0.7 if v else 0.9) for c, v in per_day.items()}
    L, TOP, AW, AH = 1.95, 0.5, 6.95, 2.4
    unit = AW / sum(weight.values())
    fig = new_fig(9.0, 3.6); ov = overlay(fig)
    ax = box(fig, L, TOP, AW, AH)
    ax.set_xlim(0, AW); ax.set_ylim(len(lanes) - 0.5, -0.5)
    for i in range(len(lanes)):
        ax.axhline(i, color=GREY3, lw=0.6, zorder=0)
    x0, xs, labels = 0.0, [], []
    for c in cols:
        w = weight[c] * unit
        ax.axvline(x0, color=GREY3, lw=0.8, zorder=0)
        recs_day = per_day[c]
        name = c.strftime("%d %b").lstrip("0") if recs_day else str(c.day)
        ax.text(x0 + w / 2, -0.62, name, ha="center", va="bottom", fontsize=11, color=GREY1 if recs_day else GREY2, clip_on=False)
        if not recs_day:
            ax.axvspan(x0, x0 + w, color=GREY4, alpha=0.3, lw=0)
        for i, r in enumerate(recs_day):
            r["x"] = x0 + (i + 0.5) * w / len(recs_day)
            xs.append(r["x"]); labels.append(r["start"][11:16])
        x0 += w
    ax.axvline(x0, color=GREY3, lw=0.8, zorder=0)
    ax.text((weight[cols[2]] * unit + weight[cols[1]] * unit + weight[cols[0]] * unit) + weight[cols[3]] * unit, 3.5,
            "no\nrecordings", ha="center", va="center", fontsize=11, color=GREY2)
    for r in recs:
        y = lanes.index(r["lane"])
        col = KIND_COLOUR[r["kind"]]
        if r["planned"] == 0:
            ax.scatter(r["x"], y, s=44, facecolors="none", edgecolors=col, linewidths=1.6, zorder=3)
            rad = 4
        else:
            area = 14 * r["planned"]
            ax.scatter(r["x"], y, s=area, color=col, edgecolors="none", zorder=3)
            rad = math.sqrt(area / math.pi)
        left = (r["lane"], r["kind"]) in LABEL_LEFT
        ax.annotate(r["label"], (r["x"], y), xytext=(-(rad + 5) if left else rad + 5, 0), textcoords="offset points",
                    ha="right" if left else "left", va="center", fontsize=11,
                    color=INK if r["kind"] != "unusable" else GREY1, fontweight="bold" if r["kind"] != "unusable" else "normal")
    ax.set_yticks(range(len(lanes))); ax.set_yticklabels(lanes); ax.tick_params(axis="y", length=0)
    ax.spines["left"].set_visible(False)
    ax.set_xticks(xs); ax.set_xticklabels(labels, fontsize=11)
    ov.text(L, 0.18, "time of day (UTC), in order within each day", ha="left", va="center", fontsize=11, color=GREY1)
    ov.text(0.1, 3.3, "marker area =\nplanned trials", ha="left", va="center", fontsize=11, color=GREY1)
    x = 5.75
    for kind, text in (("delivered", "mostly delivered"), ("lost", "mostly lost"), ("unusable", "not usable")):
        ov.plot(x, 0.18, "o", color=KIND_COLOUR[kind], ms=8, mec="none")
        ov.text(x + 0.12, 0.18, text, ha="left", va="center", fontsize=11, color=GREY1)
        x += 0.28 + 0.068 * len(text)
    put(fig, "fig-sessions-timeline.png", "Every recording on a date axis, by setup, marker area is planned trials, colour is outcome")


# ---------------------------------------------------------------- 8. the four one-variable changes
def grp(a, b):
    return [f"G{i:02d}" for i in range(a, b + 1)]


CHANGES = [
    ("fig-change-speed-facing.png", ("3 bps", grp(1, 7)), ("8 bps", grp(8, 14)), "speed, facing the screen"),
    ("fig-change-path.png", ("Reflection", grp(15, 21) + ["G29"]), ("Facing", ["G28"]), "camera path at 4 bps"),
    ("fig-change-lighting.png", ("Normal" + chr(10) + "light", grp(15, 21)), ("Dim," + chr(10) + "glare", grp(22, 26)), "lighting, reflection, 4 bps"),
    ("fig-change-speed-glare.png", ("4 bps", grp(22, 26)), ("2 bps", ["G27"]), "speed in glare"),
]


def fig_changes():
    stats["changes"] = {}
    for fname, (name_a, ga), (name_b, gb), what in CHANGES:
        W, H = 4.3, 3.2
        fig = new_fig(W, H)
        axl = box(fig, 0.55, 0.55, 1.45, 1.9)
        axr = box(fig, 2.55, 0.55, 1.6, 1.9)
        entry = {}
        top_ber = 0.0
        for x, (name, groups, col) in enumerate([(name_a, ga, INK), (name_b, gb, ACCENT)]):
            k, n, bers = pooled(groups)
            lo, hi = wilson(k, n)
            axl.plot([x, x], [lo, hi], color=col, lw=2.6, solid_capstyle="round", zorder=2)
            axl.plot(x, k / n, "o", color=col, ms=9, mec="none", zorder=3)
            axl.text(x, hi + 0.05, f"{k} of {n}", ha="center", va="bottom", fontsize=11, color=INK, fontweight="bold")
            jit = np.linspace(-0.14, 0.14, len(bers)) if len(bers) > 1 else [0.0]
            order = np.argsort(bers)
            vals = [bers[i] * 100 for i in order]
            axr.plot(np.array(jit) + x, vals, "o", color=col, ms=7, mec="none", alpha=0.9, zorder=3)
            med = float(np.median(vals))
            axr.plot([x - 0.3, x + 0.3], [med, med], color=INK, lw=1.8, zorder=4)
            top_ber = max(top_ber, max(vals))
            entry["ab"[x]] = {"label": name.replace(chr(10), " "), "groups": groups, "frames": k, "trials": n,
                              "wilson": [round(lo, 3), round(hi, 3)], "channel_ber_pct": [round(v, 3) for v in vals],
                              "median_channel_ber_pct": round(med, 3)}
        axl.set_xlim(-0.6, 1.6); axl.set_ylim(-0.04, 1.28)
        axl.set_yticks([0, 0.5, 1]); axl.set_yticklabels(["0%", "50%", "100%"]); axl.grid(axis="y"); axl.set_axisbelow(True)
        axr.set_xlim(-0.6, 1.6); axr.set_ylim(-0.06 * top_ber, top_ber * 1.15)
        axr.yaxis.set_major_locator(mpl.ticker.MaxNLocator(4, min_n_ticks=3)); axr.yaxis.set_major_formatter(mpl.ticker.FormatStrFormatter("%g"))
        axr.grid(axis="y"); axr.set_axisbelow(True)
        for ax in (axl, axr):
            ax.set_xticks([0, 1]); ax.set_xticklabels([name_a, name_b])
            ax.get_xticklabels()[0].set_color(INK); ax.get_xticklabels()[1].set_color(ACCENT)
            ax.tick_params(axis="x", length=0, pad=6)
        panel(axl, "(a)", "Frames delivered")
        panel(axr, "(b)", "Channel BER (%)")
        put(fig, fname, f"{what}: condition A against condition B, frames delivered with Wilson intervals and channel BER per group")
        stats["changes"][fname.replace("fig-change-", "").replace(".png", "")] = entry


# ---------------------------------------------------------------- 9. brightness levels of sent black and white symbols
def fig_levels():
    cases = [("reflect4", "Reflection, no glare, G15 to G21"), ("glare_c", "Reflection with glare, G24")]
    W, H = 9.0, 3.3
    fig = new_fig(W, H); ov = overlay(fig)
    bins = np.arange(0, 260, 4)
    centres = bins[:-1] + 2
    stats["levels"] = {}
    for j, (key, desc) in enumerate(cases):
        ones, zeros, _ = symbol_levels(key)
        thr = float(load_results(key)[0]["threshold"])
        ax = box(fig, 1.05 + j * 4.0, 0.5, 3.55, 1.95)
        sz = np.histogram(zeros, bins)[0] / len(zeros) * 100
        so = np.histogram(ones, bins)[0] / len(ones) * 100
        ax.bar(centres, so, width=4, color=np.where(centres < thr, ACCENT, GREY2), alpha=0.85, zorder=2)
        ax.bar(centres, sz, width=4, color=np.where(centres >= thr, ACCENT, INK), alpha=0.8, zorder=3)
        p5z, p95z = np.percentile(zeros, [1, 99]); p5o, p95o = np.percentile(ones, [1, 99])
        lo, hi = max(p5z, p5o), min(p95z, p95o)
        if lo < hi:
            ax.axvspan(lo, hi, color=ACCENT, alpha=0.10, lw=0, zorder=1)
        ax.axvline(thr, color=GREY1, lw=1.4, ls=(0, (5, 3)), zorder=4)
        wrong = float(((zeros > thr).sum() + (ones < thr).sum()) / (len(zeros) + len(ones)))
        top = max(sz.max(), so.max())
        ax.set_ylim(0, top * 1.38); ax.set_xlim(0, 258); ax.set_xticks([0, 50, 100, 150, 200, 250])
        right = thr > 128
        ax.text(thr + (-3 if right else 3), top * 1.3, f"threshold {thr:.0f}", color=GREY1, fontsize=11, va="center", ha="right" if right else "left")
        ax.text(centres[sz.argmax()], sz.max() + top * 0.04, "sent black", color=INK, fontsize=11, ha="center", va="bottom")
        if right:
            ax.text(256, top * 1.05, "sent white", color=GREY1, fontsize=11, ha="right", va="bottom")
        else:
            ax.text(centres[so.argmax()], so.max() + top * 0.04, "sent white", color=GREY1, fontsize=11, ha="center", va="bottom")
        ax.text(6 if right else 256, top * (0.93 if right else 0.62), (f"{wrong * 100:.1f}%" if wrong >= 0.001 else f"{wrong * 100:.2f}%") + " of symbols" + chr(10) + "on the wrong side",
                color=ACCENT, fontsize=11, ha="left" if right else "right", va="center", fontweight="bold")
        ax.yaxis.set_major_formatter(mpl.ticker.FormatStrFormatter("%g%%"))
        ax.grid(axis="y"); ax.set_axisbelow(True)
        if j == 0:
            ax.set_ylabel("Share of symbols of that colour")
        panel(ax, f"({'ab'[j]})", desc)
        stats["levels"][key] = {"threshold": thr, "n_black": int(len(zeros)), "n_white": int(len(ones)),
                                "median_black": round(float(np.median(zeros)), 1), "median_white": round(float(np.median(ones)), 1),
                                "wrong_side_share": round(wrong, 4), "overlap_band": [round(float(lo), 1), round(float(hi), 1)] if lo < hi else None}
    ov.text(1.05 + (4.0 + 3.55) / 2, 0.18, "Camera brightness at the centre of each symbol (0 to 255)", ha="center", va="center", fontsize=12)
    put(fig, "fig-levels.png", "Brightness at symbol centres for sent black and sent white, clean reflection against glare, with the threshold and the overlap")


# ---------------------------------------------------------------- 10. camera frames against symbol boundaries
def fig_sampling():
    cases = [("facing8", 8), ("reflect4", 4), ("glare2", 2)]
    n_sym = 6
    W, H = 9.0, 2.8
    fig = new_fig(W, H); ov = overlay(fig)
    left, wd, row_h, gap, top0 = 2.0, 6.8, 0.56, 0.14, 0.08
    stats["sampling"] = []
    for r, (key, bps) in enumerate(cases):
        x0 = [x for x in load_results(key) if x["frame_start"]][0]
        fs, dur, bits = float(x0["frame_start"]), float(x0["symbol_duration"]), x0["transmitted_bits"]
        ts, _ = load_capture(key)
        flips = lambda i: sum(bits[a] != bits[a + 1] for a in range(i, i + n_sym - 1))
        s0 = next(i for i in range(28, len(bits) - n_sym) if len(set(bits[i:i + n_sym])) == 2 and 3 <= flips(i) <= 4)
        t_lo = fs + s0 * dur
        xpos = (ts[(ts >= t_lo) & (ts < t_lo + n_sym * dur)] - t_lo) / dur
        ax = box(fig, left, top0 + r * (row_h + gap), wd, row_h)
        ax.set_xlim(0, n_sym); ax.set_ylim(0, 1.05)
        picked = []
        for i in range(n_sym):
            if bits[s0 + i] == "1":
                ax.axvspan(i, i + 1, color=GREY4, alpha=0.85, lw=0, zorder=0)
            picked.append(int(np.argmin(np.abs(xpos - (i + 0.5)))))
        ax.vlines(range(n_sym + 1), 0, 1.05, color=INK, lw=0.9, ls=(0, (2, 2)), zorder=1)
        ax.vlines(xpos, 0, 0.55, color=GREY1, lw=1.3, zorder=2)
        ax.vlines(xpos[picked], 0, 0.9, color=ACCENT, lw=2.6, zorder=3)
        ax.plot(xpos[picked], [0.93] * len(picked), "o", color=ACCENT, ms=5, mec="none", zorder=3)
        ax.set_yticks([]); ax.spines["left"].set_visible(False)
        if r < len(cases) - 1:
            ax.spines["bottom"].set_visible(False); ax.set_xticks([])
        else:
            ax.set_xticks(range(n_sym + 1)); ax.set_xlabel("Time, in symbol periods")
        ts_all, _ = load_capture(key)
        per_bit = (len(ts_all) - 1) / (ts_all[-1] - ts_all[0]) * dur
        in_window = [int(((xpos >= i) & (xpos < i + 1)).sum()) for i in range(n_sym)]
        yc = H - (top0 + r * (row_h + gap) + row_h / 2)
        ov.text(0.1, yc + 0.1, f"{bps} bps", fontsize=13, fontweight="bold", color=INK, va="center", ha="left")
        ov.text(0.1, yc - 0.14, f"{per_bit:.1f} camera frames per bit", fontsize=11, color=GREY1, va="center", ha="left")
        stats["sampling"].append({"bps": bps, "frames_per_bit": round(float(per_bit), 1), "frames_in_window": in_window})
    ov.text(0.1, 0.4, "shaded: white sent", ha="left", va="center", fontsize=11, color=GREY1)
    ov.text(0.1, 0.18, "unshaded: black sent", ha="left", va="center", fontsize=11, color=GREY1)
    put(fig, "fig-sampling.png", "Real camera frame timestamps against symbol boundaries at 8, 4 and 2 bps with the sampled frame highlighted")


# ---------------------------------------------------------------- 11. every analysed trial, error positions by setup
def fig_error_raster():
    setups = [("Facing, 4 bps", ["facing4"], INK), ("Reflection, 4 bps", ["reflect4", "reflect4b"], INK),
              ("Glare, 2 bps", ["glare2"], ACCENT), ("Facing, 3 bps", ["facing3"], INK),
              ("Facing, 8 bps", ["facing8"], INK), ("Glare, 4 bps", GLARE4, ACCENT)]
    data = []
    for name, keys, col in setups:
        trials = [t for k in keys for t in TR[k]]
        errors, bits = sum(len(t["pos"]) for t in trials), sum(t["obs"] for t in trials)
        data.append((errors / bits, name, trials, col, errors, bits))
    data.sort(key=lambda d: d[0])
    W, H, ax_l, ax_w, top, ah = 9.0, 4.2, 1.85, 6.3, 0.4, 3.2
    fig = new_fig(W, H); ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, ah)
    gap = 2.2
    total = sum(len(d[2]) for d in data) + gap * (len(data) - 1)
    y, stats["raster"] = 0.0, []
    for rate, name, trials, col, errors, bits in data:
        start = y
        for t in trials:
            if t["obs"]:
                ax.add_patch(Rectangle((0, y + 0.1), t["obs"], 0.8, fc=GREY4, ec="none", alpha=0.7, zorder=1))
            if t["obs"] < t["frame_len"]:
                ax.add_patch(Rectangle((t["obs"], y + 0.1), t["frame_len"] - t["obs"], 0.8, fc="none", ec=GREY2, lw=0, hatch="//////", zorder=1))
            if t["pos"]:
                ax.broken_barh([(p - 0.5, 1.0) for p in t["pos"]], (y + 0.05, 0.9), facecolors=col, zorder=2)
            y += 1
        mid = (start + y) / 2
        yy = H - top - (mid / total) * ah if False else H - top - ah + (1 - mid / total) * ah
        ov.text(ax_l - 0.12, yy, f"{name}" + chr(10) + f"{len(trials)} trials", ha="right", va="center", fontsize=11, color=col)
        ov.text(ax_l + ax_w + 0.08, yy, ("0%" if rate == 0 else f"{rate * 100:.1f}%" if rate >= 0.01 else f"{rate * 100:.2f}%"), ha="left", va="center", fontsize=11, color=GREY1)
        stats["raster"].append({"setup": name, "trials": len(trials), "errors": errors, "observed_bits": bits, "channel_ber": round(rate, 5)})
        y += gap
    ax.set_xlim(0, 470); ax.set_ylim(total, -0.3); ax.set_yticks([]); ax.spines["left"].set_visible(False)
    ax.set_xticks(range(0, 451, 50))
    ax.set_xlabel("Position in the transmitted frame (bit)")
    ov.text(ax_l + ax_w + 0.08, H - 0.2, "channel BER", ha="left", va="center", fontsize=11, color=GREY1)
    put(fig, "fig-error-raster.png", "Error positions in every trial of every analysed group, one row per trial, grouped by setup and ordered by channel BER")


# ---------------------------------------------------------------- 12. the fitted burst model against a real glare frame
def fig_ge_fit():
    glare = [t for t in by_slice(load_trials())["4 bps glare"] if t.observed]
    seqs = [t.error_sequence for t in glare]
    ge = fit_gilbert_elliott(seqs)
    flip, _ = memoryless_log_likelihood(seqs)
    full = [t for t in glare if t.observed == len(t.record.transmitted_bits)]
    counts = sorted(len(t.error_positions) for t in full)
    real = min(full, key=lambda t: abs(len(t.error_positions) - counts[len(counts) // 2]))
    n = real.observed
    rng = np.random.default_rng(3)
    draws = [np.flatnonzero(sample_errors(ge, n, rng)) for _ in range(3)]
    memoryless = np.flatnonzero(rng.random(n) < flip)
    rows = [("Measured frame", real.error_positions, ACCENT, True), ("Two-state model, draw 1", draws[0], ACCENT, False),
            ("draw 2", draws[1], ACCENT, False), ("draw 3", draws[2], ACCENT, False), ("Memoryless, same BER", memoryless, GREY2, False)]
    W, H, ax_l, ax_w, top, rh, gap = 9.0, 3.0, 2.35, 5.85, 0.12, 0.34, 0.08
    fig = new_fig(W, H); ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, len(rows) * (rh + gap) - gap)
    for i, (name, pos, col, bold) in enumerate(rows):
        y = i * (rh + gap)
        ax.add_patch(Rectangle((0, y), n, rh, fc=GREY4, ec="none", alpha=0.55, zorder=1))
        if len(pos):
            ax.broken_barh([(p - 0.5, 1.0) for p in pos], (y, rh), facecolors=col, alpha=0.7 if i in (1, 2, 3) else 1.0, zorder=2)
        yy = H - top - (y + rh / 2)
        ov.text(ax_l - 0.12, yy, name, ha="right", va="center", fontsize=11, color=col if i in (0, 4) else INK, fontweight="bold" if bold else "normal")
        ov.text(ax_l + ax_w + 0.06, yy, f"{len(pos)} errors", ha="left", va="center", fontsize=11, color=GREY1)
    ax.set_xlim(0, n); ax.set_ylim(len(rows) * (rh + gap) - gap, 0); ax.set_yticks([]); ax.spines["left"].set_visible(False)
    ax.set_xticks(range(0, n + 1, 50)); ax.set_xlabel("Position in the frame (bit)")
    ov.text(ax_l, 0.1, f"Fitted to all glare frames: bad spells last {ge.mean_bad_length:.1f} bits on average and cover {ge.bad_fraction * 100:.0f}% of bits",
            ha="left", va="center", fontsize=11, color=GREY1)
    put(fig, "fig-ge-fit.png", "One real glare frame, three frames drawn from the fitted two-state model, and one memoryless draw at the same average rate")
    stats["ge_fit"] = {"p_good_to_bad": round(ge.p_good_to_bad, 4), "p_bad_to_good": round(ge.p_bad_to_good, 4),
                       "error_good": round(ge.error_good[0], 4), "error_bad": round(ge.error_bad[0], 4),
                       "mean_bad_length": round(ge.mean_bad_length, 2), "bad_fraction": round(ge.bad_fraction, 4),
                       "memoryless_flip": round(flip, 4), "real_frame": real.record.run_id, "real_errors": len(real.error_positions)}


# ---------------------------------------------------------------- 13. physical test of the new layouts
LAYOUTS = [  # coding, repetitions, spread header, label, short label, as built layout it is compared with
    ("repetition", "3", "False", "rep-3 adjacent", "rep-3", None),
    ("repetition-spread", "3", "False", "rep-3 spread", "rep-3 spread", "rep-3 adjacent"),
    ("repetition-spread", "3", "True", "rep-3 spread +sh", "rep-3 spread +sh", "rep-3 adjacent"),
    ("hamming-interleaved", "1", "False", "Ham-int depth 8", "Ham d8", None),
    ("hamming-interleaved-16", "1", "False", "Ham-int depth 16", "Ham d16", "Ham-int depth 8"),
    ("hamming-interleaved-16", "1", "True", "Ham-int depth 16 +sh", "Ham d16 +sh", "Ham-int depth 8"),
]


def physical():
    rows = {(r["coding"], r["repetitions"], r["spread_header"]): r
            for r in csv.DictReader(open(RES / PHYSICAL / "summary.csv", newline=""))}
    out = []
    for coding, reps, sh, name, short, base in LAYOUTS:
        r = rows[(coding, reps, sh)]
        k, n = int(r["valid_frames"]), int(r["trials"])
        lo, hi = wilson(k, n)
        out.append({"label": name, "short": short, "coding": coding, "repetitions": int(reps), "spread_header": sh == "True",
                    "frames": k, "n": n, "wilson_lo": round(lo, 3), "wilson_hi": round(hi, 3),
                    "channel_ber": float(r["channel_ber"]), "decoded_ber": float(r["decoded_ber"]),
                    "useful_throughput_bps": float(r["useful_throughput_bps"]), "baseline": base})
    by_label = {e["label"]: e for e in out}
    for e in out:
        b = by_label.get(e["baseline"]) if e["baseline"] else None
        e["fisher_p_vs_baseline"] = None if b is None else round(
            fisher_exact(e["frames"], e["n"] - e["frames"], b["frames"], b["n"] - b["frames"]), 4)
    glare = [float(summary[g]["channel_ber"]) for g in grp(22, 26)]
    ps_ = [e["fisher_p_vs_baseline"] for e in out if e["fisher_p_vs_baseline"] is not None]
    stats["physical"] = {
        "session": PHYSICAL, "layouts": out,
        "frames_range": [min(e["frames"] for e in out), max(e["frames"] for e in out)],
        "channel_ber_range_pct": [round(min(e["channel_ber"] for e in out) * 100, 2), round(max(e["channel_ber"] for e in out) * 100, 2)],
        "original_glare_channel_ber_range_pct": [round(min(glare) * 100, 1), round(max(glare) * 100, 1)],
        "fisher_p_range": [min(ps_), max(ps_)],
    }


def fig_physical_frames():
    L = stats["physical"]["layouts"]
    W, H, ax_l, ax_w, top, ah = 5.6, 3.5, 1.85, 2.45, 0.45, 2.05
    fig = new_fig(W, H); ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, ah)
    for i, e in enumerate(L):
        base = e["baseline"] is None
        col, mk = (INK, "o") if base else (ACCENT, "D")
        ax.plot([e["wilson_lo"], e["wilson_hi"]], [i, i], color=col, lw=2.4, solid_capstyle="round", zorder=2)
        ax.plot(e["frames"] / e["n"], i, mk, color=col, ms=9 if base else 8, mec="none", zorder=3, clip_on=False)
        yy = H - top - (i + 0.5) / len(L) * ah
        ov.text(ax_l + ax_w + 0.1, yy, f"{e['frames']}/{e['n']}", ha="left", va="center", fontsize=11, color=GREY1)
        if e["fisher_p_vs_baseline"] is not None:
            ov.text(ax_l + ax_w + 0.62, yy, f"{e['fisher_p_vs_baseline']:.2f}", ha="left", va="center", fontsize=11, color=INK)
    ax.set_xlim(0, 1.04); ax.set_ylim(len(L) - 0.5, -0.5); ax.set_xticks([0, 0.5, 1]); ax.set_xticklabels(["0", "0.5", "1"])
    ax.set_yticks(range(len(L))); ax.set_yticklabels([e["label"] for e in L]); ax.tick_params(axis="y", length=0)
    ax.grid(axis="x"); ax.set_axisbelow(True); ax.spines["left"].set_visible(False)
    ov.text(ax_l + ax_w + 0.62, H - 0.12, "Fisher p", ha="left", va="center", fontsize=11, color=GREY1)
    ov.text(ax_l + ax_w + 0.62, H - 0.3, "vs as built", ha="left", va="center", fontsize=11, color=GREY1)
    ov.text(ax_l + ax_w / 2, 0.55, "Fraction of 12 frames delivered, with 95% Wilson intervals", ha="center", va="center", fontsize=12)
    ov.text(ax_l + ax_w / 2, 0.2, "+sh means the three header copies are spread", ha="center", va="center", fontsize=11, color=GREY1)
    put(fig, "fig-physical-frames.png", "Frames delivered of 12 for the six layouts of the physical glare layouts session with Wilson intervals and Fisher p against the as built layout")


def fig_physical_ber():
    L = stats["physical"]["layouts"]
    lo, hi = stats["physical"]["original_glare_channel_ber_range_pct"]
    W, H, ax_l, ax_w, top, ah = 3.6, 3.5, 1.2, 1.65, 0.45, 2.05
    fig = new_fig(W, H); ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, ah)
    ax.axvspan(lo, hi, color=ACCENT, alpha=0.11, lw=0, zorder=0)
    for i, e in enumerate(L):
        col = INK if e["baseline"] is None else ACCENT
        v = e["channel_ber"] * 100
        ax.barh(i, v, height=0.55, color=col, zorder=2)
        ov.text(ax_l + ax_w + 0.1, H - top - (i + 0.5) / len(L) * ah, f"{v:.2f}%", va="center", ha="left", fontsize=11, color=INK)
    ax.text((lo + hi) / 2, 2.5, "original" + chr(10) + "glare runs" + chr(10) + f"{lo:g}% to {hi:g}%", color=ACCENT, ha="center",
            va="center", fontsize=11, fontweight="bold", linespacing=1.2)
    ax.set_xlim(0, 35); ax.set_ylim(len(L) - 0.5, -0.5); ax.set_xticks([0, 10, 20, 30])
    ax.set_yticks(range(len(L))); ax.set_yticklabels([e["short"] for e in L]); ax.tick_params(axis="y", length=0)
    ax.grid(axis="x"); ax.set_axisbelow(True); ax.spines["left"].set_visible(False)
    ov.text(ax_l + ax_w / 2, 0.55, "Channel BER (%)", ha="center", va="center", fontsize=12)
    put(fig, "fig-physical-ber.png", "Channel BER of each layout in the physical session against the range of the original glare runs, rows align with fig-physical-frames.png")


FIGURES = {
    "traces": fig_traces, "wilson": fig_wilson, "tradeoff": fig_tradeoff, "noise": fig_noise_regimes, "runlengths": fig_run_lengths,
    "repetition": fig_repetition, "timeline": fig_sessions_timeline, "changes": fig_changes, "levels": fig_levels,
    "sampling": fig_sampling, "raster": fig_error_raster, "gefit": fig_ge_fit, "physical_frames": fig_physical_frames,
    "physical_ber": fig_physical_ber,
}


def write_stats():
    def clean(o):
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        raise TypeError(type(o))
    for name, data in (("stats.json", stats), ("manifest.json", manifest)):
        tmp = OUT / (name + ".tmp")
        tmp.write_text(json.dumps(data, indent=1, default=clean))
        tmp.replace(OUT / name)


if __name__ == "__main__":
    wanted = sys.argv[1:]
    if not wanted:
        setup_numbers(); failures(); pattern()
    physical()
    for name, fn in FIGURES.items():
        if not wanted or name in wanted:
            print("drawing", name)
            fn()
    if not wanted:
        write_stats()
        print(f"wrote {len(manifest)} figures and stats.json")
