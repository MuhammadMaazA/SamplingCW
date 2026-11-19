"""Figures for the slides that join two earlier slides into one.

The figures job owns make_plots.py and plots/, so this script only reads from them. It reuses the loaders and the
style from there and writes its own PNGs into deck/figs/, each drawn at the size it is placed on the slide so the
text stays at 12 to 13 pt. Run with .venv/Scripts/python.exe make_merged.py from presentation/.
"""
from __future__ import annotations

import json
from pathlib import Path

import make_plots as mp
import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
import plotstyle as ps
from matplotlib.patches import Rectangle
from plotstyle import ACCENT, GREY1, GREY2, GREY4, INK, box, new_fig, overlay, panel

OUT = Path(__file__).resolve().parent / "deck" / "figs"
OUT.mkdir(parents=True, exist_ok=True)
STATS = json.load(open(mp.OUT / "stats.json"))
NORMAL, GLARE = mp.NORMAL, mp.GLARE_LIGHT
FS = 12


def save(fig, name):
    ps.save(fig, OUT, name)
    print("wrote", name, fig.get_size_inches())


# three changes, one picture
def fig_changes():
    W, H = 9.4, 1.95
    fig = new_fig(W, H)
    ov = overlay(fig)
    pw = 3.0
    order = [("speed-normal", ("3 bps", "8 bps")), ("lighting", ("Normal", "Dim")), ("speed-glare", ("4 bps", "2 bps"))]
    for i, (key, names) in enumerate(order):
        c = STATS["changes"][key]
        x0 = i * (pw + 0.2)
        ax1 = box(fig, x0 + 0.55, 0.5, 1.05, 1.0)
        ax2 = box(fig, x0 + 2.0, 0.5, 0.95, 1.0)
        top_ber = 0.0
        for x, (side, col) in enumerate([("a", INK), ("b", ACCENT)]):
            d = c[side]
            lo, hi = d["wilson"]
            ax1.plot([x, x], [lo, hi], color=col, lw=2.8, solid_capstyle="round", zorder=2)
            ax1.plot(x, d["frames"] / d["trials"], "o", color=col, ms=9, mec="none", zorder=3)
            ax1.text(x, hi + 0.06, f"{d['frames']}/{d['trials']}", ha="center", va="bottom", fontsize=FS, fontweight="bold")
            vals = sorted(d["channel_ber_pct"])
            jit = np.linspace(-0.14, 0.14, len(vals)) if len(vals) > 1 else [0.0]
            ax2.plot(np.array(jit) + x, vals, "o", color=col, ms=6.5, mec="none", alpha=0.9, zorder=3)
            ax2.plot([x - 0.3, x + 0.3], [d["median_channel_ber_pct"]] * 2, color=INK, lw=2.0, zorder=4)
            top_ber = max(top_ber, max(vals))
        ax1.set_xlim(-0.6, 1.6); ax1.set_ylim(-0.04, 1.35)
        ax1.set_yticks([0, 0.5, 1]); ax1.set_yticklabels(["0%", "50%", "100%"])
        ax2.set_xlim(-0.6, 1.6); ax2.set_ylim(-0.06 * top_ber, top_ber * 1.15)
        ax2.yaxis.set_major_locator(mpl.ticker.MaxNLocator(3, min_n_ticks=3))
        ax2.yaxis.set_major_formatter(mpl.ticker.FormatStrFormatter("%g%%"))
        ax2.grid(axis="y"); ax2.set_axisbelow(True)
        for ax in (ax1, ax2):
            ax.set_xticks([0, 1]); ax.set_xticklabels(names, fontsize=FS)
            ax.get_xticklabels()[1].set_color(ACCENT)
            ax.tick_params(axis="x", length=0, pad=5)
        ov.text(x0 + 0.0, H - 0.2, "Frames delivered", fontsize=FS, color=GREY1, va="center", ha="left")
        ov.text(x0 + 1.75, H - 0.2, "Channel BER", fontsize=FS, color=GREY1, va="center", ha="left")
    save(fig, "fig-changes.png")


# two kinds of noise and the run lengths
def fig_noise():
    setups = [(f"{NORMAL}, 4 bps", ["reflect4", "reflect4b", "facing4"], INK), (f"{GLARE}, 2 bps", ["glare2"], ACCENT),
              (f"{NORMAL}, 3 bps", ["facing3"], INK), (f"{NORMAL}, 8 bps", ["facing8"], INK),
              (f"{GLARE}, 4 bps", mp.GLARE4, ACCENT)]
    data = []
    for name, keys, col in setups:
        trials = [t for k in keys for t in mp.TR[k]]
        errors, bits = sum(len(t["pos"]) for t in trials), sum(t["obs"] for t in trials)
        data.append((errors / bits, name, trials, col))
    data.sort(key=lambda d: d[0])
    W, H, ax_l, ax_w, top, ah = 9.4, 3.5, 1.95, 3.25, 0.45, 2.55
    fig = new_fig(W, H)
    ov = overlay(fig)
    ax = box(fig, ax_l, top, ax_w, ah)
    gap = 2.2
    total = sum(len(d[2]) for d in data) + gap * (len(data) - 1)
    y = 0.0
    for rate, name, trials, col in data:
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
        yy = H - top - ah + (1 - mid / total) * ah
        pr = "0%" if rate == 0 else f"{rate * 100:.1f}%" if rate >= 0.01 else f"{rate * 100:.2f}%"
        ov.text(ax_l - 0.1, yy, f"{name}" + chr(10) + f"{len(trials)} trials, BER {pr}", ha="right", va="center", fontsize=FS, color=col)
        y += gap
    ax.set_xlim(0, 470); ax.set_ylim(total, -0.3); ax.set_yticks([]); ax.spines["left"].set_visible(False)
    ax.set_xticks([0, 150, 300, 450])
    ax.set_xlabel("Position in the frame (bit)")
    panel(ax, "(a)", "One tick per wrong bit", size=FS)
    # run lengths, observed against independent flips
    regs = [(["facing8"], INK, f"{NORMAL}, 8 bps"), (mp.GLARE4, ACCENT, f"{GLARE}, 4 bps")]
    bx = box(fig, 6.55, top, 2.75, ah)
    ks = np.arange(1, 17)
    for j, (keys, col, short) in enumerate(regs):
        r = mp.regime(keys)
        runs = np.array(r.pop("_runs")); p = r["ber"]
        obs = np.array([(runs == k).sum() for k in ks]) / len(runs)
        geo = (1 - p) * p ** (ks - 1)
        bx.bar(ks + (j - 0.5) * 0.4, np.where(obs > 0, obs, np.nan), 0.4, color=col, zorder=3)
        bx.plot(ks, geo, "--", color=col, lw=1.4, zorder=4)
        bx.plot(ks, geo, "o", color=col, ms=3.5, mfc="white", zorder=4)
    bx.set_yscale("log"); bx.set_ylim(3e-4, 4)
    bx.set_yticks([1e-3, 1e-2, 1e-1, 1]); bx.yaxis.set_major_formatter(plt.FuncFormatter(mp.pct)); bx.minorticks_off()
    bx.set_xlim(0.3, 16.7); bx.set_xticks([1, 4, 8, 12, 16])
    bx.set_xlabel("Error run length (bits)")
    bx.grid(axis="y"); bx.set_axisbelow(True)
    bx.text(16.4, 1.7, f"{NORMAL}, 8 bps", color=INK, ha="right", va="center", fontsize=FS)
    bx.text(16.4, 0.6, f"{GLARE}, 4 bps", color=ACCENT, ha="right", va="center", fontsize=FS)
    bx.text(16.4, 0.2, "dashed, independent flips", color=GREY1, ha="right", va="center", fontsize=FS)
    panel(bx, "(b)", "Share of error runs", size=FS)
    save(fig, "fig-noise.png")


# brightness over time next to the levels
def fig_camera():
    W, H = 9.4, 3.4
    fig = new_fig(W, H)
    cases = [("reflect4", "full1b-000", "(a)", f"{NORMAL}, 4 bps"), ("glare_b", "quiet1-001", "(b)", "One glare frame")]
    lv = [("reflect4", f"{NORMAL}"), ("glare_c", "One glare run")]
    ax_h, tops = 1.0, [0.4, 1.75]
    t0, t1 = 10, 40
    for n, (key, rid, letter, desc) in enumerate(cases):
        top = tops[n]
        ax = box(fig, 1.0, top, 4.35, ax_h)
        x = [r for r in mp.load_results(key) if r["run_id"] == rid][0]
        ts, v = mp.load_capture(key)
        fs, dur, thr = float(x["frame_start"]), float(x["symbol_duration"]), float(x["threshold"])
        tx, rx = x["transmitted_bits"], x["received_bits"]
        for i, b in enumerate(tx):
            a = i * dur
            if b == "1" and t0 - dur <= a <= t1:
                ax.axvspan(a, a + dur, color=GREY4, alpha=0.85, lw=0, zorder=0)
        m = (ts - fs >= t0) & (ts - fs <= t1)
        ax.plot(ts[m] - fs, v[m], color=INK, lw=1.3, zorder=2)
        ax.axhline(thr, color=GREY1, lw=1.4, ls=(0, (5, 3)), zorder=3)
        nb = min(len(tx), len(rx))
        err = [i for i in range(nb) if tx[i] != rx[i]]
        errs = [(i + 0.5) * dur for i in err if t0 <= (i + 0.5) * dur <= t1]
        ax.plot(errs, [262] * len(errs), "|", color=ACCENT, ms=8, mew=1.5, zorder=4)
        ax.set_ylim(0, 280); ax.set_xlim(t0, t1); ax.set_yticks([0, 100, 200])
        ax.set_ylabel("Brightness", fontsize=FS)
        if n == 0:
            ax.tick_params(labelbottom=False)
        else:
            ax.set_xlabel("Time since frame start (s)")
        panel(ax, letter, f"{desc}, {len(errs) if errs else 'no'} errors in this window", size=FS)
        # the levels at the centre of every symbol, the same recording family
        k2, name = lv[n]
        ones, zeros, _ = mp.symbol_levels(k2)
        thr2 = float(mp.load_results(k2)[0]["threshold"])
        bx = box(fig, 6.35, top, 2.95, ax_h)
        bins = np.arange(0, 260, 4); cen = bins[:-1] + 2
        sz = np.histogram(zeros, bins)[0] / len(zeros) * 100
        so = np.histogram(ones, bins)[0] / len(ones) * 100
        bx.bar(cen, so, width=4, color=np.where(cen < thr2, ACCENT, GREY2), alpha=0.85, zorder=2)
        bx.bar(cen, sz, width=4, color=np.where(cen >= thr2, ACCENT, INK), alpha=0.8, zorder=3)
        bx.axvline(thr2, color=GREY1, lw=1.4, ls=(0, (5, 3)), zorder=4)
        wrong = float(((zeros > thr2).sum() + (ones < thr2).sum()) / (len(zeros) + len(ones)))
        topv = max(sz.max(), so.max())
        right = thr2 > 128
        bx.set_ylim(0, topv * 1.45); bx.set_xlim(0, 258); bx.set_xticks([0, 100, 200])
        bx.set_yticks([])
        bx.spines["left"].set_visible(False)
        if n == 0:
            bx.tick_params(labelbottom=False)
        else:
            bx.set_xlabel("Brightness at symbol centres")
        bx.text(cen[sz.argmax()] - (22 if not right else 0), sz.max() + topv * 0.06, "black", color=INK, fontsize=FS, ha="center", va="bottom")
        bx.text(cen[so.argmax()] + (28 if right else 0), so.max() + topv * 0.06, "white", color=GREY1, fontsize=FS, ha="center", va="bottom")
        wtxt = (f"{wrong * 100:.1f}%" if wrong >= 0.001 else f"{wrong * 100:.2f}%") + " wrong side"
        if right:
            bx.text(4, topv * 1.3, wtxt, color=ACCENT, fontsize=FS, fontweight="bold", ha="left", va="center")
        else:
            bx.text(254, topv * 1.3, wtxt, color=ACCENT, fontsize=FS, fontweight="bold", ha="right", va="center")
        panel(bx, f"({'cd'[n]})", f"{name}, levels", size=FS)
    save(fig, "fig-camera.png")


if __name__ == "__main__":
    fig_changes()
    fig_noise()
    fig_camera()
