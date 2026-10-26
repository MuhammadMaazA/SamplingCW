# GridLink

COMP0228 coursework: send binary messages from a laptop screen to a camera using black and white flashes. The camera can face the screen directly or view its reflection in a mirror.

For our current setup, A is the transmitting laptop and B receives through the iPad front camera, without a mirror. The iPad feed must already appear as an OpenCV camera on B through your camera/virtual-camera setup. The program runs on the laptop, not on the iPad. Use the same `--camera` index for calibration and recording.

## Setup

Use the same code version on both laptops. In an existing checkout:

```bash
git checkout main
git pull --ff-only
```

Create a virtual environment once, or activate the one you already have. On Windows:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Then install on both laptops:

```bash
python -m pip install -e .
```

For plots, install `python -m pip install -e ".[analysis]"` on the laptop doing the analysis.

## Calibrate and send a message

Laptop A transmits; laptop B receives. Keep the screen and camera still. On B:

```bash
gridlink calibrate --camera 0
```

Select a tight box inside the screen patch and press Enter. When B asks for black, run on A:

```bash
gridlink reference black --duration 15
```

While black is visible, focus B's calibration window and press Space. Wait for B to ask for white, then run on A:

```bash
gridlink reference white --duration 15
```

Press Space on B while white is visible. Note the threshold and check `valid=True`. If contrast is too low, adjust brightness, lighting or alignment and repeat.

Start B's receiver, replacing `127` with the calibrated threshold:

```bash
gridlink receive --bit-rate 10 --threshold 127 --timeout 120
```

Select the screen region again. Once B is receiving, run on A:

```bash
gridlink transmit "hi" --coding parity2d --bit-rate 10
```

This takes about 29 seconds. B should print `hi`. Restart B's receiver for each message. Press `q` in an active window to stop. Try `--camera 1` if the default camera will not open.

Both sides must use the same speed. `--bit-rate 10` is equivalent to `--duration 0.1`. The default is 0.25 seconds per bit. Faster settings need enough camera samples per symbol; start at 10 bits/s and increase gradually.

## Coding methods

- `--coding none`: uncoded data, used as the baseline.
- `--coding repetition --repetitions 3`: send each bit three times and take a majority vote. Also compare factors 5 and 7.
- `--coding hamming`: Hamming (7,4), sending seven bits for four data bits. Corrects one error per codeword.
- `--coding parity2d`: our additional method. Arrange 16 bits in a 4x4 grid, add row and column checks, then send the resulting 25-bit grid. One failed row and column locate a single error. Double errors are rejected; some larger patterns can be missed or miscorrected.
- `--coding hamming-interleaved`: our extension. Send columns from groups of up to eight Hamming codewords, spreading a short burst across different words. Reverse the order before decoding. It adds no extra bits, but cannot fix arbitrary bursts or missing observations.

The grid method is based on the [Kurose and Ross two-dimensional parity exercise](https://gaia.cs.umass.edu/kurose_ross/interactive/2d_parity.php). Its full-block rate is 16/25, compared with 4/7 for Hamming and 1/N for repetition-N. Padding and framing reduce the useful rate further. Extended Hamming was removed to keep the project focused; old plans using that optional mode are no longer supported. Its header ID is reserved rather than reassigned.

## How the link works

The transmitter adds a CRC-16 to the payload, applies the selected code, then adds a sync pattern and protected header. The header states the coding mode, repetition factor, sequence number and original payload length. The sync word is 48 bits and the header is protected with repetition-3, giving 240 bits of frame overhead. Bits are sent most-significant first.

The receiver finds the sync pattern, samples symbol centres using camera timestamps, decodes the header and data, then checks the payload CRC. CRC detects corruption; it does not repair it. Input is zero-padded to a multiple of four bits for Hamming or 16 for grid parity and trimmed after decoding using the original length. Missing observations stop sampling instead of silently becoming bits.

## Saved experiments

For guided setup, run this on B:

```bash
gridlink setup
```

It asks for the run name, venue/room, iPad camera index, coding methods, repeats, speed, payload size, threshold and physical conditions. Choose methods by number (for example `2` for repetition-3, or `2,5,6` for repetition-3, Hamming and grid parity). The choice sets the actual transmission plan. Date/time is recorded automatically, with local and UTC timestamps.

Setup saves the plan on B only and prints A's `transmit-plan` command. A does not need the JSON file: that command rebuilds the same schedule from the seed and settings. Press Enter on B to open the camera, select the region, then press Space to record. Start the printed command on A only when B says RECORDING. Q in the setup prompt saves the plan and exits without opening a camera.

Session folders include the name, venue, method (or `comparison` for mixed methods) and timestamp, such as `run1-UCL-East-repetition-3-20261026-153000-123456Z/`. The original name, venue and actual methods are saved in `session.json`, and each result row records its coding mode and venue. Reports keep different venues separate. Older CSVs without a venue still load with that field blank.

For scripts or a previously prepared plan, use the commands below. `record` and `analyse` also accept `--venue "UCL East"`.

Single-message `receive` prints the result but does not save experiment data. For comparisons, create a plan on A and copy the exact file to B:

```bash
gridlink plan experiments/plans/comparison.json --name comparison --configs none,repetition:3,repetition:5,repetition:7,hamming,parity2d,hamming-interleaved --repeats 5 --payload-bytes 4 --bit-rate 10 --gap 2 --seed 1
```

The plan compares the same payloads across modes in shuffled order. It has 35 trials and prints the expected transmission time. On B, replace `127` with your calibrated threshold and `0` with the iPad camera's index:

```bash
gridlink record experiments/plans/comparison.json --name quiet1 --camera 0 --threshold 127 --lighting "indoor" --notes "iPad front camera; direct screen; no mirror" --plots
```

Select a box inside A's screen and press Enter. The next window shows a live preview with a green box: press **R** to select again, **Space** to start recording, or **Q** to cancel. The clock does not run while you are choosing the box. Once B says **RECORDING**, start A within 20 seconds:

```bash
gridlink transmit-plan experiments/plans/comparison.json
```

Recording stops automatically after the planned airtime plus 30 seconds to allow time to start A. Press **Q** in the recording window to stop early and keep the samples. An early stop can leave incomplete or missing trials, which remain in the results.

Each run gets a new folder under `experiments/results/`. The full path is printed. It saves `plan.json`, `capture.csv`, a cropped image of the selected screen region (`capture.png`), capture and session logs, `session.json` with settings/status, `results.csv` and `summary.csv`. `--plots` also saves the charts in `plots/`; omit it if plotting support is not installed. The chosen settings are saved before camera setup. If capture or analysis fails, the error is logged and already saved raw data is retained. Nothing is overwritten.

For manual capture and analysis, the original `capture OUTPUT --plan PLAN` and `analyse PLAN CAPTURE OUTPUT` commands remain available. Manual capture also waits for Space and saves a region image and capture log next to the CSV.

Repeat with one changed physical condition, such as lighting, distance or partial obstruction. Use `--name noise1` and accurate notes; `--distance`, `--obstruction` and `--glare` record those conditions. For a speed comparison, generate another plan with the same seed and settings but a different bit rate, and share that exact plan with B.

Keep both the raw capture and analysed CSV. Capture refuses to overwrite recordings. Back up `experiments/results/` separately because Git ignores it. Plans under `experiments/plans/` can be committed.

## Tables and plots

Use analysed CSVs, not raw captures:

```bash
gridlink report experiments/results/quiet1-TIMESTAMP/results.csv experiments/results/noise1-TIMESTAMP/results.csv --output experiments/results/report1
```

Replace the example folder names with the actual paths printed by `record`. The output directory must be new. It contains a summary CSV, comparison charts, error-location maps, error-run histograms, full error positions and notes on the metrics. Different recorded conditions and speeds stay in separate groups. Duplicate recordings are rejected to avoid counting the same run twice.

BER uses observed bits. Decoded BER uses complete, decodable trials, including their payload CRC bits; unavailable data and rejected codewords are excluded. Always report failure counts alongside BER. Throughput is delivered payload bits divided by nominal frame airtime, excluding gaps and setup. Counts and rates describe the collected sample; they do not establish statistical significance.

Maps display at most 20 trials and 2000 bits per group; CSVs retain the full data. An unavailable tail means sampling stopped. Offline alignment can be wrong under severe noise, so check the raw recording when results look suspicious.

## Software simulations

```bash
gridlink simulate "GridLink" --coding repetition --repetitions 3 --flip-probability 0.1 --trials 100 --seed 1
gridlink simulate "Grid" --coding hamming --burst-length 8 --flip-probability 1 --trials 1
gridlink simulate "Grid" --coding hamming-interleaved --burst-length 8 --flip-probability 1 --trials 1
```

Without a burst interval, each encoded bit flips independently. With `--burst-length`, only bits inside that interval can flip; `--burst-start` sets its first bit. Simulations report decoded BER and rejection counts. Repetition runs also print the theoretical majority-vote BER for comparison with the lab example.

## Reading the code

- `cli.py`: command arguments and calls to the relevant functions.
- `transmitter.py` and `receiver.py`: screen display, camera capture and calibration.
- `protocol.py`: framing, bit order and CRC.
- `coding/`: repetition, Hamming, grid parity and interleaving.
- `optical/`: brightness measurements and timing recovery.
- `experiments/`: trial plans, saved results, simulations, analysis and plots.

Timing recovery uses a sorted list and binary search to find the closest camera sample efficiently. Keep this when explaining performance: scanning the whole recording for every symbol made long captures too slow.

## Coursework status

The group has reported receiving `hi` through a direct physical link. The methods and experiment tools are implemented, but repeated physical measurements and evaluation are still needed. Compare error and transmission rate, examine the actual noise, then evaluate interleaving under the same conditions as ordinary Hamming. Simulated noise alone does not meet the brief's physical-noise requirement.

Finish the 4-6 page report, presentation/live demo and contribution forms using your measured results. Explain the additional method's source, the tradeoffs, and limitations. Four-person groups should investigate the extension in depth or attempt more than one. Every member must understand the submitted code.

Lecture 4's compression algorithms and Thursday Lab 3's Wordle/decision-tree exercises are separate topics, not extra features required by the supplied Coursework 1 brief.
