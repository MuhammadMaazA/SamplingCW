# GridLink

GridLink is a low-rate optical communication system for COMP0228. The intended physical path is:

**Laptop A screen -> physical mirror -> Laptop B webcam**

The first implementation sends black/white symbols, frames them with a synchronisation marker, and checks received frames with CRC-16. Repetition and Hamming (7,4) are available as independent coding modules for the experimental work.

## Current status

Implemented: Python package layout, frame serialisation, CRC validation, high-contrast patterns, clocked webcam receiver, ROI sampling, repetition coding, Hamming (7,4), and hardware-independent tests.

Not yet implemented: calibration UI, robust camera-clock synchronisation, experiment recording/analysis, third coding method, spatial grid extension, and physical validation. No physical results are claimed yet.

## Installation

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

Run checks with:

```powershell
pytest
ruff check .
```

## Initial link test

On Laptop B, point the webcam at the reflected screen region and run:

```powershell
gridlink receive --duration 0.25 --threshold 127 --timeout 30
```

On Laptop A, display a short message:

```powershell
gridlink transmit "GridLink test" --duration 0.25
```

The receiver currently selects an ROI from its first camera frame. Keep the mirror aligned, use a stable lighting condition, and start the receiver before the transmitter. Press `q` to stop either window. The current receiver is a conservative debugging baseline; its clocked sampling must be validated and improved experimentally before it is treated as the final protocol.

## Protocol

Frames contain a two-byte marker, version, sequence number, two-byte payload length, UTF-8 payload bytes, and CRC-16. Bits are transmitted most-significant bit first. A camera frame is not treated as a new optical symbol; the receiver samples at the configured symbol interval. This is intentionally simple and is the first baseline for investigating dropped, repeated, and mid-transition camera samples.

## Physical setup

Place the screen so its black/white display is visible in the mirror. Place the webcam to view the reflected screen, not the screen directly. Begin with a short distance, low ambient light, moderate screen brightness, and a large reflected image. Then vary alignment, distance, lighting, glare, obstruction, and symbol duration while recording actual elapsed time, payload errors, frame failures, and physical notes.

## Coursework plan

The measured comparison should include uncoded transmission, repetition factors 3/5/7, Hamming (7,4), and a justified third error-correcting method. Results must describe both error and useful transmission rate. Noise should be visualised as aligned bit errors or erasures where possible, distinguishing burst/timing failures from independent bit flips. At least one extension should be chosen from observed weaknesses, such as interleaving, retransmission, adaptive coding, or signal filtering.

