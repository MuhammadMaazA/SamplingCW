"""Plots and statistics for the GridLink presentation.

Reads the physical measurements in ../experiments/results and writes
PNG figures plus plots/stats.json (numbers used by build_deck.js) into plots/.
Run with gridlink/.venv/Scripts/python.exe make_plots.py from presentation/.
"""
from __future__ import annotations

import csv
import collections
import itertools
import json
import math
import ntpath
from pathlib import Path

import matplotlib as mpl
mpl.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
RES = HERE.parent / "experiments" / "results"
OUT = HERE / "plots"
OUT.mkdir(exist_ok=True)

INK, DK2, GRID = "#1B1F24", "#4A525C", "#E3E6EA"
BLUE, CLAY, GREEN, AMBER, GREY = "#3B6EA5", "#C1553B", "#4F8A6B", "#E0A33A", "#8A929B"
# Publication style in the spirit of IEEE figures. Every figure is drawn at the size it is
# inserted on the slide, so the point sizes below are the sizes the audience sees.
mpl.rcParams.update({
    "font.family": "sans-serif", "font.sans-serif": ["Calibri", "Arial", "DejaVu Sans"], "font.size": 11,
    "axes.edgecolor": INK, "axes.linewidth": 0.8, "axes.labelcolor": INK, "axes.labelsize": 12,
    "axes.spines.top": True, "axes.spines.right": True, "axes.grid": False,
    "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "xtick.direction": "in", "ytick.direction": "in", "xtick.top": True, "ytick.right": True,
    "xtick.major.width": 0.8, "ytick.major.width": 0.8, "xtick.minor.width": 0.6, "ytick.minor.width": 0.6,
    "xtick.major.size": 3.5, "ytick.major.size": 3.5, "xtick.minor.size": 2, "ytick.minor.size": 2,
    "xtick.labelsize": 11, "ytick.labelsize": 11, "legend.fontsize": 11, "legend.frameon": False,
    "lines.linewidth": 1.4, "lines.markersize": 5.5, "patch.linewidth": 0,
    "grid.color": "#B8BEC5", "grid.linestyle": ":", "grid.linewidth": 0.6,
    "hatch.color": "white", "hatch.linewidth": 0.8,
    "figure.dpi": 100, "savefig.dpi": 300, "figure.facecolor": "white",
})


def panel(ax, label):
    """Panel label such as (a) at the top left, just above the axes box."""
    ax.text(0, 1.03, label, transform=ax.transAxes, ha="left", va="bottom", fontsize=12, fontweight="bold")

SESS = {
    "facing3": "monitor-room-comparison-20261030-180441-714350Z",
    "facing8": "final-comparison-20261031-150350-900428Z",
    "reflect4": "full1b-lab-comparison-20261027-174408-573804Z",
    "reflect4b": "test-lab-repetition-3-20261027-163916-214973Z",
    "facing4": "quick-lab-repetition-3-20261027-173212-078354Z",
    "glare_a": "quiet1-lab-repetition-3-20261026-163304-310902Z",
    "glare_b": "quiet1b-lab-repetition-3-20261026-164839-135418Z",
    "glare_c": "quiet1c-lab-repetition-3-20261026-170042-409100Z",
    "glare_d": "quiet1d-lab-repetition-3-20261026-171013-285528Z",
    "glare_e": "quiet1e-lab-repetition-3-20261026-171657-143340Z",
    "glare2": "quiet2bps-lab-repetition-3-20261026-172410-806159Z",
}
GLARE4 = ["glare_a", "glare_b", "glare_c", "glare_d", "glare_e"]
RESULTS_FILE = {"facing3": "results-t114.csv", "reflect4": "results-corrected.csv"}
stats: dict = {}


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
    """Observed transmitted and received bits per trial, from error-positions.csv sources."""
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
        out[folder_to_key[d]].append({"tx": t, "rx": rc, "frame_len": len(x["transmitted_bits"])})
    return out


summary = load_summary()
TR = trials_by_session()


# ---------------------------------------------------------------- 1. setup numbers
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


# ---------------------------------------------------------------- 2. raw traces
def fig_traces():
    cases = [("reflect4", "full1b-000", "(a) Reflection, 4 bps, repetition-5, 0 errors"),
             ("glare_b", "quiet1-001", "(b) Reflection with glare, 4 bps, repetition-3, 116 errors in this frame")]
    fig, axs = plt.subplots(2, 1, figsize=(7.05, 3.6), sharex=True, gridspec_kw={"hspace": 0.32})
    t0, t1 = 10, 40
    info = []
    for ax, (key, rid, title) in zip(axs, cases):
        x = [r for r in load_results(key) if r["run_id"] == rid][0]
        ts, v = load_capture(key)
        fs, dur, thr = float(x["frame_start"]), float(x["symbol_duration"]), float(x["threshold"])
        tx, rx = x["transmitted_bits"], x["received_bits"]
        for i, b in enumerate(tx):
            a = i * dur
            if b == "1" and t0 - dur <= a <= t1:
                ax.axvspan(a, a + dur, color="#E6E9ED", lw=0, zorder=0)
        m = (ts - fs >= t0) & (ts - fs <= t1)
        ax.plot(ts[m] - fs, v[m], color=BLUE, lw=1.2, zorder=2)
        ax.axhline(thr, color=AMBER, lw=1.4, ls="--", zorder=3)
        errs = [(i + 0.5) * dur for i in range(min(len(tx), len(rx))) if tx[i] != rx[i] and t0 <= (i + 0.5) * dur <= t1]
        ax.plot(errs, [262] * len(errs), "|", color=CLAY, ms=7, mew=1.4, zorder=4)
        ax.set_ylim(0, 280); ax.set_xlim(t0, t1); ax.set_yticks([0, 100, 200])
        panel(ax, title)
        ax.set_ylabel("Brightness (0 to 255)", fontsize=11)
        info.append({"run": rid, "threshold": thr, "errors_in_window": len(errs)})
    handles = [mpl.patches.Patch(color="#E6E9ED", label="transmitted 1"),
               mpl.lines.Line2D([], [], color=BLUE, lw=1.2, label="camera brightness"),
               mpl.lines.Line2D([], [], color=AMBER, lw=1.4, ls="--", label="threshold"),
               mpl.lines.Line2D([], [], color=CLAY, marker="|", ls="none", ms=7, mew=1.4, label="bit error")]
    axs[0].legend(handles=handles, loc="upper right", ncol=4, fontsize=11, handlelength=1.6, columnspacing=1.0,
                  borderaxespad=0.2)
    axs[1].set_xlabel("Time since frame start (s)")
    fig.savefig(OUT / "raw-traces.png", bbox_inches="tight")
    plt.close(fig)
    stats["traces"] = info
    # camera crops for the two sessions, upscaled without smoothing
    for key, name in [("reflect4", "crop-clean.png"), ("glare_b", "crop-glare.png"), ("glare_c", "crop-glare-c.png")]:
        im = Image.open(RES / SESS[key] / "capture.png").convert("RGB")
        s = max(1, 400 // max(im.size))
        im = im.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST) if s > 1 else im
        im.save(OUT / name)
    stats["crops"] = {k: Image.open(RES / SESS[k] / "capture.png").size for k in ["reflect4", "glare_b", "glare_c"]}


# ---------------------------------------------------------------- 3. failure breakdown
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


# ---------------------------------------------------------------- 4. Wilson intervals
def wilson(k, n, z=1.96):
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return max(0.0, c - h), min(1.0, c + h)


def label(r):
    c = r["coding"]
    return {"none": "none", "hamming": "Hamming", "hamming-interleaved": "Ham-interl.", "parity2d": "2-D parity"}.get(
        c, f"rep-{r['repetitions']}")


ORDER = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "2-D parity", "Ham-interl."]


def fisher_one_sided(a, b, n):
    """P(group A has >= a successes) given a+b successes in two groups of n, hypergeometric."""
    K = a + b
    tot = math.comb(2 * n, K)
    return sum(math.comb(n, i) * math.comb(n, K - i) for i in range(a, min(n, K) + 1)) / tot


def fig_wilson():
    panels = [("Facing screen, 3 bps", range(1, 8)), ("Facing screen, 8 bps", range(8, 15)), ("Reflection, 4 bps", range(15, 22))]
    fig, axs = plt.subplots(1, 3, figsize=(9.6, 3.3), sharey=True, gridspec_kw={"wspace": 0.08})
    out = []
    # colour and marker both encode the outcome, so the panels read in greyscale too
    style = {"all": (GREEN, "o", "3 of 3"), "some": (BLUE, "D", "1 or 2 of 3"), "none": (CLAY, "s", "0 of 3")}
    for j, (ax, (name, rng)) in enumerate(zip(axs, panels)):
        rows = {label(summary[f"G{i:02d}"]): summary[f"G{i:02d}"] for i in rng}
        for y, m in enumerate(ORDER):
            r = rows[m]; k, n = int(r["valid_frames"]), int(r["trials"])
            lo, hi = wilson(k, n)
            col, mk, _ = style["all" if k == n else ("none" if k == 0 else "some")]
            ax.errorbar(k / n, y, xerr=[[k / n - lo], [hi - k / n]], fmt=mk, color=col, ms=6, mec=col,
                        elinewidth=1.3, capsize=3, capthick=1.0)
            out.append({"env": name, "method": m, "k": k, "n": n, "lo": round(lo, 2), "hi": round(hi, 2)})
        panel(ax, f"({'abc'[j]}) {name}")
        ax.set_xlim(-0.08, 1.08); ax.set_xticks([0, 0.5, 1]); ax.set_xticklabels(["0", "0.5", "1"])
        ax.set_ylim(len(ORDER) - 0.4, -0.6)
        ax.grid(axis="x"); ax.set_axisbelow(True)
        ax.set_xlabel("Frame success (fraction)")
    axs[0].set_yticks(range(len(ORDER))); axs[0].set_yticklabels(ORDER)
    fig.savefig(OUT / "wilson.png", bbox_inches="tight")
    plt.close(fig)
    stats["wilson"] = out
    stats["wilson_3of3"] = [round(x, 2) for x in wilson(3, 3)]
    stats["wilson_0of3"] = [round(x, 2) for x in wilson(0, 3)]
    stats["fisher_rep7_vs_hamming_8bps_one_sided"] = round(fisher_one_sided(3, 0, 3), 3)


# ---------------------------------------------------------------- 5. pattern dependence
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
    # per session mean normalised error position in glare
    stats["glare_mean_pos"] = {}
    for k in GLARE4:
        ps = [i / t["frame_len"] for t in TR[k] for i in range(len(t["tx"])) if t["tx"][i] != t["rx"][i]]
        stats["glare_mean_pos"][k] = round(float(np.mean(ps)), 2)


# ---------------------------------------------------------------- 6. random flip model test
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


def fig_model():
    regs = [("Facing screen, 8 bps", ["facing8"], BLUE), ("Reflection with glare, 4 bps", GLARE4, CLAY)]
    fig, axs = plt.subplots(1, 2, figsize=(6.25, 2.3), sharey=True, gridspec_kw={"wspace": 0.08})
    res = {}
    short = {"Facing screen, 8 bps": "Facing 8 bps", "Reflection with glare, 4 bps": "Glare 4 bps"}
    for j, (ax, (name, keys, col)) in enumerate(zip(axs, regs)):
        r = regime(keys); runs = np.array(r.pop("_runs")); p = r["ber"]
        ks = np.arange(1, 17)
        obs = np.array([(runs == k).sum() for k in ks]) / len(runs)
        geo = (1 - p) * p ** (ks - 1)
        ax.bar(ks, np.where(obs > 0, obs, np.nan), color=col, width=0.72, label="measured")
        ax.plot(ks, geo, "o--", color=INK, ms=3.5, lw=1.2, label="random flip model")
        ax.set_yscale("log"); ax.set_ylim(1e-6, 3)
        ax.set_yticks([1e-6, 1e-4, 1e-2, 1]); ax.minorticks_off()
        ax.set_xlim(0.2, 16.8); ax.set_xticks([1, 4, 8, 12, 16])
        panel(ax, f"({'ab'[j]}) {short[name]}, BER {p:.3f}")
        ax.set_xlabel("Error run length (bits)")
        res[name] = r
    axs[0].set_ylabel("Share of runs (fraction)")
    axs[0].legend(loc="upper right", handlelength=1.6, borderaxespad=0.3)
    fig.savefig(OUT / "run-lengths.png", bbox_inches="tight")
    plt.close(fig)
    stats["model"] = res


# ---------------------------------------------------------------- 7. repetition theory
def maj(p, n):
    return sum(math.comb(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n // 2 + 1, n + 1))


def fig_repetition():
    pts = []
    for g, r in summary.items():
        if r["coding"] != "repetition" or int(r["decoded_trials"]) == 0:
            continue
        pts.append({"group": g, "n": int(r["repetitions"]), "channel": float(r["channel_ber"]),
                    "decoded": float(r["decoded_ber"]), "theory": maj(float(r["channel_ber"]), int(r["repetitions"]))})
    fig, ax = plt.subplots(figsize=(6.5, 4.1))
    p = np.linspace(0, 0.33, 200)
    sty = {3: (CLAY, "-", "o"), 5: (AMBER, "--", "s"), 7: (GREEN, "-.", "^")}
    ax.plot(p, p, color=GREY, lw=1.4, ls=":", label="no coding")
    for n in (3, 5, 7):
        col, ls, mk = sty[n]
        ax.plot(p, [maj(x, n) for x in p], color=col, lw=1.4, ls=ls)
        ax.plot([], [], color=col, lw=1.4, ls=ls, marker=mk, ms=6, label=f"rep-{n}, theory and runs")
    for pt in pts:
        col, _, mk = sty[pt["n"]]
        ax.plot(pt["channel"], pt["decoded"], mk, color=col, ms=6.5, mec=INK, mew=0.6, zorder=3)
    ax.set_xlim(0, 0.33); ax.set_ylim(-0.005, 0.30)
    ax.set_xlabel("Channel BER, whole frame (errors per bit)")
    ax.set_ylabel("Decoded BER (errors per bit)")
    ax.grid(True); ax.set_axisbelow(True)
    ax.legend(loc="upper left", handlelength=2.2, borderaxespad=0.4)
    fig.savefig(OUT / "repetition-theory.png", bbox_inches="tight")
    plt.close(fig)
    for pt in pts:
        pt["theory"] = round(pt["theory"], 4)
    stats["repetition"] = pts


# ---------------------------------------------------------------- 8. rate against reliability
RATE = {"none": 1.0, "2-D parity": 16 / 25, "Hamming": 4 / 7, "Ham-interl.": 4 / 7, "rep-3": 1 / 3, "rep-5": 1 / 5, "rep-7": 1 / 7}


OFFS = {  # label placement (dx, dy, ha) per panel and method, chosen so labels never collide
    ("Reflection, 4 bps", "none"): (-0.02, 0.019, "right"), ("Reflection, 4 bps", "2-D parity"): (0.03, 0.012, "left"),
    ("Reflection, 4 bps", "Ham-interl."): (-0.03, 0.012, "right"), ("Reflection, 4 bps", "Hamming"): (0.03, 0, "left"),
    ("Reflection, 4 bps", "rep-3"): (0.03, 0.01, "left"), ("Reflection, 4 bps", "rep-5"): (0.03, 0.006, "left"),
    ("Reflection, 4 bps", "rep-7"): (0.03, -0.012, "left"),
    ("Facing screen, 8 bps", "none"): (-0.03, 0.018, "right"), ("Facing screen, 8 bps", "Hamming"): (-0.03, 0.018, "right"),
    ("Facing screen, 8 bps", "2-D parity"): (0.03, 0.012, "left"), ("Facing screen, 8 bps", "Ham-interl."): (0.0, -0.022, "center"),
    ("Facing screen, 8 bps", "rep-7"): (0.03, 0.01, "left"), ("Facing screen, 8 bps", "rep-3"): (0.03, 0.01, "left"),
    ("Facing screen, 8 bps", "rep-5"): (0.03, -0.01, "left"),
}


def fig_tradeoff():
    panels = [("Reflection, 4 bps", range(15, 22), GREEN), ("Facing screen, 8 bps", range(8, 15), CLAY)]
    fig, axs = plt.subplots(1, 2, figsize=(10.3, 3.6), sharey=True, gridspec_kw={"wspace": 0.06})
    out = []
    for j, (ax, (name, rng, col)) in enumerate(zip(axs, panels)):
        mk = "o" if j == 0 else "s"
        for i in rng:
            r = summary[f"G{i:02d}"]; m = label(r)
            x, y = RATE[m], float(r["useful_throughput_bps"])
            ok = f"{r['valid_frames']}/{r['trials']}"
            ax.plot(x, y, mk, color=col, ms=7.5, mec=INK, mew=0.6, zorder=3)
            dx, dy, ha = OFFS[(name, m)]
            ax.text(x + dx, y + dy, f"{m}  {ok}", fontsize=11, ha=ha, va="center", color=INK)
            out.append({"env": name, "method": m, "code_rate": round(x, 3), "throughput": round(y, 3), "ok": ok})
        panel(ax, f"({'ab'[j]}) {name}")
        ax.set_xlim(0, 1.1); ax.set_ylim(-0.02, 0.31)
        ax.set_xticks([1 / 7, 1 / 3, 4 / 7, 1]); ax.set_xticklabels(["1/7", "1/3", "4/7", "1"])
        ax.grid(True); ax.set_axisbelow(True)
        ax.set_xlabel("Code rate (information bits per sent bit)")
    axs[0].set_ylabel("Useful throughput (bps)")
    fig.savefig(OUT / "tradeoff.png", bbox_inches="tight")
    plt.close(fig)
    stats["tradeoff"] = out


# ---------------------------------------------------------------- 9. noise regimes
# Same trials as gridlink/report/make_figures.py, relabelled with the presentation's setup names.
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
    fig, (ax0, ax1) = plt.subplots(2, 1, figsize=(6.0, 4.0), gridspec_kw={"height_ratios": [1, 1.05], "hspace": 0.62})
    y, ticks, labs = 0, [], []
    for name, trials, col in [("isolated", iso, BLUE), ("burst", bur, CLAY)]:
        for t in trials:
            if t["tail"]:
                ax0.add_patch(plt.Rectangle((t["obs"], y - 0.4), t["tail"], 0.8, color="#E6E9ED", lw=0))
            for p in t["pos"]:
                ax0.add_patch(plt.Rectangle((p - 0.5, y - 0.4), 1.0, 0.8, color=col, lw=0))
            ticks.append(y); labs.append(name); y += 1
        y += 0.6
    ax0.set_xlim(0, 400); ax0.set_ylim(-0.7, y - 0.6); ax0.invert_yaxis()
    ax0.set_yticks(ticks); ax0.set_yticklabels(labs); ax0.tick_params(axis="y", length=0)
    ax0.set_xlabel("Position in the transmitted frame (bit)")
    panel(ax0, "(a) Where errors fall, one row per trial")
    x = np.arange(len(names)); w = 0.4
    ax1.bar(x - w / 2, frac(ri), w, color=BLUE, label="Facing screen, 8 bps, isolated")
    ax1.bar(x + w / 2, frac(rb), w, color=CLAY, hatch="///", label="Reflection with glare, 4 bps, burst")
    ax1.set_xticks(x); ax1.set_xticklabels(names)
    ax1.set_xlabel("Error run length (bits)"); ax1.set_ylabel("Share of runs (fraction)")
    ax1.set_ylim(0, 1.08); ax1.grid(axis="y"); ax1.set_axisbelow(True); ax1.tick_params(axis="x", length=0)
    panel(ax1, "(b) Error run lengths")
    ax1.legend(loc="upper right", handlelength=1.4, borderaxespad=0.3)
    fig.savefig(OUT / "noise-regimes.png", bbox_inches="tight")
    plt.close(fig)
    stats["noise_regimes"] = {"isolated_single_share": round(float((ri == 1).mean()), 3),
                              "burst_errors_in_runs_ge3": round(float(rb[rb >= 3].sum() / rb.sum()), 3),
                              "longest_burst": int(rb.max())}


if __name__ == "__main__":
    setup_numbers()
    fig_traces()
    failures()
    fig_wilson()
    pattern()
    fig_model()
    fig_repetition()
    fig_tradeoff()
    fig_noise_regimes()
    json.dump(stats, open(OUT / "stats.json", "w"), indent=1)
    print(json.dumps(stats, indent=1))
