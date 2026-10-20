# GridLink

GridLink is a low-rate optical communication system for COMP0228. The intended physical path is:

**Laptop A screen -> physical mirror -> Laptop B webcam**

The first implementation sends black/white symbols, frames them with a synchronisation marker, and checks received frames with CRC-16. Repetition and Hamming (7,4) are available as independent coding modules for the experimental work.

## Current status

Implemented: Python package layout, frame serialisation, CRC validation, high-contrast patterns, preamble-based webcam synchronisation, ROI sampling, repetition coding, Hamming (7,4), and hardware-independent tests.

Not yet implemented: third coding method, analysis plots, spatial grid extension, and physical validation. Uncoded, repetition, and Hamming coding are integrated into the frame pipeline. Binary symmetric and burst-noise simulations, calibration, and CSV/JSON experiment recording are implemented; no physical results are claimed yet.

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

Select an integrated coding mode with:

```powershell
gridlink transmit "GridLink test" --coding none --duration 0.25
gridlink transmit "GridLink test" --coding repetition --repetitions 3 --duration 0.25
gridlink transmit "GridLink test" --coding repetition --repetitions 5 --duration 0.25
gridlink transmit "GridLink test" --coding repetition --repetitions 7 --duration 0.25
gridlink transmit "GridLink test" --coding hamming --duration 0.25
```

The coding mode and repetition factor are included in the uncoded frame header, so the receiver can decode the selected mode automatically. The transmitted payload plus its CRC is FEC-encoded. Hamming padding is removed using the protected-bit length stored in the header, and the original payload length is preserved.

## Calibration

On Laptop B, select the reflected optical region and run:

```powershell
gridlink calibrate --camera 0 --samples 20 --min-contrast 20
```

On Laptop A, run each reference command when prompted by the receiver:

```powershell
gridlink reference black --duration 5
gridlink reference white --duration 5
```

The calibration command reports measured black and white levels, their midpoint threshold, contrast separation, and whether the separation passed the requested minimum. The reference commands must be aimed through the same mirror geometry used for communication.

## Experiment data

`gridlink.experiments.recording.ExperimentRecord` stores run metadata, physical conditions, aligned bit streams, frame validity, synchronisation failures, and elapsed time. The metrics module keeps BER, frame error rate, coding rate, useful throughput, and error-run calculations independent of camera hardware. Generated results should be written under `experiments/results/`, which is ignored by Git.

The receiver currently selects an ROI from its first camera frame. Keep the mirror aligned, use a stable lighting condition, and start the receiver before the transmitter. Press `q` to stop either window. The current receiver is a conservative debugging baseline; its clocked sampling must be validated and improved experimentally before it is treated as the final protocol.

## Protocol

Frames begin with four `0xAA` bytes, providing an alternating preamble for timing acquisition. The header contains a two-byte marker, version, coding identifier, repetition factor, sequence number, original payload length, protected-bit length, and encoded-bit length, followed by a header CRC. The protected data is the payload followed by a CRC-16 over the payload, then encoded using the selected FEC. Bits are transmitted most-significant bit first. The receiver stores timestamped camera classifications, searches for the preamble, samples estimated symbol centres, reads the coding metadata, decodes the protected data, and finally validates the payload CRC. A camera frame is not treated as a new optical symbol; missing observations are recorded as unavailable rather than silently converted into bits.

## Physical setup

Place the screen so its black/white display is visible in the mirror. Place the webcam to view the reflected screen, not the screen directly. Begin with a short distance, low ambient light, moderate screen brightness, and a large reflected image. Then vary alignment, distance, lighting, glare, obstruction, and symbol duration while recording actual elapsed time, payload errors, frame failures, and physical notes.

## Coursework plan

The measured comparison should include uncoded transmission, repetition factors 3/5/7, Hamming (7,4), and a justified third error-correcting method. Results must describe both error and useful transmission rate. Noise should be visualised as aligned bit errors or erasures where possible, distinguishing burst/timing failures from independent bit flips. At least one extension should be chosen from observed weaknesses, such as interleaving, retransmission, adaptive coding, or signal filtering.

## Software noise experiments

The lab-style binary symmetric channel experiment can be run without hardware:

```powershell
gridlink simulate "GridLink test" --coding none --flip-probability 0.1 --trials 100
gridlink simulate "GridLink test" --coding repetition --repetitions 3 --flip-probability 0.1 --trials 100
gridlink simulate "GridLink test" --coding hamming --flip-probability 0.1 --trials 100
```

The result reports mean decoded BER, standard deviation, and coding rate. The Python API also supports a contiguous burst-noise interval. See `docs/experimental-plan.md` for the proposed parameter sweeps and physical measurements.

