"""Raw intensity capture files: comment-line metadata followed by timestamped samples."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from math import isfinite
from pathlib import Path
from typing import TextIO

COLUMNS = "timestamp,intensity"


@dataclass(frozen=True)
class Capture:
    timestamps: list[float]
    intensities: list[float]
    metadata: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.timestamps or len(self.timestamps) != len(self.intensities):
            raise ValueError("capture needs matching, non-empty timestamps and intensities")
        if not all(isfinite(value) for value in self.timestamps + self.intensities):
            raise ValueError("capture samples must be finite")
        if any(right <= left for left, right in zip(self.timestamps, self.timestamps[1:])):
            raise ValueError("capture timestamps must be strictly increasing")


def write_capture_header(
    stream: TextIO, started: datetime, camera_index: int, roi: tuple[int, int, int, int]
) -> None:
    stream.write(f"# started_utc={started.isoformat()}\n")
    stream.write(f"# camera={camera_index}\n")
    stream.write(f"# roi={','.join(str(value) for value in roi)}\n")
    stream.write(COLUMNS + "\n")


def write_capture_row(stream: TextIO, timestamp: float, intensity: float) -> None:
    stream.write(f"{timestamp:.6f},{intensity:.3f}\n")


def load_capture(path: str | Path) -> Capture:
    metadata: dict[str, str] = {}
    timestamps: list[float] = []
    intensities: list[float] = []
    with Path(path).open(encoding="utf-8") as stream:
        for line in stream:
            line = line.strip()
            if not line:
                continue
            if line.startswith("#"):
                key, _, value = line[1:].strip().partition("=")
                metadata[key] = value
                continue
            if line == COLUMNS:
                continue
            timestamp, intensity = line.split(",")
            timestamps.append(float(timestamp))
            intensities.append(float(intensity))
    if not timestamps:
        raise ValueError("capture contains no samples")
    return Capture(timestamps, intensities, metadata)
