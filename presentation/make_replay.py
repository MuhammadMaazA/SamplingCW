"""Replay video of one recording, for the demo slot.

Everything drawn comes from a single recorded frame: the symbols sent, the camera brightness
samples with their timestamps, the threshold, the sampled symbol centres, the decoded bits and
the CRC results, all read with the same loaders as make_plots.py and checked against the saved
analysis. Nothing is simulated. Run from presentation/ with gridlink/.venv/Scripts/python.exe.
Writes media/replay.mp4 (1280x720, 30 fps, H.264 yuv420p, no audio), then media/_replay_done.txt.
"""
from __future__ import annotations

import subprocess
import sys
from bisect import bisect_right
from pathlib import Path

import numpy as np

import plotstyle
from plotstyle import ACCENT, GREY1, GREY2, GREY3, GREY4, INK, WHITE

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Polygon, Rectangle

import make_plots as mp
from gridlink.optical.detection import classify_intensity
from gridlink.optical.synchronization import TimedSample, _Timeline, sample_symbols
from gridlink.protocol import (
    HEADER_CODED_BITS, SYNC_BITS, SYNC_WORD, _decode_header, bytes_to_bits, find_sync, parse_frame)

HERE = Path(__file__).resolve().parent
MEDIA = HERE / "media"
W, H, FPS = 12.8, 7.2, 30
SPEED = 6.0                 # recording seconds shown per video second
TITLE_S, GAP_S, STEP_S, HOLD_S = 3.0, 0.6, 1.2, 4.0
KEY = "reflect4"            # normal light, 4 bps, repetition and Hamming comparison session
CONDITION = "Normal light, 4 bps, repetition-3"


def load_recording():
    rows = mp.load_results(KEY)
    row = next(r for r in rows if r["coding_scheme"] == "repetition" and r["repetition_factor"] == "3"
               and r["frame_valid"] == "True" and r["channel_bit_errors"] == "0" and r["decoded_bit_errors"] == "0"
               and r["frame_start"])
    fs, dur, thr = float(row["frame_start"]), float(row["symbol_duration"]), float(row["threshold"])
    tx = [int(c) for c in row["transmitted_bits"]]
    ts, val = mp.load_capture(KEY)
    samples = [TimedSample(float(t), classify_intensity(float(x), thr), float(x)) for t, x in zip(ts, val)]
    rx = sample_symbols(samples, fs, dur, maximum_symbols=len(tx))
    assert "".join(map(str, rx)) == row["received_bits"], "recomputed bits differ from the saved analysis"
    assert rx == tx, "this trial must have no channel errors"
    timeline = _Timeline(samples)
    centres = [timeline.nearest(fs + (i + 0.5) * dur, dur * 0.45) for i in range(len(tx))]
    assert all(c is not None for c in centres)
    sent, got = parse_frame(tx), parse_frame(rx)
    assert sent.payload == got.payload and got.payload.hex() == row["decoded_payload"]
    sync_wrong = sum(a != b for a, b in zip(rx[:SYNC_BITS], bytes_to_bits(SYNC_WORD)))
    assert find_sync(rx) == 0 and sync_wrong == 0
    _decode_header(rx[SYNC_BITS:SYNC_BITS + HEADER_CODED_BITS], False)  # raises if the header CRC fails
    lo, hi = fs - 1.0, fs + len(tx) * dur + 0.5
    keep = (ts >= lo) & (ts <= hi)
    rel, vals = ts[keep] - fs, val[keep]
    assert np.diff(rel).max() < 0.2, "gap in the camera samples"
    return {
        "row": row, "fs": fs, "dur": dur, "thr": thr, "tx": tx, "rx": rx, "n": len(tx), "rel": rel, "vals": vals,
        "centre_t": np.array([c.timestamp - fs for c in centres]), "centre_v": np.array([c.intensity for c in centres]),
        "window": hi - lo, "t0": -1.0, "payload_sent": bytes_to_bits(sent.payload), "payload_got": bytes_to_bits(got.payload),
        "payload_hex": got.payload.hex(), "sync_wrong": sync_wrong,
    }


# ------------------------------------------------------------------ scene
AX_L, AX_T, AX_W, AX_H = 1.5, 2.95, 10.0, 1.3          # trace axes, inches from the top left
GRID_X0, GRID_Y0, PITCH, GROUP_GAP, ROW = 2.3, 5.05, 0.152, 0.06, 0.2
NL = chr(10)


def grid_xy(i):
    col, row = i % 48, i // 48
    return GRID_X0 + col * PITCH + (col // 8) * GROUP_GAP, GRID_Y0 + row * ROW


class Scene:
    def __init__(self, d, speed_label):
        self.d = d
        self.fig = plt.figure(figsize=(W, H), dpi=100, facecolor=WHITE)
        self.ov = ov = self.fig.add_axes([0, 0, 1, 1])
        ov.set_xlim(0, W); ov.set_ylim(H, 0); ov.axis("off")
        self.main, self.title, self.conf, self.compare = [], [], [[], [], []], []
        ov.text(0.4, 0.34, f"Replay of a recorded run, shown {speed_label} times faster. Not a live run.", fontsize=18,
                fontweight="bold", color=INK, va="center", ha="left")
        ov.text(0.4, 0.72, f"{CONDITION}. One recorded frame, with the brightness values the camera measured.", fontsize=16, color=GREY1, va="center", ha="left")
        self.clock = ov.text(12.4, 0.34, "", fontsize=16, color=GREY1, va="center", ha="right")
        self.main.append(self.clock)
        self._devices()
        self._trace()
        self._bits()
        self._results()
        for text, y, size, col in ((f"Replay of a recorded run,", 2.75, 38, INK), (f"shown {speed_label} times faster.", 3.4, 38, INK),
                                   ("Not a live run.", 4.1, 38, ACCENT), (f"{CONDITION}, one recorded frame", 4.95, 22, GREY1)):
            self.title.append(ov.text(W / 2, y, text, fontsize=size, fontweight="bold" if size > 30 else "normal", color=col, ha="center", va="center"))

    def _add(self, artist, group=None):
        (group if group is not None else self.main).append(artist)
        return artist

    def _laptop(self, cx, y0=0.98):
        ov = self.ov
        self._add(ov.add_patch(FancyBboxPatch((cx - 0.95, y0), 1.9, 1.0, boxstyle="round,pad=0,rounding_size=0.07", fc=WHITE, ec=INK, lw=2.6)))
        self._add(ov.add_patch(Polygon([(cx - 1.15, y0 + 1.13), (cx + 1.15, y0 + 1.13), (cx + 1.05, y0 + 1.0), (cx - 1.05, y0 + 1.0)],
                                       closed=True, fc=GREY4, ec=INK, lw=2.2)))
        return cx, y0

    def _devices(self):
        ov, y0 = self.ov, 0.98
        cx1, cx2, cx3 = 2.4, 6.4, 10.4
        self._laptop(cx1)
        self.patch1 = self._add(ov.add_patch(Rectangle((cx1 - 0.62, y0 + 0.14), 1.24, 0.72, fc=GREY4, ec=INK, lw=1.4)))
        self._add(ov.add_patch(FancyBboxPatch((cx2 - 1.0, y0 - 0.04), 2.0, 1.25, boxstyle="round,pad=0,rounding_size=0.12", fc=WHITE, ec=INK, lw=2.6)))
        self._add(ov.add_patch(Rectangle((cx2 - 0.84, y0 + 0.08), 1.68, 1.01, fc=GREY4, ec=GREY2, lw=1)))
        self.patch2 = self._add(ov.add_patch(Rectangle((cx2 - 0.55, y0 + 0.24), 1.1, 0.62, fc=GREY4, ec="none")))
        self._add(ov.add_patch(Circle((cx2 - 0.92, y0 + 0.585), 0.035, fc=INK, ec="none")))
        self._laptop(cx3)
        self._add(ov.add_patch(Circle((cx3, y0 - 0.075), 0.035, fc=INK, ec="none")))
        self.reads = self._add(ov.text(cx3, y0 + 0.27, "reads", fontsize=16, color=GREY1, ha="center", va="center"))
        self.bit3 = self._add(ov.text(cx3, y0 + 0.68, "", fontsize=34, fontweight="bold", color=INK, ha="center", va="center"))
        for cx, text in ((cx1, "Laptop 1 shows the symbol"), (cx2, "iPad screen shows laptop 1"), (cx3, "Laptop 2 reads the bit")):
            self._add(ov.text(cx, 2.3, text, fontsize=16, color=GREY1, ha="center", va="center"))
        for xa, xb in ((cx1 + 1.3, cx2 - 1.2), (cx2 + 1.2, cx3 - 1.3)):
            self._add(ov.annotate("", xy=(xb, y0 + 0.55), xytext=(xa, y0 + 0.55), arrowprops=dict(arrowstyle="-|>", color=GREY2, lw=2.4, shrinkA=0, shrinkB=0)))

    def _trace(self):
        d, ov = self.d, self.ov
        n, dur, thr, t0, win = d["n"], d["dur"], d["thr"], d["t0"], d["window"]
        self.ax = ax = self.fig.add_axes([AX_L / W, 1 - (AX_T + AX_H) / H, AX_W / W, AX_H / H])
        plotstyle.tidy(ax)
        self.ymax = ymax = float(np.ceil(d["vals"].max() / 10) * 10 + 15)
        ax.set_xlim(t0, t0 + win); ax.set_ylim(0, ymax)
        ax.set_xticks([0, 20, 40, 60, 80]); ax.set_xticklabels([f"{t} s" for t in (0, 20, 40, 60, 80)])
        ax.set_yticks([0, 50, 100]); ax.tick_params(labelsize=16, pad=4)
        ax.set_ylabel("Camera" + NL + "brightness", fontsize=16, labelpad=6)
        self.band = ax.add_patch(Rectangle((0, 0), dur, ymax, fc=GREY4, ec="none", zorder=0))
        for t in (0, 48 * dur, 240 * dur, n * dur):
            ax.axvline(t, color=GREY2, lw=1.2, ls=(0, (2, 3)), zorder=1)
        ax.axhline(thr, color=GREY1, lw=2.2, ls=(0, (6, 4)), zorder=2)
        self.line, = ax.plot([], [], color=INK, lw=1.9, zorder=3)
        self.dots1, = ax.plot([], [], "o", ms=4.6, color=INK, mec=INK, zorder=4)
        self.dots0, = ax.plot([], [], "o", ms=4.6, color=INK, mec=INK, zorder=4)
        self.cursor = ax.axvline(0, color=ACCENT, lw=2.6, zorder=5)
        self.main.append(ax)
        self._add(ov.text(AX_L + AX_W + 0.12, AX_T + (1 - thr / ymax) * AX_H, "threshold" + NL + f"{thr:.0f}", fontsize=16,
                          color=GREY1, ha="left", va="center"))
        for a, b, text in zip((0, 48, 240), (48, 240, n), ("sync word", "header", "payload and CRC")):
            x_in = AX_L + ((a + b) / 2 * dur - t0) / win * AX_W
            xa, xb = AX_L + (a * dur - t0) / win * AX_W + 0.03, AX_L + (b * dur - t0) / win * AX_W - 0.03
            self._add(ov.plot([xa, xb], [AX_T - 0.07, AX_T - 0.07], color=GREY2, lw=2.4, solid_capstyle="butt")[0])
            self._add(ov.text(x_in, AX_T - 0.24, text, fontsize=16, color=GREY1, ha="center", va="center"))
        self._add(ov.text(AX_L, 4.8, "Dot at each symbol centre: above the dashed threshold is read as 1, below as 0. Squares below: black = 1, white = 0", fontsize=16,
                          color=GREY1, ha="left", va="center"))

    def _bits(self):
        ov = self.ov
        self.squares = [self._add(ov.add_patch(Rectangle(grid_xy(i), 0.12, 0.15, fc=WHITE, ec=GREY3, lw=1.1))) for i in range(self.d["n"])]
        for row, text in ((0, "sync word"), (2.5, "header"), (5.5, "payload and CRC")):
            self._add(ov.text(GRID_X0 - 0.17, GRID_Y0 + row * ROW + 0.075, text, fontsize=16, color=GREY1, ha="right", va="center"))
        self.shown = 0

    def _results(self):
        ov, d = self.ov, self.d
        for k, text in enumerate(("Sync word found", "Header CRC passes", "Payload CRC passes")):
            x, y = 10.3, 5.4 + k * 0.45
            check = ov.plot([x - 0.1, x - 0.03, x + 0.12], [y, y + 0.09, y - 0.1], color=ACCENT, lw=3.6, solid_capstyle="round", solid_joinstyle="round")[0]
            label = ov.text(x + 0.28, y, text, fontsize=16, fontweight="bold", color=INK, ha="left", va="center")
            self.conf[k] = [check, label]
            self.main.extend([])
        group = lambda bits: " ".join("".join(map(str, bits[i:i + 4])) for i in range(0, len(bits), 4))
        ok = d["payload_sent"] == d["payload_got"]
        assert ok
        self.compare = [
            ov.text(0.4, 6.68, "Message bits sent", fontsize=17, color=GREY1, ha="left", va="center"),
            ov.text(3.3, 6.68, group(d["payload_sent"]), fontsize=18, fontweight="bold", color=INK, ha="left", va="center"),
            ov.text(0.4, 7.0, "Message bits decoded", fontsize=17, color=GREY1, ha="left", va="center"),
            ov.text(3.3, 7.0, group(d["payload_got"]), fontsize=18, fontweight="bold", color=INK, ha="left", va="center"),
            ov.plot([6.55, 6.62, 6.78], [7.0, 7.09, 6.9], color=ACCENT, lw=3.6, solid_capstyle="round", solid_joinstyle="round")[0],
            ov.text(6.95, 7.0, f"They match: {len(d['payload_got'])} of {len(d['payload_got'])} bits", fontsize=18, fontweight="bold",
                    color=ACCENT, ha="left", va="center"),
        ]

    # ------------------------------------------------------------------ state
    def show(self, main, stage=0):
        for a in self.main:
            a.set_visible(main)
        for a in self.title:
            a.set_visible(not main)
        for k, group in enumerate(self.conf):
            for a in group:
                a.set_visible(main and stage > k)
        for a in self.compare:
            a.set_visible(main and stage >= 4)

    def set_time(self, tr, final=False):
        d = self.d
        rel, vals, rx, tx, dur, n = d["rel"], d["vals"], d["rx"], d["tx"], d["dur"], d["n"]
        if not hasattr(self, "idx1"):
            rxa = np.array(rx)
            self.idx1, self.idx0 = np.flatnonzero(rxa == 1), np.flatnonzero(rxa == 0)
        k = len(rel) if final else int(np.searchsorted(rel, tr, side="right"))
        m = n if final else int(np.searchsorted(d["centre_t"], tr, side="right"))
        self.line.set_data(rel[:k], vals[:k])
        for dots, idx in ((self.dots1, self.idx1), (self.dots0, self.idx0)):
            part = idx[: int(np.searchsorted(idx, m))]
            dots.set_data(d["centre_t"][part], d["centre_v"][part])
        while self.shown < m:
            sq = self.squares[self.shown]
            if rx[self.shown]:
                sq.set_facecolor(INK); sq.set_edgecolor(INK); sq.set_linewidth(1.1)
            else:
                sq.set_facecolor(WHITE); sq.set_edgecolor(INK); sq.set_linewidth(1.8)
            self.shown += 1
        in_frame = (not final) and 0 <= tr < n * dur
        i = int(tr // dur) if in_frame else 0
        self.band.set_visible(in_frame)
        if in_frame:
            self.band.set_x(i * dur)
        self.cursor.set_visible(not final)
        self.cursor.set_xdata([tr, tr])
        self.patch1.set_facecolor((INK if tx[i] == 0 else WHITE) if in_frame else GREY4)
        self.patch2.set_facecolor(str(float(vals[max(k - 1, 0)]) / 255))
        self.bit3.set_text(str(rx[m - 1]) if m else "")
        self.reads.set_text("reads" if m else "")
        shown_t = n * dur if final else min(max(tr, 0), n * dur)
        self.clock.set_text(f"Recording time {shown_t:.0f} s of {n * dur:.0f} s")

    def frame(self):
        self.fig.canvas.draw()
        return np.asarray(self.fig.canvas.buffer_rgba()).tobytes()


def render(scene, kind, arg, speed):
    d = scene.d
    if kind == "title":
        scene.show(False)
    elif kind == "anim":
        scene.show(True, 0)
        scene.set_time(d["t0"] + (arg / FPS) * speed)
    else:
        scene.show(True, arg)
        scene.set_time(0, final=True)
    return scene.frame()


def main():
    d = load_recording()
    n_anim = round(d["window"] / SPEED * FPS)
    speed = d["window"] / (n_anim / FPS)
    label = f"{speed:.0f}" if abs(speed - round(speed)) < 0.05 * round(speed) else f"{speed:.1f}"
    scene = Scene(d, label)
    plan = [("title", None, int(TITLE_S * FPS))] + [("anim", k, 1) for k in range(n_anim)]
    plan += [("stage", 0, int(GAP_S * FPS)), ("stage", 1, int(STEP_S * FPS)), ("stage", 2, int(STEP_S * FPS)),
             ("stage", 3, int(STEP_S * FPS)), ("stage", 4, int(HOLD_S * FPS))]
    print(f"{d['row']['run_id']} ({CONDITION}), {d['n']} symbols, window {d['window']:.1f} s, speed {speed:.2f}x, "
          f"{sum(c for _, _, c in plan)} frames, {sum(c for _, _, c in plan) / FPS:.2f} s")
    if "--preview" in sys.argv:
        import tempfile
        out = Path(tempfile.mkdtemp(prefix="replay_preview_"))
        picks = [("title", None), ("anim", 15), ("anim", n_anim // 2), ("anim", n_anim - 2), ("stage", 2), ("stage", 4)]
        for j, (kind, arg) in enumerate(picks):
            render(scene, kind, arg, speed)
            scene.fig.savefig(out / f"preview{j}.png", dpi=100, facecolor=WHITE)
        print("preview frames in", out)
        return
    MEDIA.mkdir(exist_ok=True)
    done, part, final = MEDIA / "_replay_done.txt", MEDIA / "replay.part.mp4", MEDIA / "replay.mp4"
    done.unlink(missing_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{int(W * 100)}x{int(H * 100)}",
           "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", str(part)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for kind, arg, count in plan:
        data = render(scene, kind, arg, speed)
        for _ in range(count):
            proc.stdin.write(data)
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")
    part.replace(final)
    done.write_text("")
    print("wrote", final, f"{final.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
