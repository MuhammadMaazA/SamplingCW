"""CSV and JSON recording for reproducible communication experiments."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
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


def write_json(records: list[ExperimentRecord], path: str | Path) -> None:
    if not records:
        raise ValueError("at least one record is required")
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps([record_as_dict(record) for record in records], indent=2),
        encoding="utf-8",
    )

