"""Emit a compact LaTeX tabular body for every recorded run in summary.csv."""
from __future__ import annotations

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUMMARY = HERE.parent / "experiments" / "results" / "report-final" / "summary.csv"
OUT = HERE / "allruns-rows.tex"

CODE = {
    ("none", "1"): "none", ("hamming", "1"): "Hamming",
    ("parity2d", "1"): "2-D par", ("hamming-interleaved", "1"): "Ham-int",
}


def code_label(scheme, reps):
    if scheme == "repetition":
        return f"rep-{reps}"
    return CODE.get((scheme, reps), scheme)


def env_label(row):
    notes = row["physical_notes"].lower()
    if row["glare"].strip().lower() == "true":
        return "glare"
    if "direct screen" in notes:
        return "direct"
    if "external monitor" in notes:
        return "monitor"
    if "mirror via" in notes:
        return "mirror"
    return (row["venue"] or "lab").strip()[:7]


def bps(symbol_duration):
    return round(1.0 / float(symbol_duration))


def num(value, places):
    try:
        return f"{float(value):.{places}f}"
    except (TypeError, ValueError):
        return "--"


def main():
    lines = []
    with open(SUMMARY, newline="") as fh:
        for row in csv.DictReader(fh):
            g = row["group"]
            trials = int(row["trials"])
            valid = int(row["valid_frames"])
            thr = float(row["useful_throughput_bps"])
            thr_s = num(thr, 3) if thr > 0 else "0"
            lines.append(
                f"{g} & {bps(row['symbol_duration'])} & {row['payload_bits']} & "
                f"{env_label(row)} & {code_label(row['coding'], row['repetitions'])} & "
                f"{trials} & {num(row['channel_ber'], 3)} & {num(row['decoded_ber'], 3)} & "
                f"{thr_s} & {valid}/{trials} \\\\"
            )
    OUT.write_text("\n".join(lines))
    print(f"wrote {len(lines)} rows to {OUT}")


if __name__ == "__main__":
    main()
