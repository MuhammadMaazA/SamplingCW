"""Clocked webcam receiver for the initial low-rate optical link."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

from .experiments.capture import write_capture_header, write_capture_row
from .optical.calibration import CalibrationResult, estimate_threshold
from .optical.detection import classify_intensity, sample_roi
from .optical.synchronization import TimedSample, recover_symbols
from .protocol import SYNC_WORD, Frame, bytes_to_bits, parse_frame


def receive(
    camera_index: int = 0,
    symbol_duration: float = 0.25,
    threshold: float = 127.0,
    roi: tuple[int, int, int, int] | None = None,
    timeout: float = 30.0,
) -> Frame:
    if symbol_duration <= 0 or timeout <= 0:
        raise ValueError("symbol duration and timeout must be positive")
    import cv2

    camera = cv2.VideoCapture(camera_index)
    if not camera.isOpened():
        raise RuntimeError(f"could not open camera {camera_index}")
    try:
        if roi is None:
            ok, frame = camera.read()
            if not ok:
                raise RuntimeError("could not read an initial camera frame")
            roi = _select_roi(cv2, frame)
        samples: list[TimedSample] = []
        started = time.monotonic()
        next_decode_attempt = started
        last_error = "no synchronisation marker found"
        preamble_bits = bytes_to_bits(SYNC_WORD)
        while time.monotonic() - started < timeout:
            ok, frame = camera.read()
            if not ok:
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            intensity = sample_roi(gray, roi)
            text = f"intensity={intensity:.1f} threshold={threshold:.1f}"
            cv2.putText(frame, text, (10, 30), 0, 0.7, (0, 255, 0), 2)
            cv2.imshow("GridLink receiver (q to quit)", frame)
            samples.append(
                TimedSample(
                    timestamp=time.monotonic(),
                    bit=classify_intensity(intensity, threshold),
                    intensity=intensity,
                )
            )
            now = time.monotonic()
            if now >= next_decode_attempt:
                next_decode_attempt = now + max(symbol_duration / 2, 0.1)
                recovered = recover_symbols(samples, symbol_duration, preamble_bits)
                if recovered is not None:
                    try:
                        return parse_frame(recovered)
                    except ValueError as error:
                        last_error = str(error)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                raise RuntimeError("receiver stopped by user")
        raise TimeoutError(f"no valid frame received before timeout; last result: {last_error}")
    finally:
        camera.release()
        cv2.destroyAllWindows()


def _select_roi(cv2, frame) -> tuple[int, int, int, int]:
    selected = cv2.selectROI("Select optical region, then press Enter", frame, False, False)
    cv2.destroyWindow("Select optical region, then press Enter")
    return tuple(int(value) for value in selected)


def capture(
    output: str | Path,
    duration: float,
    camera_index: int = 0,
    roi: tuple[int, int, int, int] | None = None,
) -> int:
    """Record raw timestamped ROI intensities for offline decoding.

    Every camera frame is written immediately, so an interrupted session keeps the
    data captured so far. Returns the number of recorded samples.
    """
    if duration <= 0:
        raise ValueError("capture duration must be positive")
    destination = Path(output)
    if destination.exists():
        raise FileExistsError(f"capture already exists; choose a new filename: {destination}")
    import cv2

    camera = cv2.VideoCapture(camera_index)
    if not camera.isOpened():
        raise RuntimeError(f"could not open camera {camera_index}")
    count = 0
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        ok, frame = camera.read()
        if not ok:
            raise RuntimeError("could not read an initial camera frame")
        if roi is None:
            roi = _select_roi(cv2, frame)
        with destination.open("x", newline="", encoding="utf-8", buffering=1) as stream:
            write_capture_header(stream, datetime.now(timezone.utc), camera_index, roi)
            started = time.monotonic()
            while time.monotonic() - started < duration:
                ok, frame = camera.read()
                if not ok:
                    continue
                timestamp = time.monotonic()
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                intensity = sample_roi(gray, roi)
                write_capture_row(stream, timestamp, intensity)
                count += 1
                remaining = duration - (timestamp - started)
                text = f"intensity={intensity:.1f} remaining={remaining:.0f}s samples={count}"
                cv2.putText(frame, text, (10, 30), 0, 0.7, (0, 255, 0), 2)
                cv2.imshow("GridLink capture (q to stop)", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
        return count
    finally:
        camera.release()
        cv2.destroyAllWindows()


def calibrate(
    camera_index: int = 0,
    roi: tuple[int, int, int, int] | None = None,
    samples_per_level: int = 20,
    minimum_contrast: float = 20.0,
) -> CalibrationResult:
    """Measure reflected black and white levels after manual reference display."""
    if samples_per_level <= 0:
        raise ValueError("samples per level must be positive")
    import cv2

    camera = cv2.VideoCapture(camera_index)
    if not camera.isOpened():
        raise RuntimeError(f"could not open camera {camera_index}")
    try:
        ok, frame = camera.read()
        if not ok:
            raise RuntimeError("could not read an initial camera frame")
        if roi is None:
            roi = _select_roi(cv2, frame)
        measurements: list[list[float]] = []
        for label in ("black", "white"):
            print(f"Display the {label} reference, then press Space to measure it.")
            while True:
                ok, frame = camera.read()
                if not ok:
                    continue
                text = f"Ready for {label}: press Space"
                cv2.putText(frame, text, (10, 30), 0, 0.7, (0, 255, 0), 2)
                cv2.imshow("GridLink calibration", frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    raise RuntimeError("calibration stopped by user")
                if key == 32:
                    break
            level_samples: list[float] = []
            while len(level_samples) < samples_per_level:
                ok, frame = camera.read()
                if not ok:
                    continue
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                level_samples.append(sample_roi(gray, roi))
            measurements.append(level_samples)
        return estimate_threshold(*measurements, minimum_contrast=minimum_contrast)
    finally:
        camera.release()
        cv2.destroyAllWindows()

