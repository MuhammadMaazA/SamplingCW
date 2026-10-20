"""Command-line entry points for local and physical link tests."""

from __future__ import annotations

import argparse

from .protocol import Frame
from .receiver import calibrate, receive
from .transmitter import display_reference, transmit


def main() -> None:
    parser = argparse.ArgumentParser(prog="gridlink")
    subparsers = parser.add_subparsers(dest="command", required=True)
    send = subparsers.add_parser("transmit")
    send.add_argument("message")
    send.add_argument("--duration", type=float, default=0.25)
    recv = subparsers.add_parser("receive")
    recv.add_argument("--camera", type=int, default=0)
    recv.add_argument("--duration", type=float, default=0.25)
    recv.add_argument("--threshold", type=float, default=127.0)
    recv.add_argument("--timeout", type=float, default=30.0)
    reference = subparsers.add_parser("reference")
    reference.add_argument("value", choices=("black", "white"))
    reference.add_argument("--duration", type=float, default=5.0)
    calibration = subparsers.add_parser("calibrate")
    calibration.add_argument("--camera", type=int, default=0)
    calibration.add_argument("--samples", type=int, default=20)
    calibration.add_argument("--min-contrast", type=float, default=20.0)
    args = parser.parse_args()
    if args.command == "transmit":
        transmit(Frame(args.message.encode("utf-8")), args.duration)
    elif args.command == "receive":
        frame = receive(args.camera, args.duration, args.threshold, timeout=args.timeout)
        print(frame.payload.decode("utf-8", errors="replace"))
    elif args.command == "reference":
        display_reference(int(args.value == "white"), args.duration)
    else:
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

