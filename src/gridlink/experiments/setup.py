"""Ask for experiment settings before opening the receiver's camera."""

from datetime import datetime, timezone
from math import isfinite
from pathlib import Path

from .analysis import SessionConditions
from .plan import make_plan, parse_config, plan_duration, save_plan, transmitter_command
from .session import record_session, session_label

METHODS = ["none", "repetition:3", "repetition:5", "repetition:7",
           "hamming", "parity2d", "hamming-interleaved",
           "repetition-spread:3", "repetition-spread:3+sh",
           "hamming-interleaved-16", "hamming-interleaved-16+sh"]


def _number(label, default, integer=False, minimum=0, maximum=None):
    while True:
        hint = "optional" if default is None else default
        text = input(f"{label} [{hint}]: ").strip()
        if not text and default is None:
            return None
        text = text or str(default)
        try:
            value = int(text) if integer else float(text)
            if not isfinite(value) or value < minimum:
                raise ValueError
            if maximum is not None and value > maximum:
                raise ValueError
            return value
        except ValueError:
            print("Enter a number within the stated range.")


def _choose_methods():
    for index, method in enumerate(METHODS, 1):
        print(f"  {index}. {method}")
    while True:
        selected = input("Methods: numbers separated by commas, or all [2]: ").strip() or "2"
        try:
            indices = list(range(1, len(METHODS) + 1)) if selected.lower() == "all" else [
                int(part.strip()) for part in selected.split(",")
            ]
            if any(index < 1 or index > len(METHODS) for index in indices):
                raise ValueError
            return [parse_config(METHODS[index - 1]) for index in dict.fromkeys(indices)]
        except ValueError:
            print(f"Choose numbers 1-{len(METHODS)}, for example 2,5,6, or type all.")


def interactive_setup(output="experiments/results"):
    print("SETUP: run this on B, the receiving laptop.")
    print(f"Date/time is saved automatically: {datetime.now().astimezone().isoformat()}")
    name = input("Name this run [run]: ").strip() or "run"
    if Path(name).name != name or name in (".", ".."):
        raise ValueError("use a run name without directory separators")
    venue = input("Venue / room: ").strip()
    camera = _number("iPad camera index (0 or higher)", 0, integer=True)
    configs = _choose_methods()
    repeats = _number(f"Trials per method (1-{256 // len(configs)})", 3, integer=True, minimum=1,
                      maximum=256 // len(configs))
    speed = _number("Transmitted bits per second (0.1 or more)", 4, minimum=0.1)
    payload = _number("Payload bytes (1-65535)", 2, integer=True, minimum=1, maximum=65535)
    threshold = _number("Calibration threshold 0-255 (Enter=automatic)", None, maximum=255)
    lighting = input("Lighting / physical condition: ").strip()
    distance = _number("Distance in metres (Enter=not measured)", None)
    notes = input("Notes [iPad front camera; direct screen; no mirror]: ").strip()
    notes = notes or "iPad front camera; direct screen; no mirror"
    obstruction = input("Partial obstruction? [y/N]: ").strip().lower() in ("y", "yes")
    glare = input("Glare? [y/N]: ").strip().lower() in ("y", "yes")
    plots_answer = input("Save plots too (needs analysis install)? [y/N]: ").strip().lower()
    plots = plots_answer in ("y", "yes")
    conditions = SessionConditions(venue=venue, lighting=lighting, distance_m=distance,
                                   physical_notes=notes, obstruction=obstruction, glare=glare)
    plan = make_plan(name, configs, repeats, payload, 1 / speed, max(2, 4 / speed), seed=1)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%fZ")
    filename = f"{session_label(name, venue)}-{stamp}.json"
    path = Path(output) / "plans" / filename
    save_plan(plan, path)
    print(f"\nPREPARED: {len(plan.trials)} trials, about {plan_duration(plan) / 60:.1f} minutes.")
    print(f"Name: {name} | Venue: {venue or 'not recorded'} | Speed: {speed:g} bits/s")
    print(f"Plan saved on B only: {path.resolve()}")
    print("A does not need the JSON. When B says RECORDING, A runs:")
    print(transmitter_command(plan, configs))
    answer = input("Press Enter to open the camera, or Q to keep the plan and exit: ").strip()
    if answer.lower() == "q":
        print("Plan saved. No camera recording started.")
        return path
    return record_session(path, name, camera, output, threshold, conditions, plots)
