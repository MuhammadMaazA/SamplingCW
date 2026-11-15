"""Shared figure style for the deck plots, drawn at the size they are placed on a slide.

Transparent PNG at 220 dpi, Gill Sans MT, black and white with one vermilion accent. Axes are
placed in inches so every figure keeps the exact size and aspect ratio it was designed for,
with no tight cropping.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib as mpl

mpl.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib import font_manager as fm  # noqa: E402

INK, WHITE = "#111111", "#FFFFFF"
GREY1, GREY2, GREY3, GREY4 = "#4D4D4D", "#8C8C8C", "#CFCFCF", "#EDEDED"
ACCENT = "#D9381E"
DPI = 220

_FONT_DIR = Path(r"C:\Windows\Fonts")
for _name in ("GIL_____.TTF", "GILB____.TTF", "GILI____.TTF", "GILBI___.TTF"):
    if (_FONT_DIR / _name).exists():
        fm.fontManager.addfont(str(_FONT_DIR / _name))
FONT = "Gill Sans MT" if any(f.name == "Gill Sans MT" for f in fm.fontManager.ttflist) else "DejaVu Sans"

mpl.rcParams.update({
    "font.family": "sans-serif", "font.sans-serif": [FONT, "DejaVu Sans"], "font.size": 13,
    "axes.labelsize": 14, "axes.labelcolor": INK, "axes.edgecolor": GREY2, "axes.linewidth": 0.8,
    "axes.spines.top": False, "axes.spines.right": False, "axes.facecolor": "none", "axes.grid": False,
    "axes.unicode_minus": False, "text.color": INK,
    "xtick.color": GREY2, "ytick.color": GREY2, "xtick.labelcolor": INK, "ytick.labelcolor": INK,
    "xtick.labelsize": 13, "ytick.labelsize": 13, "xtick.direction": "out", "ytick.direction": "out",
    "xtick.major.size": 3, "ytick.major.size": 3, "xtick.major.width": 0.7, "ytick.major.width": 0.7,
    "legend.fontsize": 13, "legend.frameon": False, "lines.linewidth": 1.6, "lines.markersize": 6,
    "patch.linewidth": 0, "grid.color": GREY3, "grid.linewidth": 0.6, "grid.linestyle": "-",
    "figure.facecolor": "none", "figure.dpi": 100, "savefig.facecolor": "none",
    "savefig.transparent": True, "savefig.dpi": DPI,
})


def new_fig(width, height):
    fig = plt.figure(figsize=(width, height))
    fig.patch.set_alpha(0)
    return fig


def tidy(ax, grid=None):
    """Hairline axes: only left and bottom spines, optional light grid behind the data."""
    ax.set_facecolor("none")
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color(GREY2)
        ax.spines[side].set_linewidth(0.8)
    ax.tick_params(colors=GREY2, labelcolor=INK, length=3, width=0.7, labelsize=13)
    if grid:
        ax.grid(True, axis="both" if grid == "both" else grid, color=GREY3, linewidth=0.6)
        ax.set_axisbelow(True)
    return ax


def box(fig, left, top, width, height, **kw):
    """Axes placed in inches: left edge and top edge measured from the figure's top-left corner."""
    fig_w, fig_h = fig.get_size_inches()
    ax = fig.add_axes([left / fig_w, (fig_h - top - height) / fig_h, width / fig_w, height / fig_h], **kw)
    return tidy(ax)


def panel(ax, letter, description="", dy=5, size=14):
    """Bold panel letter above the top-left corner, with an optional plain description after it."""
    tag = ax.annotate(letter, xy=(0, 1), xycoords="axes fraction", xytext=(0, dy), textcoords="offset points",
                      ha="left", va="bottom", fontsize=15, fontweight="bold", color=INK, annotation_clip=False)
    if description:
        ax.annotate(description, xy=(1, 0), xycoords=tag, xytext=(6, 0), textcoords="offset points",
                    ha="left", va="bottom", fontsize=size, color=GREY1, annotation_clip=False)
    return tag


def check_fit(fig, name):
    """Warn if any text sits outside the figure, which a fixed size figure would silently crop."""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    width, height = fig.bbox.width, fig.bbox.height
    bad = []
    unseen = set()  # tick labels of ticks outside the view limits are never drawn
    for ax in fig.axes:
        for axis in (ax.xaxis, ax.yaxis):
            drawn = {id(t) for t in axis.get_majorticklabels() + axis.get_minorticklabels()} if ax.axison else set()
            unseen |= {id(tick.label1) for tick in axis.get_major_ticks() if id(tick.label1) not in drawn}
            unseen |= {id(tick.label2) for tick in axis.get_major_ticks()}
    for text in fig.findobj(mpl.text.Text):
        if not text.get_visible() or not text.get_text().strip() or id(text) in unseen:
            continue
        bb = text.get_window_extent(renderer)
        gone = bb.x0 >= width or bb.x1 <= 0 or bb.y0 >= height or bb.y1 <= 0
        if gone and text.get_text().replace(".", "").replace("-", "").isdigit():
            continue  # a spare tick label that matplotlib keeps but never draws
        if bb.x0 < -1 or bb.y0 < -1 or bb.x1 > width + 1 or bb.y1 > height + 1:
            bad.append(text.get_text()[:40])
    if bad:
        print(f"  WARNING {name}: text outside figure: {bad}")


def save(fig, out_dir, name):
    check_fit(fig, name)
    path = Path(out_dir) / name
    fig.savefig(path)
    plt.close(fig)
    return path


def overlay(fig):
    """Transparent axes covering the figure with inch coordinates, origin bottom-left, for free annotations."""
    fig_w, fig_h = fig.get_size_inches()
    ov = fig.add_axes([0, 0, 1, 1], zorder=10)
    ov.set_xlim(0, fig_w)
    ov.set_ylim(0, fig_h)
    ov.axis("off")
    ov.patch.set_alpha(0)
    return ov
