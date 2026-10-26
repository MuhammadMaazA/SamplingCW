"""Command-line entry points for local and physical link tests."""

from __future__ import annotations

import argparse
from math import isfinite

from .coding.pipeline import CODING_IDS, CodingConfig
from .experiments.simulation import run_trials, summarise_trials
from .protocol import Frame

DEFAULT_CONFIGS = "none,repetition:3,repetition:5,repetition:7,hamming,parity2d"
CAPTURE_MARGIN_SECONDS = 30.0


def _positive_float(text: str) -> float:
    value = float(text)
    if not isfinite(value) or value <= 0:
        raise argparse.ArgumentTypeError("value must be finite and positive")
    return value


def _add_speed_options(parser) -> None:
    speed = parser.add_mutually_exclusive_group()
    speed.add_argument(
        "--duration", type=_positive_float, help="seconds per encoded bit (default 0.25)"
    )
    speed.add_argument("--bit-rate", type=_positive_float, help="encoded bits per second")


def _add_experiment_commands(subparsers) -> None:
    plan = subparsers.add_parser("plan", help="create a randomised experiment plan")
    plan.add_argument("output")
    plan.add_argument("--name", default="session")
    plan.add_argument("--configs", default=DEFAULT_CONFIGS)
    plan.add_argument("--repeats", type=int, default=5)
    plan.add_argument("--payload-bytes", type=int, default=4)
    _add_speed_options(plan)
    plan.add_argument("--gap", type=float, default=2.0)
    plan.add_argument("--seed", type=int, default=0)
    play = subparsers.add_parser("transmit-plan", help="display every trial in a plan")
    play.add_argument("plan")
    play.add_argument("--lead-in", type=float, default=5.0)
    record = subparsers.add_parser("capture", help="record raw camera intensities")
    record.add_argument("output")
    record.add_argument("--camera", type=int, default=0)
    length = record.add_mutually_exclusive_group(required=True)
    length.add_argument("--duration", type=float)
    length.add_argument("--plan", help="size the capture to cover this plan")
    analyse = subparsers.add_parser("analyse", help="decode a capture against its plan")
    analyse.add_argument("plan")
    analyse.add_argument("capture")
    analyse.add_argument("output")
    analyse.add_argument("--threshold", type=float)
    analyse.add_argument("--distance", type=float)
    analyse.add_argument("--alignment", default="")
    analyse.add_argument("--lighting", default="")
    analyse.add_argument("--notes", default="")
    analyse.add_argument("--glare", action="store_true")
    analyse.add_argument("--obstruction", action="store_true")
    report = subparsers.add_parser("report", help="make tables and plots from analysed trial CSVs")
    report.add_argument("results", nargs="+")
    report.add_argument("--output", required=True, help="new output directory")


def _run_experiment_command(args) -> None:
    from .experiments.plan import load_plan, make_plan, parse_config, plan_duration, save_plan

    if args.command == "plan":
        configs = [parse_config(text) for text in args.configs.split(",")]
        plan = make_plan(
            args.name,
            configs,
            args.repeats,
            args.payload_bytes,
            args.duration,
            args.gap,
            args.seed,
        )
        save_plan(plan, args.output)
        print(f"trials={len(plan.trials)}")
        print(f"transmission_seconds={plan_duration(plan):.1f}")
    elif args.command == "transmit-plan":
        from .transmitter import transmit_plan

        completed = transmit_plan(load_plan(args.plan), args.lead_in)
        print("completed" if completed else "stopped early")
    elif args.command == "capture":
        from .receiver import capture

        duration = args.duration
        if args.plan:
            duration = plan_duration(load_plan(args.plan)) + CAPTURE_MARGIN_SECONDS
        print(f"capturing for up to {duration:.0f}s; start transmit-plan now")
        print(f"samples={capture(args.output, duration, args.camera)}")
    else:
        from .experiments.analysis import SessionConditions, analyse_capture, summarise_records
        from .experiments.capture import load_capture
        from .experiments.recording import write_csv

        conditions = SessionConditions(
            physical_notes=args.notes,
            mirror_alignment=args.alignment,
            distance_m=args.distance,
            lighting=args.lighting,
            glare=args.glare,
            obstruction=args.obstruction,
        )
        records = analyse_capture(
            load_plan(args.plan), load_capture(args.capture), args.threshold, conditions
        )
        write_csv(records, args.output)
        print(f"threshold={records[0].threshold:.1f}")
        print(f"{'coding':<14}{'sync':>7}{'valid':>7}{'chan BER':>10}{'dec BER':>10}{'bps':>8}")
        for row in summarise_records(records):
            label = f"{row.coding} x{row.repetitions}" if row.coding == "repetition" else row.coding
            channel = "-" if row.channel_ber is None else f"{row.channel_ber:.4f}"
            decoded = "-" if row.decoded_ber is None else f"{row.decoded_ber:.4f}"
            print(
                f"{label:<14}{row.synchronised:>3}/{row.trials:<3}{row.valid_frames:>3}/{row.trials:<3}"
                f"{channel:>10}{decoded:>10}{row.useful_throughput_bps:>8.2f}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(prog="gridlink")
    subparsers = parser.add_subparsers(dest="command", required=True)
    send = subparsers.add_parser("transmit")
    send.add_argument("message")
    _add_speed_options(send)
    send.add_argument("--coding", choices=tuple(CODING_IDS), default="none")
    send.add_argument("--repetitions", type=int, default=1)
    recv = subparsers.add_parser("receive")
    recv.add_argument("--camera", type=int, default=0)
    _add_speed_options(recv)
    recv.add_argument("--threshold", type=float, default=127.0)
    recv.add_argument("--timeout", type=float, default=30.0)
    reference = subparsers.add_parser("reference")
    reference.add_argument("value", choices=("black", "white"))
    reference.add_argument("--duration", type=float, default=5.0)
    calibration = subparsers.add_parser("calibrate")
    calibration.add_argument("--camera", type=int, default=0)
    calibration.add_argument("--samples", type=int, default=20)
    calibration.add_argument("--min-contrast", type=float, default=20.0)
    simulation = subparsers.add_parser("simulate")
    simulation.add_argument("message")
    simulation.add_argument("--coding", choices=tuple(CODING_IDS), default="none")
    simulation.add_argument("--repetitions", type=int, default=1)
    simulation.add_argument("--flip-probability", type=float, default=0.1)
    simulation.add_argument("--trials", type=int, default=100)
    simulation.add_argument("--seed", type=int, default=0)
    simulation.add_argument("--burst-start", type=int, default=0)
    simulation.add_argument("--burst-length", type=int)
    _add_experiment_commands(subparsers)
    args = parser.parse_args()
    if args.command in ("transmit", "receive", "plan"):
        args.duration = 1 / args.bit_rate if args.bit_rate else (
            args.duration if args.duration is not None else 0.25
        )
    if args.command == "report":
        from .experiments.report import write_report

        print(f"report={write_report(args.results, args.output)}")
    elif args.command in ("plan", "transmit-plan", "capture", "analyse"):
        _run_experiment_command(args)
    elif args.command == "transmit":
        from .transmitter import transmit

        transmit(
            Frame(
                args.message.encode("utf-8"),
                coding=args.coding,
                repetitions=args.repetitions,
            ),
            args.duration,
        )
    elif args.command == "receive":
        from .receiver import receive

        frame = receive(args.camera, args.duration, args.threshold, timeout=args.timeout)
        print(f"coding={frame.coding} repetitions={frame.repetitions}")
        print(f"corrected_codewords={frame.corrected_codewords}")
        print(frame.payload.decode("utf-8", errors="replace"))
    elif args.command == "reference":
        from .transmitter import display_reference

        display_reference(int(args.value == "white"), args.duration)
    elif args.command == "calibrate":
        from .receiver import calibrate

        result = calibrate(
            args.camera,
            samples_per_level=args.samples,
            minimum_contrast=args.min_contrast,
        )
        print(f"black={result.black_level:.1f}")
        print(f"white={result.white_level:.1f}")
        print(f"threshold={result.threshold:.1f}")
        print(f"contrast={result.contrast:.1f}")
        print(f"valid={result.valid}")
    else:
        bits = [
            (byte >> shift) & 1
            for byte in args.message.encode("utf-8")
            for shift in range(7, -1, -1)
        ]
        config = CodingConfig(args.coding, args.repetitions)
        summary = summarise_trials(
            run_trials(
                bits, config, args.flip_probability, args.trials, args.seed,
                burst=(args.burst_start, args.burst_length)
                if args.burst_length is not None else None,
            )
        )
        print(f"coding={summary.coding} repetitions={summary.repetitions}")
        print(f"flip_probability={summary.flip_probability}")
        print(f"trials={summary.trials}")
        print(f"uncorrectable_trials={summary.uncorrectable_trials}")
        print(f"mean_decoded_ber={summary.mean_decoded_ber}")
        print(f"standard_deviation={summary.standard_deviation}")
        print(f"coding_rate={summary.coding_rate:.6f}")
