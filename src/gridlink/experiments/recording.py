"""Save and load the per-trial CSV files used by the analysis commands."""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass, fields
from math import isfinite
from pathlib import Path


def _bits_to_text(bits: list[int] | None) -> str:
    return "" if bits is None else "".join(str(bit) for bit in bits)


@dataclass(frozen=True)
class ExperimentRecord:
    run_id: str
    timestamp_utc: str
    coding_scheme: str
    repetition_factor: int | None
    payload_bits: int
    encoded_bits: int
    random_seed: int | None
    symbol_duration: float
    threshold: float | None
    physical_notes: str
    mirror_alignment: str
    distance_m: float | None
    lighting: str
    glare: bool
    obstruction: bool
    transmitted_bits: list[int]
    received_bits: list[int] | None
    decoded_payload: str | None
    frame_valid: bool
    synchronisation_failures: int
    elapsed_seconds: float
    trial_index: int | None = None
    frame_start: float | None = None
    information_bits: int | None = None
    channel_bit_errors: int | None = None
    decoded_bit_errors: int | None = None
    corrected_codewords: int | None = None
    failure_reason: str | None = None
    venue: str = ""


def record_as_dict(record: ExperimentRecord) -> dict[str, object]:
    result = asdict(record)
    result["transmitted_bits"] = _bits_to_text(record.transmitted_bits)
    result["received_bits"] = _bits_to_text(record.received_bits)
    return result


def write_csv(records: list[ExperimentRecord], path: str | Path) -> None:
    if not records:
        raise ValueError("at least one record is required")
    rows = [record_as_dict(record) for record in records]
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def read_csv(path: str | Path) -> list[ExperimentRecord]:
    """Read the per-trial CSV produced by analyse, preserving unavailable values."""
    integers = {
        "repetition_factor", "payload_bits", "encoded_bits", "random_seed",
        "synchronisation_failures", "trial_index", "information_bits",
        "channel_bit_errors", "decoded_bit_errors", "corrected_codewords",
    }
    floats = {"symbol_duration", "threshold", "distance_m", "elapsed_seconds", "frame_start"}
    booleans = {"glare", "obstruction", "frame_valid"}
    optional_text = {"decoded_payload", "failure_reason"}
    records = []
    with Path(path).open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        required = {field.name for field in fields(ExperimentRecord)} - {"venue"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"not an analysed trial CSV; missing columns: {sorted(missing)}")
        for row in reader:
            values: dict[str, object] = {}
            for field in fields(ExperimentRecord):
                name, value = field.name, row.get(field.name, "")
                if value is None:
                    raise ValueError("incomplete CSV row")
                if name in integers:
                    values[name] = int(value) if value else None
                elif name in floats:
                    values[name] = float(value) if value else None
                    if values[name] is not None and not isfinite(values[name]):
                        raise ValueError(f"non-finite {name}")
                elif name in booleans:
                    if value not in ("True", "False"):
                        raise ValueError(f"invalid boolean in {name}")
                    values[name] = value == "True"
                elif name in ("transmitted_bits", "received_bits"):
                    if any(bit not in "01" for bit in value):
                        raise ValueError(f"non-binary {name}")
                    values[name] = [int(bit) for bit in value]
                elif name in optional_text:
                    values[name] = value or None
                else:
                    values[name] = value
            if not row["received_bits"] and values["synchronisation_failures"]:
                values["received_bits"] = None
            for name in ("payload_bits", "encoded_bits", "synchronisation_failures",
                         "symbol_duration", "elapsed_seconds"):
                if values[name] is None or values[name] < 0:
                    raise ValueError(f"missing or negative {name}")
            if values["symbol_duration"] == 0 or values["elapsed_seconds"] == 0:
                raise ValueError("trial duration must be positive")
            if len(values["received_bits"] or []) > len(values["transmitted_bits"]):
                raise ValueError("received stream is longer than the transmitted frame")
            records.append(ExperimentRecord(**values))
    if not records:
        raise ValueError("trial CSV contains no records")
    return records

