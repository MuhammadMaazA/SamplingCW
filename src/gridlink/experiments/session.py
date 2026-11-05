"""One command to save a plan, raw recording, analysis and session notes."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from ..coding.pipeline import CodingConfig, method_label
from .analysis import SessionConditions, analyse_capture, summarise_records
from .capture import load_capture
from .plan import config_label, load_plan, plan_duration, save_plan
from .recording import write_csv


def session_label(name: str, venue: str) -> str:
    """Keep folder names usable on both Windows and macOS."""
    text = f"{name}-{venue}" if venue else name
    return re.sub(r"[^A-Za-z0-9_-]+", "-", text).strip("-") or "run"


def record_session(
    plan_path: str | Path,
    name: str = "run",
    camera_index: int = 0,
    output: str | Path = "experiments/results",
    threshold: float | None = None,
    conditions: SessionConditions | None = None,
    plots: bool = False,
) -> Path:
    from ..receiver import capture

    if not name or Path(name).name != name or name in (".", ".."):
        raise ValueError("use a simple session name without directory separators")
    plan = load_plan(plan_path)
    conditions = conditions or SessionConditions()
    methods = sorted({config_label(trial.config()) for trial in plan.trials})
    folder_method = methods[0].replace(":", "-") if len(methods) == 1 else "comparison"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%fZ")
    folder = Path(output) / f"{session_label(name, conditions.venue)}-{folder_method}-{stamp}"
    folder.mkdir(parents=True, exist_ok=False)
    save_plan(plan, folder / "plan.json")
    metadata = {
        "name": name, "camera_index": camera_index, "conditions": asdict(conditions),
        "requested_threshold": threshold, "status": "preparing",
        "planned_seconds": plan_duration(plan), "plan": "plan.json",
        "created_local": datetime.now().astimezone().isoformat(),
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "trials": len(plan.trials), "bit_rate": 1 / plan.symbol_duration,
        "methods": methods,
    }
    # Save the chosen settings before camera setup, even if the run is interrupted.
    (folder / "session.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    with (folder / "session.log").open("x", encoding="utf-8", buffering=1) as log:
        def note(message):
            print(message, flush=True)
            log.write(f"{datetime.now(timezone.utc).isoformat()} {message}\n")

        try:
            note(f"SETUP: {name} | venue: {conditions.venue or 'not recorded'}")
            note(f"Session folder: {folder.resolve()}")
            note(f"Methods: {', '.join(metadata['methods'])} | {1 / plan.symbol_duration:g} bits/s")
            note("Select the screen region, check the preview, then press Space to record.")
            note("Start A after B says RECORDING; Q stops early and keeps the samples.")
            metadata["status"] = "capturing"
            samples = capture(folder / "capture.csv", plan_duration(plan) + 30, camera_index)
            metadata["samples"] = samples
            if samples == 0:
                raise RuntimeError("no samples recorded; check the camera connection")
            note("ANALYSING the saved recording. You can move the devices now.")
            raw = load_capture(folder / "capture.csv")
            metadata["capture"] = raw.metadata
            records = analyse_capture(plan, raw, threshold, conditions)
            write_csv(records, folder / "results.csv")
            metadata["threshold"] = records[0].threshold
            summaries = [asdict(row) for row in summarise_records(records)]
            with (folder / "summary.csv").open("x", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(summaries[0]))
                writer.writeheader()
                writer.writerows(summaries)
            for row in summaries:
                config = CodingConfig(row["coding"], row["repetitions"], row["spread_header"])
                note(f"{method_label(config)}: {row['valid_frames']}/{row['trials']} valid frames")
            if plots:
                from .report import write_report

                note("Saving plots.")
                write_report([folder / "results.csv"], folder / "plots")
            metadata["status"] = "saved"
            note("DONE: raw data, selected-region image, plan, results and summary saved.")
        except KeyboardInterrupt:
            metadata["status"] = "interrupted"
            note("INTERRUPTED: completed raw sample lines are retained in the session folder.")
            raise
        except Exception as error:
            metadata["status"] = "failed"
            metadata["error"] = str(error)
            note(f"FAILED: {error}. Keep this folder; existing data has not been deleted.")
            raise
        finally:
            metadata["finished_utc"] = datetime.now(timezone.utc).isoformat()
            (folder / "session.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return folder
