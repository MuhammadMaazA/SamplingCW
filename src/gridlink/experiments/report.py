"""Tables and plots from saved trials, without pooling different physical conditions."""

from __future__ import annotations

import csv
from collections import Counter
from dataclasses import asdict
from pathlib import Path

import numpy as np

from .analysis import summarise_records
from .metrics import error_run_lengths
from .recording import ExperimentRecord, read_csv

CONDITIONS = (
    "symbol_duration", "payload_bits", "distance_m", "lighting", "mirror_alignment",
    "glare", "obstruction", "physical_notes",
)


def group_records(records: list[ExperimentRecord]) -> list[list[ExperimentRecord]]:
    groups: dict[tuple, list[ExperimentRecord]] = {}
    for record in records:
        key = (record.coding_scheme, record.repetition_factor or 1) + tuple(
            getattr(record, name) for name in CONDITIONS
        )
        groups.setdefault(key, []).append(record)
    return list(groups.values())


def table_row(records: list[ExperimentRecord], group_id: str) -> dict:
    summary = summarise_records(records)[0]
    failures = Counter()
    for record in records:
        reason = record.failure_reason or ""
        if record.frame_valid:
            continue
        if record.synchronisation_failures:
            failures["sync_failures"] += 1
        elif reason == "truncated":
            failures["truncated"] += 1
        elif "uncorrectable" in reason:
            failures["uncorrectable"] += 1
        elif "header CRC" in reason:
            failures["header_crc_failures"] += 1
        elif "CRC" in reason:
            failures["payload_crc_failures"] += 1
        else:
            failures["other_failures"] += 1
    return {
        "group": group_id,
        **{name: getattr(records[0], name) for name in CONDITIONS},
        **asdict(summary),
        "frame_error_rate": 1 - summary.valid_frames / summary.trials,
        "observed_channel_bits": sum(len(record.received_bits or []) for record in records),
        "decoded_trials": sum(record.decoded_bit_errors is not None for record in records),
        **{name: failures[name] for name in (
            "sync_failures", "truncated", "uncorrectable", "header_crc_failures",
            "payload_crc_failures", "other_failures",
        )},
    }


def _save_table(rows: list[dict], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _comparison(rows: list[dict], destination: Path, plt) -> None:
    figure, axes = plt.subplots(2, 2, figsize=(12, 9), layout="constrained")
    labels = []
    for row in rows:
        coding = row["coding"]
        if coding == "repetition":
            coding += f"-{row['repetitions']}"
        labels.append(f"{row['group']}\n{coding}")
    positions = np.arange(len(rows))
    for axis, key, title in (
        (axes[0, 0], "channel_ber", "Observed channel BER (sync + header + data)"),
        (axes[0, 1], "decoded_ber", "Decoded BER (complete, decodable trials only)"),
        (axes[1, 1], "useful_throughput_bps", "Useful bits/s (nominal frame airtime)"),
    ):
        values = [row[key] if row[key] is not None else np.nan for row in rows]
        axis.bar(positions, values, color="#376a94")
        for index, value in enumerate(values):
            if np.isnan(value):
                axis.text(index, 0, "N/A", ha="center", va="bottom")
            else:
                axis.text(index, value, f"{value:.3g}", ha="center", va="bottom", fontsize=9)
        axis.set_title(title, fontsize=11)
        axis.set_ylim(bottom=0)
    rates = [row["valid_frames"] / row["trials"] for row in rows]
    axes[1, 0].bar(positions, rates, color="#376a94")
    axes[1, 0].set_ylim(0, 1.08)
    axes[1, 0].set_title("Frame success proportion (successful / planned trials)", fontsize=11)
    for index, row in enumerate(rows):
        axes[1, 0].text(index, 1.02, f"{row['valid_frames']}/{row['trials']}", ha="center")
    for axis in axes.flat:
        axis.set_xticks(positions, labels, rotation=35, ha="right", fontsize=8)
        axis.grid(axis="y", alpha=0.2)
        axis.set_axisbelow(True)
    figure.suptitle("Recorded trials; see summary.csv for conditions and missing trials")
    figure.savefig(destination, dpi=180)
    plt.close(figure)


def _noise_plot(records: list[ExperimentRecord], destination: Path, plt) -> None:
    from matplotlib.colors import BoundaryNorm, ListedColormap

    # Limit display size only. Source CSVs and error-position exports retain every bit.
    shown = records[:20]
    width = min(max(len(record.transmitted_bits) for record in shown), 2000)
    matrix = np.full((len(shown), width), 2)
    runs = []
    for row, record in enumerate(records):
        received = record.received_bits or []
        expected = record.transmitted_bits[:len(received)]
        runs.extend(error_run_lengths(expected, received))
        if row < len(shown):
            count = min(len(received), width)
            matrix[row, :count] = [
                int(left != right) for left, right in zip(expected[:count], received[:count])
            ]
    figure, axes = plt.subplots(2, 1, figsize=(12, 7), layout="constrained")
    colours = ListedColormap(["#e6e6e6", "#bc3544", "#525252"])
    image = axes[0].imshow(matrix, aspect="auto", cmap=colours,
                           norm=BoundaryNorm([-0.5, 0.5, 1.5, 2.5], 3), interpolation="nearest")
    axes[0].set_yticks(range(len(shown)), [record.run_id for record in shown], fontsize=7)
    axes[0].set_xlabel("Transmitted frame bit position (including sync and header)")
    axes[0].set_title(f"First {len(shown)}/{len(records)} trials; first {width} bits per frame")
    colourbar = figure.colorbar(image, ax=axes[0], ticks=[0, 1, 2], pad=0.01)
    colourbar.ax.set_yticklabels(["match", "error", "unavailable / unobserved tail"])
    counts = Counter(runs)
    if counts:
        axes[1].bar(sorted(counts), [counts[length] for length in sorted(counts)])
    else:
        axes[1].text(0.5, 0.5, "No observed bit errors", transform=axes[1].transAxes, ha="center")
    axes[1].set_xlabel("Consecutive error-run length (observed bits only)")
    axes[1].set_ylabel("Number of runs")
    figure.savefig(destination, dpi=180)
    plt.close(figure)


def write_report(paths: list[str | Path], output: str | Path) -> Path:
    """Combine analysed CSVs once each; write a new report directory."""
    resolved = [Path(path).resolve() for path in paths]
    if not resolved or len(set(resolved)) != len(resolved):
        raise ValueError("provide at least one distinct results CSV")
    records = []
    sources = []
    seen = set()
    for path in resolved:
        for record in read_csv(path):
            identity = (record.timestamp_utc, record.run_id)
            if identity in seen:
                raise ValueError(f"duplicate trial {identity}; do not count a recording twice")
            seen.add(identity)
            records.append(record)
            sources.append(path)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError as error:
        raise RuntimeError(
            'install plotting support: python -m pip install -e ".[analysis]"'
        ) from error
    destination = Path(output)
    destination.mkdir(parents=True, exist_ok=False)
    groups = group_records(records)
    rows = [table_row(group, f"G{index:02d}") for index, group in enumerate(groups, 1)]
    _save_table(rows, destination / "summary.csv")
    errors = []
    for record, source in zip(records, sources):
        received = record.received_bits or []
        positions = [str(index) for index, (left, right) in enumerate(
            zip(record.transmitted_bits, received)
        ) if left != right]
        errors.append({
            "source": str(source), "run_id": record.run_id, "timestamp_utc": record.timestamp_utc,
            "observed_bits": len(received),
            "unavailable_tail_bits": len(record.transmitted_bits) - len(received),
            "error_positions": " ".join(positions), "failure_reason": record.failure_reason,
        })
    _save_table(errors, destination / "error-positions.csv")
    for start in range(0, len(rows), 8):
        _comparison(rows[start:start + 8], destination / f"comparison-{start // 8 + 1}.png", plt)
    for row, group in zip(rows, groups):
        _noise_plot(group, destination / f"noise-{row['group']}.png", plt)
    (destination / "method-notes.txt").write_text(
        "Groups separate coding, speed, payload size and recorded physical conditions.\n"
        "Frame failures include all planned trials, including missing and truncated frames.\n"
        "Channel BER uses observed frame bits; decoded BER uses complete decodable trials.\n"
        "Both BERs are conditional on observation/decodability; read them with failure counts.\n"
        "Throughput uses nominal frame airtime, excluding gaps and setup.\n"
        "Counts and rates are descriptive; they do not establish statistical significance.\n"
        "Unavailable tails indicate sampling stopped; later bits were not evaluated.\n"
        "Noise maps show at most 20 trials and 2000 bits; error-position CSVs retain all errors.\n"
        "Offline alignment and first-trial identification can fail in noisy captures.\n",
        encoding="utf-8",
    )
    return destination
