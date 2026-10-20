"""OpenCV screen transmitter for binary protocol frames."""

from __future__ import annotations

import time

from .optical.patterns import symbol_image
from .protocol import Frame, build_frame


def transmit(frame: Frame, symbol_duration: float = 0.25, window: str = "GridLink") -> None:
    if symbol_duration <= 0:
        raise ValueError("symbol duration must be positive")
    import cv2

    bits = build_frame(frame)
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(window, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    try:
        for bit in bits:
            started = time.monotonic()
            cv2.imshow(window, symbol_image(bit))
            while time.monotonic() - started < symbol_duration:
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    return
    finally:
        cv2.destroyWindow(window)


def display_reference(bit: int, duration: float = 5.0, window: str = "GridLink reference") -> None:
    """Display one known level while the receiver measures its reflected intensity."""
    if bit not in (0, 1) or duration <= 0:
        raise ValueError("reference bit must be 0 or 1 and duration must be positive")
    import cv2

    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(window, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    try:
        started = time.monotonic()
        while time.monotonic() - started < duration:
            cv2.imshow(window, symbol_image(bit))
            if cv2.waitKey(1) & 0xFF == ord("q"):
                return
    finally:
        cv2.destroyWindow(window)

