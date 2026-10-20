"""Clocked webcam receiver for the initial low-rate optical link."""

from __future__ import annotations

import time

from .optical.detection import classify_intensity, sample_roi
from .optical.synchronization import TimedSample, recover_symbols
from .protocol import PREAMBLE, Frame, bytes_to_bits, parse_frame


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
            selected = cv2.selectROI("Select optical region, then press Enter", frame, False, False)
            cv2.destroyWindow("Select optical region, then press Enter")
            roi = tuple(int(value) for value in selected)
        samples: list[TimedSample] = []
        started = time.monotonic()
        next_decode_attempt = started
        preamble_bits = bytes_to_bits(PREAMBLE)
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
                )
            )
            now = time.monotonic()
            if now >= next_decode_attempt:
                next_decode_attempt = now + max(symbol_duration / 2, 0.1)
                recovered = recover_symbols(samples, symbol_duration, preamble_bits)
                if recovered is not None:
                    try:
                        return parse_frame(recovered)
                    except ValueError:
                        pass
            if cv2.waitKey(1) & 0xFF == ord("q"):
                raise RuntimeError("receiver stopped by user")
        raise TimeoutError("no valid frame received before timeout")
    finally:
        camera.release()
        cv2.destroyAllWindows()

