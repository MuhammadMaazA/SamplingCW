# GridLink

GridLink sends data from one laptop's screen, through a mirror, to another laptop's webcam. It is our COMP0228 coursework project.

**Laptop A screen -> physical mirror -> Laptop B webcam**

The screen sends black/white symbols. The receiver finds frame boundaries, decodes the data and checks it with CRC-16.

## Current status

The software supports uncoded transmission, repetition coding and Hamming (7,4), with calibration, synchronisation and CRC checks. It also includes noise simulations, experiment plans, raw camera capture, offline analysis and automated tests.

Physical mirror tests are still needed. The third coding method, measurement plots, extension, report and presentation are also still to do.

## Installation

Both laptops need protocol version 2. Use `main` on both laptops and pull the latest changes before testing.

If you already have the repository, open that folder. Otherwise:

```bash
git clone https://github.com/MuhammadMaazA/gridlink.git
cd gridlink
```

For an existing clone, check for local changes before updating:

```bash
git status
git fetch origin
git checkout main
git pull --ff-only
```

Create the environment once. On Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

Run checks with:

```bash
python -m pytest
python -m ruff check src tests
```

## First mirror test

Physical path: **Laptop A screen → mirror → Laptop B webcam**. Laptop B must see the *reflected* screen, not the screen directly. Use a large reflected patch, high screen brightness, low ambient light, and grant camera permission to the terminal.

### Roles

- **Laptop A = transmitter** (fullscreen black/white flashes)
- **Laptop B = receiver** (webcam + ROI selection)

Start the receiver/capture side first, then the transmitter.

### 1. Calibrate

On Laptop B:

```bash
gridlink calibrate --camera 0
```

Select a tight region inside the reflected screen patch and press Enter. When B asks for black, run on A:

```bash
gridlink reference black --duration 5
```

While black is visible, focus B's calibration window and press Space to measure it. Wait until B asks for white, then run on A:

```bash
gridlink reference white --duration 5
```

Press Space on B while white is visible. Check that `valid=True` and note the `threshold`. If contrast is too low, adjust the mirror, brightness or room lighting and repeat.

### 2. Send a short message

On Laptop B (start first; timeout must exceed the message length):

```bash
gridlink receive --duration 0.25 --threshold 127 --timeout 120
```

Replace `127` with the threshold from calibration. Once B has selected its region and is receiving, run on A:

```bash
gridlink transmit "hi" --duration 0.25
```

This takes about 68 seconds. B should print `hi`. After that works, try `--duration 0.1` on both laptops. Press `q` in the active window to stop.

### 3. Run the smoke plan

Use the same `experiments/plans/smoke.json` on both laptops. It contains two trials and takes about 139 seconds to transmit. Start on B:

```bash
gridlink capture experiments/results/smoke-capture.csv --plan experiments/plans/smoke.json
```

On Laptop A, once B is capturing:

```bash
gridlink transmit-plan experiments/plans/smoke.json
```

After capture finishes, analyse on B, or copy the capture file to A first:

```bash
gridlink analyse experiments/plans/smoke.json experiments/results/smoke-capture.csv experiments/results/smoke.csv --distance 1.0 --lighting "lab"
```

Replace the distance and lighting with the actual conditions. The command prints a summary and saves one row per trial, including failures. Output directories are created automatically. Use a new capture filename for each session to avoid overwriting measurements.

## Manual single-message options

```bash
gridlink transmit "hi" --coding none --duration 0.25
gridlink transmit "hi" --coding repetition --repetitions 3 --duration 0.25
gridlink transmit "hi" --coding hamming --duration 0.25
```

The coding mode and repetition factor are included in the frame header, so the receiver can decode the selected mode automatically. The transmitted payload plus its CRC is FEC-encoded. Hamming padding is removed using the protected-bit length derived from the payload length in the header.

## Troubleshooting

- Low contrast: check the selected region, increase screen brightness, reduce room lighting or adjust the mirror.
- Timeout: start B before A, check both use the same symbol duration, and allow enough time for the whole frame.
- Camera unavailable: try `--camera 1` and check camera permissions for the terminal or Python app.
- Protocol mismatch: update both laptops to protocol version 2. Check their code versions rather than relying on the branch name.

## Experiment data

`gridlink.experiments.recording.ExperimentRecord` stores run metadata, physical conditions, aligned bit streams, frame validity, synchronisation failures, and elapsed time. The metrics module keeps BER, frame error rate, coding rate, useful throughput, and error-run calculations independent of camera hardware. Generated results should be written under `experiments/results/`, which is ignored by Git.

The receiver selects a region from its first camera frame. Keep the mirror still and the lighting stable. Camera timing and physical reliability still need testing.

## Protocol

Frames begin with a 48-bit sync word: four `0xAA` bytes, providing an alternating preamble for timing acquisition, followed by the two magic bytes `0xD3 0x91`, which stop whole-symbol shifts of the periodic preamble from matching. The receiver accepts the sync word with up to 9 flipped bits. The six-byte header contains version, coding identifier, repetition factor, sequence number, and payload length, followed by a header CRC; these 64 bits are always protected by repetition x3, independently of the payload coding, so a single flipped header bit cannot discard an otherwise correctable frame. Frame overhead is 240 bits. The protected data is the payload followed by a CRC-16 over the payload, then encoded using the selected FEC. Bits are transmitted most-significant bit first. The receiver stores timestamped camera classifications, searches for the preamble, samples estimated symbol centres, reads the coding metadata, decodes the protected data, and finally validates the payload CRC. A camera frame is not treated as a new optical symbol; missing observations are recorded as unavailable rather than silently converted into bits.

## Physical setup

Place the screen so its black/white display is visible in the mirror. Place the webcam to view the reflected screen, not the screen directly. Begin with a short distance, low ambient light, moderate screen brightness, and a large reflected image. Then vary alignment, distance, lighting, glare, obstruction, and symbol duration while recording actual elapsed time, payload errors, frame failures, and physical notes.

## Coursework plan

The measured comparison should include uncoded transmission, repetition factors 3/5/7, Hamming (7,4), and a justified third error-correcting method. Results must describe both error and useful transmission rate. Noise should be visualised as aligned bit errors or erasures where possible, distinguishing burst/timing failures from independent bit flips. At least one extension should be chosen from observed weaknesses, such as interleaving, retransmission, adaptive coding, or signal filtering.

## Physical experiment sessions

A session is planned once, transmitted on one laptop, captured as raw intensities on the other, and decoded offline. Copy the same plan file to both laptops. JSON plans under `experiments/plans/` can be tracked normally; generated captures and results under `experiments/results/` are ignored.

```powershell
gridlink plan experiments/plans/s1.json --name s1 --repeats 5 --payload-bytes 4 --duration 0.25 --gap 2
gridlink capture experiments/results/s1-capture.csv --plan experiments/plans/s1.json   # Laptop B, start first
gridlink transmit-plan experiments/plans/s1.json                                        # Laptop A
gridlink analyse experiments/plans/s1.json experiments/results/s1-capture.csv experiments/results/s1.csv --distance 1.0 --lighting "lab, blinds down"
```

`plan` shuffles the trial order with the seed, so slow lighting or alignment drift is spread across coding modes. `transmit-plan` schedules every symbol and trial on one absolute clock. `capture` stores every camera sample, so a session can be re-analysed with another threshold or filter without repeating it. `analyse` writes one row per planned trial, including synchronisation failures, truncated frames, and CRC failures, and prints a per-coding summary.

Each row records the transmitted and received frame bits for error-position analysis, plus two decoding views: `frame_valid` is the realistic receiver outcome (both CRCs pass), while `decoded_bit_errors` decodes the coded section using the known header from the plan. The second view measures how well a code corrects the channel independently of header failures.

`channel_ber` includes sync, header and payload bits, using only observed symbols. `decoded_ber` covers payload plus CRC for complete trials, using the known plan; it excludes missing and truncated trials, whose failure counts must be reported alongside BER. `useful_throughput_bps` divides successfully delivered payload bits by nominal frame airtime, including framing overhead but excluding gaps and setup. It is not measured wall-clock session throughput. Payload code rates are 1 for uncoded, 1/N for repetition-N, and 4/7 for Hamming; the fixed 240-bit frame overhead reduces the overall useful rate further.

First-trial identification uses the closest planned header and is an offline estimate when that header is corrupted. Sequence numbers wrap after 256 trials, which can make late-start identification ambiguous in longer plans. Absolute transmitter deadlines reduce accumulated drift, but screen refresh, camera exposure, scheduling delays and clock drift still require physical testing.

## Software noise experiments

The lab-style binary symmetric channel experiment can be run without hardware:

```powershell
gridlink simulate "GridLink test" --coding none --flip-probability 0.1 --trials 100
gridlink simulate "GridLink test" --coding repetition --repetitions 3 --flip-probability 0.1 --trials 100
gridlink simulate "GridLink test" --coding hamming --flip-probability 0.1 --trials 100
```

The result reports mean decoded BER, standard deviation, and coding rate. The Python API also supports a contiguous burst-noise interval. For physical measurements, vary one condition at a time (such as distance, lighting or symbol duration), repeat each configuration, and report failures alongside BER and useful throughput.

