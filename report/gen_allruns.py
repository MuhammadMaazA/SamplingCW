"""Emit a compact LaTeX tabular body for every recorded run in summary.csv."""
from __future__ import annotations

import csv
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESULTS = HERE.parent / "experiments" / "results"
if not RESULTS.exists():
    RESULTS = HERE.parent.parent / "gridlink-results-backup" / "results"
SUMMARY = RESULTS / "report-final" / "summary.csv"
OUT = HERE / "generated" / "allruns-rows.tex"

CODE = {
    ("none", "1"): "none", ("hamming", "1"): "Hamming",
    ("parity2d", "1"): "2-D par", ("hamming-interleaved", "1"): "Ham-int",
}


def code_label(scheme, reps):
    if scheme == "repetition":
        return f"rep-{reps}"
    return CODE.get((scheme, reps), scheme)


# Every run used the same physical chain, so the table shows the light only. The
# physical_notes text in summary.csv came from default prompt text and is not used.


def env_label(row):
    """N for normal light, D for dim with glare."""
    return "D" if row["glare"].strip().lower() == "true" else "N"


def bps(symbol_duration):
    return round(1.0 / float(symbol_duration))


def num(value, places):
    try:
        return f"{float(value):.{places}f}"
    except (TypeError, ValueError):
        return "n/a"


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
                f"{g} & {bps(row['symbol_duration'])} & "
                f"{env_label(row)} & {code_label(row['coding'], row['repetitions'])} & "
                f"{num(row['channel_ber'], 3)} & {num(row['decoded_ber'], 3)} & "
                f"{thr_s} & {valid}/{trials} \\\\"
            )
    OUT.write_text("\n".join(lines))
    # Three blocks so the appendix table can sit side by side and fit the page limit.
    third = (len(lines) + 2) // 3
    for name, chunk in (("a", lines[:third]), ("b", lines[third:2 * third]),
                        ("c", lines[2 * third:])):
        OUT.with_name(f"allruns-rows-{name}.tex").write_text("\n".join(chunk))
    print(f"wrote {len(lines)} rows to {OUT}")


if __name__ == "__main__":
    main()
