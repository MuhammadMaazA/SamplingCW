"""Command-line entry points for local and physical link tests."""

from __future__ import annotations

import argparse

from .protocol import Frame
from .receiver import receive
from .transmitter import transmit


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
    args = parser.parse_args()
    if args.command == "transmit":
        transmit(Frame(args.message.encode("utf-8")), args.duration)
    else:
        frame = receive(args.camera, args.duration, args.threshold, timeout=args.timeout)
        print(frame.payload.decode("utf-8", errors="replace"))

