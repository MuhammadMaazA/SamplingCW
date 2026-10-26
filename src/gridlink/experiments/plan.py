"""Shared trial schedules for physical experiments.

The transmitter and the offline analysis load the same plan, so every trial's payload,
coding mode, and nominal start time are known exactly on both sides of the channel.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from math import isfinite
from pathlib import Path

from ..coding.pipeline import CodingConfig
from ..protocol import Frame, build_frame

PLAN_VERSION = 1


@dataclass(frozen=True)
class Trial:
    index: int
    coding: str
    repetitions: int
    payload: bytes

    def frame(self) -> Frame:
        return Frame(
            self.payload,
            sequence=self.index % 256,
            coding=self.coding,
            repetitions=self.repetitions,
        )

    def frame_bits(self) -> list[int]:
        return build_frame(self.frame())


@dataclass(frozen=True)
class ExperimentPlan:
    name: str
    symbol_duration: float
    gap: float
    seed: int
    trials: tuple[Trial, ...]

    def __post_init__(self) -> None:
        if not isfinite(self.symbol_duration) or self.symbol_duration <= 0:
            raise ValueError("symbol duration must be finite and positive")
        if not isfinite(self.gap) or self.gap < 4 * self.symbol_duration:
            raise ValueError("gap must be finite and at least four symbols")
        if not self.trials:
            raise ValueError("plan must contain at least one trial")
        for position, trial in enumerate(self.trials):
            if trial.index != position:
                raise ValueError("plan trials must be stored in schedule order")
            CodingConfig(trial.coding, trial.repetitions).validate()
            if trial.repetitions > 255:
                raise ValueError("repetition factor must fit in one byte")
            if len(trial.payload) > 65535:
                raise ValueError("payload is too large")


def parse_config(text: str) -> CodingConfig:
    """Parse a coding name or ``repetition:N`` into a validated configuration."""
    scheme, _, factor = text.partition(":")
    config = CodingConfig(scheme, int(factor) if factor else 1)
    config.validate()
    return config


def config_label(config: CodingConfig) -> str:
    if config.scheme == "repetition":
        return f"repetition:{config.repetitions}"
    return config.scheme


def plan_method_labels(plan: ExperimentPlan) -> list[str]:
    """Unique coding labels in first-seen order (for regenerating the plan on A)."""
    labels: list[str] = []
    for trial in plan.trials:
        label = config_label(CodingConfig(trial.coding, trial.repetitions))
        if label not in labels:
            labels.append(label)
    return labels


def repeats_per_method(plan: ExperimentPlan) -> int:
    labels = plan_method_labels(plan)
    if not labels or len(plan.trials) % len(labels):
        raise ValueError("plan trial count is not a multiple of its coding methods")
    return len(plan.trials) // len(labels)


def transmitter_command(plan: ExperimentPlan, lead_in: float = 5.0) -> str:
    """Return an A-side command that rebuilds this plan from seed (no JSON copy)."""
    bit_rate = 1 / plan.symbol_duration
    payload_bytes = len(plan.trials[0].payload)
    configs = ",".join(plan_method_labels(plan))
    command = (
        "gridlink transmit-plan "
        f"--name {plan.name} "
        f"--configs {configs} "
        f"--repeats {repeats_per_method(plan)} "
        f"--payload-bytes {payload_bytes} "
        f"--bit-rate {bit_rate:g} "
        f"--gap {plan.gap:g} "
        f"--seed {plan.seed}"
    )
    if lead_in != 5.0:
        command += f" --lead-in {lead_in:g}"
    return command


def make_plan(
    name: str,
    configs: list[CodingConfig],
    repeats: int,
    payload_bytes: int,
    symbol_duration: float,
    gap: float,
    seed: int,
) -> ExperimentPlan:
    """Create a randomised, fully specified schedule of trials.

    Trial order is shuffled so slow drifts in lighting or alignment during a session
    are spread across coding modes instead of being confounded with one of them.
    """
    if not configs or repeats <= 0 or not 0 <= payload_bytes <= 65535:
        raise ValueError("at least one configuration, one repeat and a valid payload are needed")
    if not isfinite(symbol_duration) or symbol_duration <= 0:
        raise ValueError("symbol duration must be positive")
    if not isfinite(gap) or gap < 4 * symbol_duration:
        raise ValueError("gap must be at least four symbols to separate frames")
    generator = random.Random(seed)
    # Each repetition compares every code on the same payload, in shuffled order.
    payloads = [generator.randbytes(payload_bytes) for _ in range(repeats)]
    order = [(config, payload) for config in configs for payload in payloads]
    generator.shuffle(order)
    trials = tuple(
        Trial(index, config.scheme, config.repetitions, payload)
        for index, (config, payload) in enumerate(order)
    )
    return ExperimentPlan(name, symbol_duration, gap, seed, trials)


def trial_offsets(plan: ExperimentPlan) -> list[float]:
    """Return each trial's nominal start, relative to the first trial's start."""
    offsets: list[float] = []
    elapsed = 0.0
    for trial in plan.trials:
        offsets.append(elapsed)
        elapsed += len(trial.frame_bits()) * plan.symbol_duration + plan.gap
    return offsets


def plan_duration(plan: ExperimentPlan) -> float:
    if not plan.trials:
        return 0.0
    last = plan.trials[-1]
    return trial_offsets(plan)[-1] + len(last.frame_bits()) * plan.symbol_duration


def save_plan(plan: ExperimentPlan, path: str | Path) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "version": PLAN_VERSION,
        "name": plan.name,
        "symbol_duration": plan.symbol_duration,
        "gap": plan.gap,
        "seed": plan.seed,
        "trials": [
            {
                "index": trial.index,
                "coding": trial.coding,
                "repetitions": trial.repetitions,
                "payload_hex": trial.payload.hex(),
            }
            for trial in plan.trials
        ],
    }
    destination.write_text(json.dumps(document, indent=2), encoding="utf-8")


def load_plan(path: str | Path) -> ExperimentPlan:
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    if document.get("version") != PLAN_VERSION:
        raise ValueError(f"unsupported plan version: {document.get('version')}")
    trials = tuple(
        Trial(
            int(item["index"]),
            str(item["coding"]),
            int(item["repetitions"]),
            bytes.fromhex(item["payload_hex"]),
        )
        for item in document["trials"]
    )
    return ExperimentPlan(
        str(document["name"]),
        float(document["symbol_duration"]),
        float(document["gap"]),
        int(document["seed"]),
        trials,
    )
