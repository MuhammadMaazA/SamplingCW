"""Pull the few per-trial facts the deck draws directly from the recorded sessions.

Writes deck/data.js, a plain module the deck builder requires (a .js file, because *.json is git-ignored). Run from anywhere, it needs experiments/results/
(unpack the results archive there first, see the README). Everything else the deck shows
comes from plots/stats.json and report/generated/stats.json.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
RES = HERE.parent / "experiments" / "results"

PLAN_SESSION = "final-comparison-20261031-150350-900428Z"          # 8 bps facing, G08 to G14
BUG_SESSION = "full1b-lab-comparison-20261027-174408-573804Z"       # 4 bps reflection, G15 to G21
LAB_SESSION = "full1-laboutside-comparison-20261027-170708-296161Z"  # outside the lab, 2 bps
PHYSICAL_SESSION = "glare-layouts-room-comparison-20261106-021921-294106Z"  # 72 trials, one sitting
DEDUP_SESSION = "monitor-room-comparison-20261030-180441-714350Z"  # 3 bps facing, repeated timestamps dropped


def label(trial: dict) -> str:
    scheme, reps = trial["coding"], trial["repetitions"]
    if scheme == "none":
        return "none"
    if scheme == "repetition":
        return f"rep-{reps}"
    return {"hamming": "Ham", "parity2d": "2-D", "hamming-interleaved": "H-int"}[scheme]


def plan_labels(path: Path) -> list[str]:
    return [label(t) for t in json.loads(path.read_text())["trials"]]


def main() -> None:
    out: dict = {}

    plan = json.loads((RES / PLAN_SESSION / "plan.json").read_text())
    out["plan"] = {
        "seed": plan["seed"], "symbol_duration": plan["symbol_duration"], "gap": plan["gap"],
        "payload_bits": len(bytes.fromhex(plan["trials"][0]["payload_hex"])) * 8,
        "labels": [label(t) for t in plan["trials"]],
    }

    expected = plan_labels(RES / BUG_SESSION / "plan.json")
    sent = plan_labels(RES / BUG_SESSION / "plan-as-sent-by-A.json")
    out["ordering_bug"] = {
        "expected": expected, "sent": sent,
        "differ": sum(1 for a, b in zip(expected, sent) if a != b),
    }

    session = json.loads((RES / LAB_SESSION / "session.json").read_text())
    stamps = []
    for line in (RES / LAB_SESSION / "capture.csv").read_text().splitlines():
        head = line.split(",")[0]
        if head and not line.startswith("#") and head.replace(".", "", 1).isdigit():
            stamps.append(float(head))
    out["outside_lab"] = {
        "planned_s": session["planned_seconds"], "recorded_s": round(max(stamps) - min(stamps), 1),
        "bit_rate": session["bit_rate"], "trials": session["trials"],
    }

    def sample_rows(name: str) -> int:
        n = 0
        for line in (RES / DEDUP_SESSION / name).read_text().splitlines():
            head = line.split(",")[0]
            if not line.startswith("#") and head.replace(".", "", 1).isdigit():
                n += 1
        return n

    out["timestamps"] = {"dropped": sample_rows("capture.csv") - sample_rows("capture-dedup.csv")}

    # lengths of every run of consecutive wrong bits in the five 4 bps glare sessions, G22 to G26
    runs: list[int] = []
    for folder in sorted(RES.glob("quiet1*-lab-repetition-3-*")):
        if "quiet2bps" in folder.name:
            continue
        for row in csv.DictReader((folder / "results.csv").open(newline="")):
            sent, got = row["transmitted_bits"], row["received_bits"]
            run = 0
            for a, b in zip(sent, got):
                if a != b:
                    run += 1
                elif run:
                    runs.append(run)
                    run = 0
            if run:
                runs.append(run)
    out["glare_runs"] = {"runs": len(runs), "longest": max(runs), "share_le8": round(sum(1 for r in runs if r <= 8) / len(runs), 3)}

    order = [
        ("repetition", "3", "False", "rep-3, adjacent"),
        ("repetition-spread", "3", "False", "rep-3, spread"),
        ("repetition-spread", "3", "True", "rep-3, spread and spread header"),
        ("hamming-interleaved", "", "False", "Ham-int, depth 8"),
        ("hamming-interleaved-16", "", "False", "Ham-int, depth 16"),
        ("hamming-interleaved-16", "", "True", "Ham-int, depth 16, spread header"),
    ]
    rows = list(csv.DictReader((RES / PHYSICAL_SESSION / "results.csv").open(newline="")))
    rows.sort(key=lambda r: int(r["trial_index"]))
    sess = json.loads((RES / PHYSICAL_SESSION / "session.json").read_text())
    layouts = []
    for scheme, reps, spread_header, name in order:
        sel = [r for r in rows if r["coding_scheme"] == scheme and r["repetition_factor"] == reps
               and r["spread_header"] == spread_header]
        layouts.append({"label": name, "valid": [r["frame_valid"] == "True" for r in sel]})
    out["physical"] = {"layouts": layouts, "planned_s": sess["planned_seconds"], "trials": len(rows), "threshold": sess["threshold"], "bit_rate": sess["bit_rate"], "started": sess["created_local"][:16]}

    (HERE / "deck" / "data.js").write_text("// generated by extract_deck_data.py, do not edit by hand\nmodule.exports = " + json.dumps(out, indent=1) + ";\n")
    print("wrote deck/data.js", {k: (v if not isinstance(v, dict) else list(v)) for k, v in out.items()})


if __name__ == "__main__":
    main()
