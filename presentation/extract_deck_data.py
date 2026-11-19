"""Pull the facts the deck draws directly from the recorded sessions and from the code itself.

Writes deck/data.js, a plain module the deck builder requires (a .js file, because *.json is git-ignored).
Run from anywhere. It needs experiments/results/ (unpack the results archive there first, see the README)
and it imports the screencam package from src/, so the diagrams of the transmitter, receiver and checks
quote the real sizes and ids. It also runs the whole pytest suite, which takes about 40 seconds, to read
how many tests there are and how many pass. Everything else the deck shows comes from
plots/stats.json and report/generated/stats.json.
"""
from __future__ import annotations

import csv
import itertools
import json
import os
import random
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RES = ROOT / "experiments" / "results"
sys.path.insert(0, str(ROOT / "src"))

from screencam import protocol  # noqa: E402
from screencam.coding import hamming  # noqa: E402
from screencam.coding.pipeline import (  # noqa: E402
    CODING_IDS,
    REPETITION_SCHEMES,
    CodingConfig,
    encoded_length,
)
from screencam.experiments.simulation import (  # noqa: E402
    repetition_error_probability,
    run_trials,
    summarise_trials,
)

PLAN_SESSION = "final-comparison-20261031-150350-900428Z"          # 8 bps facing, G08 to G14
BUG_SESSION = "full1b-lab-comparison-20261027-174408-573804Z"       # 4 bps reflection, G15 to G21
LAB_SESSION = "full1-laboutside-comparison-20261027-170708-296161Z"  # outside the lab, 2 bps
PHYSICAL_SESSION = "glare-layouts-room-comparison-20261106-021921-294106Z"  # 72 trials, one sitting


def label(trial: dict) -> str:
    scheme, reps = trial["coding"], trial["repetitions"]
    if scheme == "none":
        return "none"
    if scheme == "repetition":
        return f"rep-{reps}"
    return {"hamming": "Ham", "parity2d": "2-D", "hamming-interleaved": "H-int"}[scheme]


def plan_labels(path: Path) -> list[str]:
    return [label(t) for t in json.loads(path.read_text())["trials"]]


def code_facts() -> dict:
    """Sizes and ids the diagrams quote, read from protocol.py and coding/pipeline.py."""
    config = CodingConfig("repetition", 3)
    message = bytes(2)
    protected = (len(message) + 2) * 8
    frame = protocol.Frame(message, coding=config.scheme, repetitions=config.repetitions)
    return {
        "sync_bits": protocol.SYNC_BITS,
        "max_sync_mismatches": protocol.MAX_SYNC_MISMATCHES,
        "header_plain_bits": protocol.HEADER_PLAIN_BITS,
        "header_coded_bits": protocol.HEADER_CODED_BITS,
        "header_copies": protocol.HEADER_CODING.repetitions,
        "coding_ids": [{"id": i, "name": n} for n, i in sorted(CODING_IDS.items(), key=lambda kv: kv[1])],
        "example": {
            "message_bits": len(message) * 8, "protected_bits": protected,
            "coded_bits": encoded_length(protected, config), "frame_bits": len(protocol.build_frame(frame)),
        },
    }


def hamming_check() -> dict:
    """Run the real Hamming decoder on every codeword with every single and every double flip."""
    singles, doubles = [], []
    for bits in itertools.product((0, 1), repeat=4):
        data = list(bits)
        word = hamming.encode_nibble(data)
        one, two = [], []
        for position in range(7):
            noisy = word[:]
            noisy[position] ^= 1
            one.append(hamming.decode_codeword(noisy)[0] == data)
        for first, second in itertools.combinations(range(7), 2):
            noisy = word[:]
            noisy[first] ^= 1
            noisy[second] ^= 1
            two.append(hamming.decode_codeword(noisy)[0] == data)
        singles.append(one)
        doubles.append(two)
    return {"singles": singles, "doubles": doubles}


def round_trip() -> dict:
    """Build and parse a frame for every coding id with both header layouts."""
    results = []
    for name in CODING_IDS:
        repetitions = 3 if name in REPETITION_SCHEMES else 1
        for spread_header in (False, True):
            frame = protocol.Frame(b"Hi", sequence=7, coding=name, repetitions=repetitions, spread_header=spread_header)
            got = protocol.parse_frame([0, 1, 1] + protocol.build_frame(frame) + [0, 0])
            results.append(got.payload == b"Hi" and got.coding == name and got.spread_header == spread_header)
    return {"passed": sum(results), "total": len(results), "crc_check": f"0x{protocol.crc16(b'123456789'):04X}"}


def simulation_against_theory() -> dict:
    """Simulate repetition coding through a binary symmetric channel and set it beside the formula."""
    flip, trials = 0.2, 200
    generator = random.Random(1)
    bits = [generator.randint(0, 1) for _ in range(256)]
    rows = []
    for factor in (3, 5, 7):
        summary = summarise_trials(run_trials(bits, CodingConfig("repetition", factor), flip, trials, seed=0))
        rows.append({"factor": factor, "theory": repetition_error_probability(flip, factor), "simulated": summary.mean_decoded_ber})
    return {"flip_probability": flip, "trials": trials, "bits": len(bits), "rows": rows}


def run_tests() -> dict:
    """Run the whole pytest suite and read how many tests there are and how many pass."""
    env = dict(os.environ, PYTHONPATH=str(ROOT / "src"))
    run = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"], cwd=ROOT, env=env, capture_output=True, text=True)
    def count(word: str) -> int:
        found = re.findall(rf"(\d+) {word}", run.stdout)
        return int(found[0]) if found else 0

    passed, failed, errors = count("passed"), count("failed"), count("error")
    if passed + failed + errors == 0:
        raise RuntimeError("pytest reported no tests: " + run.stdout + run.stderr)
    return {"total": passed + failed + errors, "passed": passed, "failed": failed + errors}


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

    # the box the camera averages, from the header lines of each capture.csv (roi and frame size)
    def header_fields(folder: str) -> dict:
        fields = {}
        for line in (RES / folder / "capture.csv").read_text().splitlines()[:8]:
            if line.startswith("# roi=") or line.startswith("# frame_size="):
                key, value = line[2:].split("=")
                fields[key] = [int(v) for v in value.split(",")]
        return fields

    box_sessions = [
        ("n3", "Normal light, 3 bps", "G01 to G07", "monitor-room-comparison-20261030-180441-714350Z"),
        ("n8", "Normal light, 8 bps", "G08 to G14", "final-comparison-20261031-150350-900428Z"),
        ("n4", "Normal light, 4 bps", "G15 to G21", "full1b-lab-comparison-20261027-174408-573804Z"),
        ("g22", "Dim with glare, 4 bps", "G22", "quiet1-lab-repetition-3-20261026-163304-310902Z"),
        ("g23", "Dim with glare, 4 bps", "G23", "quiet1b-lab-repetition-3-20261026-164839-135418Z"),
        ("g24", "Dim with glare, 4 bps", "G24", "quiet1c-lab-repetition-3-20261026-170042-409100Z"),
        ("g25", "Dim with glare, 4 bps", "G25", "quiet1d-lab-repetition-3-20261026-171013-285528Z"),
        ("g26", "Dim with glare, 4 bps", "G26", "quiet1e-lab-repetition-3-20261026-171657-143340Z"),
        ("g27", "Dim with glare, 2 bps", "G27", "quiet2bps-lab-repetition-3-20261026-172410-806159Z"),
        ("test", "Dim with glare, 4 bps, physical test", "6 Nov", PHYSICAL_SESSION),
    ]
    boxes = []
    for key, name, groups, folder in box_sessions:
        f = header_fields(folder)
        x, y, w, h = f["roi"]
        fw, fh = f["frame_size"]
        boxes.append({"key": key, "label": name, "groups": groups, "roi": [x, y, w, h], "frame": [fw, fh], "fraction": w * h / (fw * fh)})
    out["boxes"] = boxes

    order = [
        ("repetition", "3", "False", "rep-3 adjacent copies"),
        ("repetition-spread", "3", "False", "rep-3 spread copies"),
        ("repetition-spread", "3", "True", "rep-3 spread copies and spread header"),
        ("hamming-interleaved", "", "False", "Hamming depth 8"),
        ("hamming-interleaved-16", "", "False", "Hamming depth 16"),
        ("hamming-interleaved-16", "", "True", "Hamming depth 16 and spread header"),
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

    # what happened to every planned trial, by condition. G28 and G29 are the two short rep-3 checks in normal light at 4 bps
    summary = {r["group"]: r for r in csv.DictReader((RES / "report-final" / "summary.csv").open(newline=""))}
    columns = ["valid_frames", "sync_failures", "truncated", "header_crc_failures", "payload_crc_failures", "uncorrectable", "other_failures"]
    conditions = [
        ("Normal light, 3 bps", [f"G{i:02d}" for i in range(1, 8)]),
        ("Normal light, 8 bps", [f"G{i:02d}" for i in range(8, 15)]),
        ("Normal light, 4 bps", [f"G{i:02d}" for i in range(15, 22)]),
        ("Dim with glare, 4 bps", [f"G{i:02d}" for i in range(22, 27)]),
        ("Dim with glare, 2 bps", ["G27"]),
        ("Normal light, 4 bps, rep-3 check", ["G28", "G29"]),
    ]
    failures = []
    for name, groups in conditions:
        row = {c: sum(int(summary[g][c]) for g in groups) for c in columns}
        row["trials"] = sum(int(summary[g]["trials"]) for g in groups)
        assert row["trials"] == sum(row[c] for c in columns), name
        row["display"] = name
        failures.append(row)
    out["failures"] = failures

    # facts read from the code itself, so the diagrams of the transmitter, receiver and checks cannot drift from it
    out["code"] = code_facts()
    out["hamming_check"] = hamming_check()
    out["round_trip"] = round_trip()
    out["simulation"] = simulation_against_theory()
    out["tests"] = run_tests()

    (HERE / "deck" / "data.js").write_text("// generated by extract_deck_data.py, do not edit by hand\nmodule.exports = " + json.dumps(out, indent=1) + ";\n")
    print("wrote deck/data.js", {k: (v if not isinstance(v, dict) else list(v)) for k, v in out.items()})


if __name__ == "__main__":
    main()
