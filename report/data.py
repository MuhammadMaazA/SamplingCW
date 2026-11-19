"""Load the per-trial records behind the report, with the same G01-G29 groups as Table 3."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from screencam.experiments.recording import ExperimentRecord, read_csv
from screencam.experiments.report import group_records

REPO = Path(__file__).resolve().parent.parent
RESULTS = REPO / "experiments" / "results"

# The analysed CSVs combined by `screencam report` into report-final, in the same order,
# so group_records reproduces the G01-G29 numbering of the appendix table.
SOURCES = [
    "monitor-room-comparison-20261030-180441-714350Z/results-t114.csv",
    "final-comparison-20261031-150350-900428Z/results.csv",
    "full1b-lab-comparison-20261027-174408-573804Z/results-corrected.csv",
    "quiet1-lab-repetition-3-20261026-163304-310902Z/results.csv",
    "quiet1b-lab-repetition-3-20261026-164839-135418Z/results.csv",
    "quiet1c-lab-repetition-3-20261026-170042-409100Z/results.csv",
    "quiet1d-lab-repetition-3-20261026-171013-285528Z/results.csv",
    "quiet1e-lab-repetition-3-20261026-171657-143340Z/results.csv",
    "quiet2bps-lab-repetition-3-20261026-172410-806159Z/results.csv",
    "quick-lab-repetition-3-20261027-173212-078354Z/results.csv",
    "test-lab-repetition-3-20261027-163916-214973Z/results.csv",
]

SLICE_OF_GROUP = {
    **{g: "3 bps facing" for g in range(1, 8)},
    **{g: "8 bps facing" for g in range(8, 15)},
    **{g: "4 bps reflection" for g in range(15, 22)},
    **{g: "4 bps glare" for g in range(22, 27)},
    27: "2 bps glare",
    28: "4 bps facing (rep-3 check)",
    29: "4 bps reflection (rep-3 check)",
}

# Visible names for the slices, used in figure labels and text. The keys above stay unchanged
# because generated/stats.json and the slide deck read them.
DISPLAY = {
    "3 bps facing": "Normal light, 3 bps",
    "8 bps facing": "Normal light, 8 bps",
    "4 bps reflection": "Normal light, 4 bps",
    "4 bps glare": "Dim with glare, 4 bps",
    "2 bps glare": "Dim with glare, 2 bps",
    "4 bps facing (rep-3 check)": "Normal light, 4 bps, rep-3 check",
    "4 bps reflection (rep-3 check)": "Normal light, 4 bps, rep-3 check",
}

LABELS = {
    "none": "none", "hamming": "Hamming", "hamming-interleaved": "Ham-interl.",
    "parity2d": "2-D parity",
}
METHOD_ORDER = ["none", "rep-3", "rep-5", "rep-7", "Hamming", "Ham-interl.", "2-D parity"]


@dataclass
class Trial:
    record: ExperimentRecord
    group: str
    slice: str

    @property
    def method(self) -> str:
        scheme = self.record.coding_scheme
        if scheme == "repetition":
            return f"rep-{self.record.repetition_factor}"
        return LABELS[scheme]

    @property
    def observed(self) -> int:
        return len(self.record.received_bits or [])

    @property
    def error_sequence(self) -> list[int]:
        sent, got = self.record.transmitted_bits, self.record.received_bits or []
        return [int(a != b) for a, b in zip(sent, got)]

    @property
    def error_positions(self) -> list[int]:
        return [i for i, e in enumerate(self.error_sequence) if e]


def load() -> list[Trial]:
    records = []
    for source in SOURCES:
        path = RESULTS / source
        if not path.exists():
            raise FileNotFoundError(
                f"{path} missing; unpack the results archive into experiments/results"
            )
        records.extend(read_csv(path))
    trials = []
    for index, group in enumerate(group_records(records), 1):
        trials.extend(Trial(r, f"G{index:02d}", SLICE_OF_GROUP[index]) for r in group)
    return trials


def by_slice(trials: list[Trial]) -> dict[str, list[Trial]]:
    out: dict[str, list[Trial]] = {}
    for trial in trials:
        out.setdefault(trial.slice, []).append(trial)
    return out
