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

from ..coding.pipeline import REPETITION_SCHEMES, CodingConfig
from ..protocol import Frame, build_frame

PLAN_VERSION = 2
SPREAD_HEADER_SUFFIX = "+sh"


@dataclass(frozen=True)
class Trial:
    index: int
    coding: str
    repetitions: int
    payload: bytes
    spread_header: bool = False

    def config(self) -> CodingConfig:
        return CodingConfig(self.coding, self.repetitions, self.spread_header)

    def frame(self) -> Frame:
        return Frame(
            self.payload,
            sequence=self.index % 256,
            coding=self.coding,
            repetitions=self.repetitions,
            spread_header=self.spread_header,
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
            trial.config().validate()
            if trial.repetitions > 255:
                raise ValueError("repetition factor must fit in one byte")
            if len(trial.payload) > 65535:
                raise ValueError("payload is too large")


def parse_config(text: str) -> CodingConfig:
    """Parse ``scheme``, ``scheme:N`` or either with ``+sh`` (spread header) appended."""
    spread_header = text.endswith(SPREAD_HEADER_SUFFIX)
    if spread_header:
        text = text[: -len(SPREAD_HEADER_SUFFIX)]
    scheme, _, factor = text.partition(":")
    config = CodingConfig(scheme, int(factor) if factor else 1, spread_header)
    config.validate()
    return config


def config_label(config: CodingConfig) -> str:
    """Inverse of ``parse_config``."""
    label = config.scheme
    if config.scheme in REPETITION_SCHEMES:
        label += f":{config.repetitions}"
    return label + SPREAD_HEADER_SUFFIX if config.spread_header else label


def plan_method_labels(plan: ExperimentPlan) -> list[str]:
    """Unique coding labels in first-seen order (for regenerating the plan on A)."""
    labels: list[str] = []
    for trial in plan.trials:
        label = config_label(trial.config())
        if label not in labels:
            labels.append(label)
    return labels


def repeats_per_method(plan: ExperimentPlan) -> int:
    labels = plan_method_labels(plan)
    if not labels or len(plan.trials) % len(labels):
        raise ValueError("plan trial count is not a multiple of its coding methods")
    return len(plan.trials) // len(labels)


def transmitter_command(
    plan: ExperimentPlan,
    configs: list[CodingConfig] | None = None,
    lead_in: float = 5.0,
) -> str:
    """Return an A-side command that rebuilds this plan from seed (no JSON copy).

    The shuffle depends on config order, so pass the configs in the order given to
    ``make_plan``. Without them, first-seen order only reproduces single-method plans.
    """
    bit_rate = 1 / plan.symbol_duration
    payload_bytes = len(plan.trials[0].payload)
    labels = [config_label(config) for config in configs] if configs else plan_method_labels(plan)
    configs = ",".join(labels)
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
        Trial(index, config.scheme, config.repetitions, payload, config.spread_header)
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


def _trial_document(trial: Trial, spread_headers: bool) -> dict:
    document = {
        "index": trial.index,
        "coding": trial.coding,
        "repetitions": trial.repetitions,
        "payload_hex": trial.payload.hex(),
    }
    if spread_headers:
        document["spread_header"] = trial.spread_header
    return document


def save_plan(plan: ExperimentPlan, path: str | Path) -> None:
    """Save a plan, using version 1 unless a trial needs a spread header.

    Older code ignores unknown fields, so it would misread a spread-header trial as
    adjacent. Version 2 makes it refuse those plans instead.
    """
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    spread_headers = any(trial.spread_header for trial in plan.trials)
    document = {
        "version": PLAN_VERSION if spread_headers else 1,
        "name": plan.name,
        "symbol_duration": plan.symbol_duration,
        "gap": plan.gap,
        "seed": plan.seed,
        "trials": [_trial_document(trial, spread_headers) for trial in plan.trials],
    }
    destination.write_text(json.dumps(document, indent=2), encoding="utf-8")


def _boolean(value) -> bool:
    if not isinstance(value, bool):
        raise ValueError("spread_header must be true or false")
    return value


def load_plan(path: str | Path) -> ExperimentPlan:
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    if document.get("version") not in (1, PLAN_VERSION):
        raise ValueError(f"unsupported plan version: {document.get('version')}")
    trials = tuple(
        Trial(
            int(item["index"]),
            str(item["coding"]),
            int(item["repetitions"]),
            bytes.fromhex(item["payload_hex"]),
            _boolean(item.get("spread_header", False)),
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
