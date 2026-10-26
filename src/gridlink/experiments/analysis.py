"""Offline decoding of raw captures against a known experiment plan.

Every planned trial produces a record, including trials that were never synchronised
or whose CRC failed, so failures cannot silently disappear from the results.

Two decoding views are recorded for each trial:

* ``frame_valid`` is the realistic receiver outcome from ``parse_frame``: the header
  and payload CRCs must both pass.
* ``decoded_bit_errors`` is genie-aided: the known plan supplies the header, and only
  the coded section is decoded and compared with the transmitted payload plus CRC.
  This isolates how well each code corrects channel errors from header failures.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..coding.errors import UncorrectableError
from ..coding.pipeline import CodingConfig, decode
from ..optical.detection import classify_intensity
from ..optical.synchronization import TimedSample, find_first_pattern, sample_symbols
from ..protocol import FRAME_OVERHEAD_BITS, SYNC_WORD, bytes_to_bits, crc16, parse_frame
from .capture import Capture
from .plan import ExperimentPlan, Trial, trial_offsets
from .recording import ExperimentRecord

SYNC_PATTERN = bytes_to_bits(SYNC_WORD)
HEADER_BITS = FRAME_OVERHEAD_BITS


@dataclass(frozen=True)
class SessionConditions:
    physical_notes: str = ""
    mirror_alignment: str = ""
    distance_m: float | None = None
    lighting: str = ""
    glare: bool = False
    obstruction: bool = False


def auto_threshold(intensities: list[float]) -> float:
    """Midpoint of the 5th and 95th intensity percentiles, robust to a few outliers."""
    low, high = np.percentile(intensities, [5, 95])
    return float((low + high) / 2)


def _protected_bits(trial: Trial) -> list[int]:
    return bytes_to_bits(trial.payload + crc16(trial.payload).to_bytes(2, "big"))


def _mismatches(expected: list[int], received: list[int]) -> int:
    return sum(left != right for left, right in zip(expected, received))


def _identify_first_trial(
    samples: list[TimedSample], start: float, plan: ExperimentPlan, first_candidate: int
) -> int:
    """Return the remaining trial whose known header best matches a detected frame."""
    received = sample_symbols(samples, start, plan.symbol_duration, HEADER_BITS)
    best_index = first_candidate
    best_errors: int | None = None
    for trial in plan.trials[first_candidate:]:
        errors = _mismatches(trial.frame_bits()[:HEADER_BITS], received)
        errors += HEADER_BITS - len(received)
        if best_errors is None or errors < best_errors:
            best_index, best_errors = trial.index, errors
    return best_index


def _record(
    plan: ExperimentPlan,
    trial: Trial,
    threshold: float,
    conditions: SessionConditions,
    timestamp_utc: str,
    start: float | None,
    received: list[int] | None,
) -> ExperimentRecord:
    transmitted = trial.frame_bits()
    protected = _protected_bits(trial)
    config = CodingConfig(trial.coding, trial.repetitions)
    channel_errors = decoded_errors = corrected = None
    decoded_payload = None
    frame_valid = False
    if received is None:
        failure = "synchronisation"
    else:
        channel_errors = _mismatches(transmitted, received)
        if len(received) < len(transmitted):
            failure = "truncated"
        else:
            try:
                decoded, _ = decode(received[HEADER_BITS:], len(protected), config)
            except UncorrectableError:
                pass
            else:
                decoded_errors = _mismatches(protected, decoded)
            try:
                frame = parse_frame(received)
            except ValueError as error:
                failure = str(error)
            else:
                frame_valid = (
                    frame.payload == trial.payload
                    and frame.sequence == trial.index % 256
                    and frame.coding == trial.coding
                    and frame.repetitions == trial.repetitions
                )
                failure = None if frame_valid else "frame does not match planned trial"
                corrected = frame.corrected_codewords
                decoded_payload = frame.payload.hex()
    return ExperimentRecord(
        run_id=f"{plan.name}-{trial.index:03d}",
        timestamp_utc=timestamp_utc,
        coding_scheme=trial.coding,
        repetition_factor=trial.repetitions if trial.coding == "repetition" else None,
        payload_bits=len(trial.payload) * 8,
        encoded_bits=len(transmitted) - HEADER_BITS,
        random_seed=plan.seed,
        symbol_duration=plan.symbol_duration,
        threshold=threshold,
        physical_notes=conditions.physical_notes,
        mirror_alignment=conditions.mirror_alignment,
        distance_m=conditions.distance_m,
        lighting=conditions.lighting,
        glare=conditions.glare,
        obstruction=conditions.obstruction,
        transmitted_bits=transmitted,
        received_bits=received,
        decoded_payload=decoded_payload,
        frame_valid=frame_valid,
        synchronisation_failures=int(received is None),
        elapsed_seconds=len(transmitted) * plan.symbol_duration,
        trial_index=trial.index,
        frame_start=start,
        information_bits=len(protected),
        channel_bit_errors=channel_errors,
        decoded_bit_errors=decoded_errors,
        corrected_codewords=corrected,
        failure_reason=failure,
    )


def analyse_capture(
    plan: ExperimentPlan,
    capture: Capture,
    threshold: float | None = None,
    conditions: SessionConditions | None = None,
) -> list[ExperimentRecord]:
    """Locate and score every planned trial in a raw capture.

    The first detected frame is identified by its header, which anchors the plan's
    schedule. Each later trial is searched for within half a gap of its predicted
    start, and every successful detection re-anchors the schedule to absorb drift.
    """
    if threshold is None:
        threshold = auto_threshold(capture.intensities)
    conditions = conditions or SessionConditions()
    samples = [
        TimedSample(timestamp, classify_intensity(intensity, threshold), intensity)
        for timestamp, intensity in zip(capture.timestamps, capture.intensities)
    ]
    symbol = plan.symbol_duration
    offsets = trial_offsets(plan)
    slack = plan.gap / 2
    timestamp_utc = capture.metadata.get("started_utc", "")
    starts: dict[int, float | None] = {}
    anchor: tuple[int, float] | None = None
    cursor = capture.timestamps[0] - len(SYNC_PATTERN) * symbol
    for trial in plan.trials:
        if trial.index in starts:
            continue
        if anchor is None:
            start = find_first_pattern(
                samples, symbol, SYNC_PATTERN, cursor, capture.timestamps[-1]
            )
            if start is None:
                starts.update({later.index: None for later in plan.trials[trial.index :]})
                break
            identified = _identify_first_trial(samples, start, plan, trial.index)
            starts.update({index: None for index in range(trial.index, identified)})
            starts[identified] = start
            anchor = (identified, start)
            continue
        anchor_index, anchor_start = anchor
        predicted = anchor_start + offsets[trial.index] - offsets[anchor_index]
        start = find_first_pattern(
            samples, symbol, SYNC_PATTERN, predicted - slack, predicted + slack
        )
        starts[trial.index] = start
        if start is not None:
            anchor = (trial.index, start)
    records = []
    for trial in plan.trials:
        start = starts.get(trial.index)
        received = None
        if start is not None:
            received = sample_symbols(samples, start, symbol, len(trial.frame_bits()))
        records.append(
            _record(plan, trial, threshold, conditions, timestamp_utc, start, received)
        )
    return records


@dataclass(frozen=True)
class ConfigSummary:
    coding: str
    repetitions: int
    trials: int
    synchronised: int
    valid_frames: int
    channel_ber: float | None
    decoded_ber: float | None
    useful_throughput_bps: float


def summarise_records(records: list[ExperimentRecord]) -> list[ConfigSummary]:
    """Aggregate per coding configuration, pooling bits across trials."""
    groups: dict[tuple[str, int], list[ExperimentRecord]] = {}
    for record in records:
        key = (record.coding_scheme, record.repetition_factor or 1)
        groups.setdefault(key, []).append(record)
    summaries = []
    for (coding, repetitions), group in sorted(groups.items()):
        received = [record for record in group if record.received_bits is not None]
        complete = [record for record in group if record.decoded_bit_errors is not None]
        channel_bits = sum(len(record.received_bits or []) for record in received)
        information_bits = sum(record.information_bits or 0 for record in complete)
        delivered = sum(record.payload_bits for record in group if record.frame_valid)
        airtime = sum(record.elapsed_seconds for record in group)
        summaries.append(
            ConfigSummary(
                coding=coding,
                repetitions=repetitions,
                trials=len(group),
                synchronised=len(received),
                valid_frames=sum(record.frame_valid for record in group),
                channel_ber=(
                    sum(record.channel_bit_errors or 0 for record in received) / channel_bits
                    if channel_bits
                    else None
                ),
                decoded_ber=(
                    sum(record.decoded_bit_errors or 0 for record in complete) / information_bits
                    if information_bits
                    else None
                ),
                useful_throughput_bps=delivered / airtime if airtime else 0.0,
            )
        )
    return summaries
