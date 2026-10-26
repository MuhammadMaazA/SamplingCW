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
    window = "Drag a box inside the screen, then press Enter"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window, 960, 540)
    selected = cv2.selectROI(window, frame, True, False)
    cv2.destroyWindow(window)
    roi = tuple(int(value) for value in selected)
    if roi[2] <= 0 or roi[3] <= 0:
        raise RuntimeError("screen selection cancelled")
    return roi


def _confirm_capture_region(cv2, camera, roi):
    """Show the live region before starting the recording clock."""
    window = "GridLink ready: Space=start, R=select again, Q=cancel"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window, 960, 540)
    while True:
        ok, frame = camera.read()
        if not ok:
            raise RuntimeError("camera stopped during preview")
        preview = frame.copy()
        x, y, width, height = roi
        cv2.rectangle(preview, (x, y), (x + width, y + height), (0, 255, 0), 2)
        cv2.putText(preview, "SPACE: record   R: select again   Q: cancel",
                    (10, 30), 0, 0.7, (0, 255, 0), 2)
        cv2.imshow(window, preview)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            raise RuntimeError("recording cancelled before start")
        if key == ord("r"):
            roi = _select_roi(cv2, frame)
        if key == 32:
            cv2.destroyWindow(window)
            return roi, frame


def capture(
    output: str | Path,
    duration: float,
    camera_index: int = 0,
    roi: tuple[int, int, int, int] | None = None,
) -> int:
    """Record raw timestamped ROI intensities for offline decoding.

    Select and preview the region, then press Space to start the recording clock.
    Samples and a small event log are saved immediately. Returns the sample count.
    """
    if duration <= 0:
        raise ValueError("capture duration must be positive")
    destination = Path(output)
    for path in (destination, destination.with_suffix(".log"), destination.with_suffix(".png")):
        if path.exists():
            raise FileExistsError(f"recording file already exists; choose a new name: {path}")
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
        print("READY: check the green box. Space records; R selects again; Q cancels.")
        roi, frame = _confirm_capture_region(cv2, camera, roi)
        x, y, width, height = roi
        image_path = destination.with_suffix(".png")
        log_path = destination.with_suffix(".log")
        with log_path.open("x", encoding="utf-8", buffering=1) as log, destination.open(
            "x", newline="", encoding="utf-8", buffering=1
        ) as stream:
            started_utc = datetime.now(timezone.utc)
            write_capture_header(stream, started_utc, camera_index, roi)
            stream.write(f"# frame_size={frame.shape[1]},{frame.shape[0]}\n")
            if not cv2.imwrite(str(image_path), frame[y:y + height, x:x + width]):
                raise RuntimeError("could not save the selected screen region")
            log.write(f"{started_utc.isoformat()} RECORDING camera={camera_index} roi={roi}\n")
            print(f"RECORDING: start the transmitter now. Saving to {destination}")
            started = time.monotonic()
            stopped_by_user = False
            window = "GridLink recording: Q stops and saves"
            cv2.namedWindow(window, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(window, 960, 540)
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
                cv2.rectangle(frame, (x, y), (x + width, y + height), (0, 255, 0), 2)
                text = (
                    f"RECORDING {remaining:.0f}s | intensity={intensity:.1f} | "
                    f"samples={count} | Q=stop"
                )
                cv2.putText(frame, text, (10, 30), 0, 0.7, (0, 255, 0), 2)
                cv2.imshow(window, frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    stopped_by_user = True
                    break
            elapsed = time.monotonic() - started
            reason = "stopped by user" if stopped_by_user else "duration reached"
            ended_utc = datetime.now(timezone.utc).isoformat()
            stream.write(f"# stop_reason={reason}\n# elapsed_seconds={elapsed:.6f}\n")
            stream.write(f"# samples={count}\n# stopped_utc={ended_utc}\n")
            log.write(f"{ended_utc} SAVED samples={count} elapsed={elapsed:.3f}s {reason}\n")
            print(f"SAVED: {count} samples, {elapsed:.1f}s ({reason}).")
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

