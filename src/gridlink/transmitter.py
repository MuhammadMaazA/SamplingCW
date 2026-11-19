"""OpenCV screen transmitter for binary protocol frames."""

from __future__ import annotations

import time

from .coding.pipeline import method_label
from .experiments.plan import ExperimentPlan, trial_offsets
from .optical.patterns import symbol_image
from .protocol import Frame, build_frame


class _Stopped(Exception):
    pass


def _open_window(window: str):
    import cv2

    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    cv2.setWindowProperty(window, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
    return cv2


def _hold_until(cv2, deadline: float) -> None:
    while time.perf_counter() < deadline:
        if cv2.waitKey(1) & 0xFF == ord("q"):
            raise _Stopped


def _show_bits(cv2, window: str, bits: list[int], symbol_duration: float, start: float) -> None:
    """Show each bit until its deadline, measured from start and not from when the last bit appeared.

    That way small delays do not add up over a long frame.
    """
    for index, bit in enumerate(bits):
        cv2.imshow(window, symbol_image(bit))
        _hold_until(cv2, start + (index + 1) * symbol_duration)


def transmit(frame: Frame, symbol_duration: float = 0.25, window: str = "Transmitter") -> None:
    if symbol_duration <= 0:
        raise ValueError("symbol duration must be positive")
    bits = build_frame(frame)
    cv2 = _open_window(window)
    try:
        _show_bits(cv2, window, bits, symbol_duration, time.perf_counter())
    except _Stopped:
        return
    finally:
        cv2.destroyWindow(window)


def transmit_plan(
    plan: ExperimentPlan, lead_in: float = 5.0, window: str = "Experiment"
) -> bool:
    """Show every trial on one clock with black gaps between them. Returns False if stopped early."""
    if lead_in < plan.gap:
        raise ValueError("lead-in must be at least as long as the inter-frame gap")
    cv2 = _open_window(window)
    try:
        cv2.imshow(window, symbol_image(0))
        session_start = time.perf_counter() + lead_in
        _hold_until(cv2, session_start)
        for trial, offset in zip(plan.trials, trial_offsets(plan)):
            start = session_start + offset
            cv2.imshow(window, symbol_image(0))
            _hold_until(cv2, start)
            print(f"trial {trial.index + 1}/{len(plan.trials)}: {method_label(trial.config())}")
            _show_bits(cv2, window, trial.frame_bits(), plan.symbol_duration, start)
        cv2.imshow(window, symbol_image(0))
        _hold_until(cv2, time.perf_counter() + plan.gap)
        return True
    except _Stopped:
        return False
    finally:
        cv2.destroyWindow(window)


def display_reference(bit: int, duration: float = 5.0, window: str = "Reference") -> None:
    """Display one known level while the receiver measures its reflected intensity."""
    if bit not in (0, 1) or duration <= 0:
        raise ValueError("reference bit must be 0 or 1 and duration must be positive")
    cv2 = _open_window(window)
    try:
        cv2.imshow(window, symbol_image(bit))
        _hold_until(cv2, time.perf_counter() + duration)
    except _Stopped:
        return
    finally:
        cv2.destroyWindow(window)
