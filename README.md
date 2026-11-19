# GridLink

COMP0228 coursework: send binary messages from a laptop screen to a camera using black and white flashes. The flashes are protected with error correcting codes, and every run is recorded and analysed.

For our setup, A is the transmitting laptop. An iPad stands in front of A with its front camera open, so the iPad screen shows A live. B's built-in webcam films the iPad screen and the program reads that picture. The program runs on the two laptops, not on the iPad. Use the same `--camera` index for calibration and recording.

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
- `--coding hamming-interleaved-16`: the same, with groups of up to sixteen codewords. A burst of up to 16 bits now lands on 16 different codewords, so each one sees at most one error. Same number of bits as Hamming.
- `--coding repetition-spread --repetitions 3`: the same bits as repetition-3, in a different order. Plain repetition sends `aaabbbccc`, so one burst can flip every copy of a bit. Spread repetition sends the whole message, then the whole message again, then a third time (`abcabcabc`). Copies of a bit are now a whole message apart, so a burst no longer than one copy flips at most one copy of each bit and the majority vote still wins. The receiver puts the copies back next to each other before voting.
- `--spread-header` (with any coding): the header always uses repetition-3. This option sends its three copies one after another, the same way as spread repetition. The receiver does not know the layout before it reads the header, so it tries the normal layout first and, if the header CRC fails, the spread one. It reports which one worked. Older frames still decode as before.

In plans and `--configs`, write these as `repetition-spread:3` and `hamming-interleaved-16`, and add `+sh` to any method for a spread header, for example `repetition-spread:3+sh` or `hamming-interleaved+sh`. Results and reports keep each layout as its own group, labelled for example `repetition-spread x3 +sh`.

These layouts come from the burst model of the glare channel (`report/design_sim.py`). It predicts that adjacent repetition copies fail together, that deeper interleaving helps, and that the header is the main bottleneck under glare.

The grid method is two-dimensional parity, the simplest product code, introduced by Elias in 1954 (the report cites it). The Kurose and Ross two-dimensional parity exercise shows the same idea. Its full-block rate is 16/25, compared with 4/7 for Hamming and 1/N for repetition-N. Padding and framing reduce the useful rate further.

## How the link works

The transmitter adds a CRC-16 to the payload, applies the selected code, then adds a sync pattern and protected header. The header states the coding mode, repetition factor, sequence number and original payload length. The sync word is 48 bits and the header is protected with repetition-3, giving 240 bits of frame overhead. Bits are sent most-significant first.

The receiver finds the sync pattern, samples symbol centres using camera timestamps, decodes the header and data, then checks the payload CRC. CRC detects corruption; it does not repair it. Input is zero-padded to a multiple of four bits for Hamming or 16 for grid parity and trimmed after decoding using the original length. Missing observations stop sampling instead of silently becoming bits.

## Saved experiments

For guided setup, run this on B:

```bash
gridlink setup
```

It asks for the run name, venue/room, camera index, coding methods, repeats, speed, payload size, threshold and physical conditions. Choose methods by number (for example `2` for repetition-3, or `2,5,6` for repetition-3, Hamming and grid parity). Numbers 8 to 11 are the spread and deep-interleaving layouts. The choice sets the actual transmission plan. Date/time is recorded automatically, with local and UTC timestamps.

Setup saves the plan on B only and prints the `transmit-plan` command for A. A does not need the JSON file, because that command rebuilds the same schedule from the seed and settings. Press Enter on B to open the camera, select the region, then press Space to record. Start the printed command on A only when B says RECORDING. Q in the setup prompt saves the plan and exits without opening a camera.

Session folders include the name, venue, method (or `comparison` for mixed methods) and timestamp, such as `run1-UCL-East-repetition-3-20261026-153000-123456Z/`. The original name, venue and actual methods are saved in `session.json`, and each result row records its coding mode and venue. Reports keep different venues separate. Older CSVs without a venue still load with that field blank.

For scripts or a previously prepared plan, use the commands below. `record` and `analyse` also accept `--venue "UCL East"`.

Single-message `receive` prints the result but does not save experiment data. For comparisons, create a plan on A and copy the exact file to B:

```bash
gridlink plan experiments/plans/comparison.json --name comparison --configs none,repetition:3,repetition:5,repetition:7,hamming,parity2d,hamming-interleaved --repeats 5 --payload-bytes 4 --bit-rate 10 --gap 2 --seed 1
```

The plan compares the same payloads across modes in shuffled order. It has 35 trials and prints the expected transmission time. On B, replace `127` with your calibrated threshold and `0` with the camera index:

```bash
gridlink record experiments/plans/comparison.json --name quiet1 --camera 0 --threshold 127 --lighting "indoor" --notes "iPad front camera shown live; laptop webcam films the iPad screen" --plots
```

Select a box inside A's screen and press Enter. The next window shows a live preview with a green box: press **R** to select again, **Space** to start recording, or **Q** to cancel. The clock does not run while you are choosing the box. Once B says **RECORDING**, start A within 20 seconds:

```bash
gridlink transmit-plan experiments/plans/comparison.json
```

Recording stops automatically after the planned airtime plus 30 seconds to allow time to start A. Press **Q** in the recording window to stop early and keep the samples. An early stop can leave incomplete or missing trials, which remain in the results.

Each run gets a new folder under `experiments/results/`. The full path is printed. It saves `plan.json`, `capture.csv`, a cropped image of the selected screen region (`capture.png`), capture and session logs, `session.json` with settings/status, `results.csv` and `summary.csv`. `--plots` also saves the charts in `plots/`; omit it if plotting support is not installed. The chosen settings are saved before camera setup. If capture or analysis fails, the error is logged and already saved raw data is retained. Nothing is overwritten.

For manual capture and analysis, the original `capture OUTPUT --plan PLAN` and `analyse PLAN CAPTURE OUTPUT` commands remain available. Manual capture also waits for Space and saves a region image and capture log next to the CSV.

Repeat with one changed physical condition, such as lighting, distance or partial obstruction. Use `--name noise1` and accurate notes; `--distance`, `--obstruction` and `--glare` record those conditions. For a speed comparison, generate another plan with the same seed and settings but a different bit rate, and share that exact plan with B.

Keep both the raw capture and analysed CSV. Capture refuses to overwrite recordings. The raw captures and analysed CSVs of every recorded session are committed under `experiments/results/`, so keep a second backup copy of new recordings as well. Plans under `experiments/plans/` can be committed.

## Tables and plots

Use analysed CSVs, not raw captures:

```bash
gridlink report experiments/results/quiet1-TIMESTAMP/results.csv experiments/results/noise1-TIMESTAMP/results.csv --output experiments/results/report1
```

Replace the example folder names with the actual paths printed by `record`. The output directory must be new. It contains a summary CSV, comparison charts, error-location maps, error-run histograms, full error positions and notes on the metrics. Different recorded conditions and speeds stay in separate groups. Duplicate recordings are rejected to avoid counting the same run twice.

BER uses observed bits. Decoded BER uses complete, decodable trials, including their payload CRC bits; unavailable data and rejected codewords are excluded. Always report failure counts alongside BER. Delivery rate (called throughput in the code and the CSV columns) is the delivered payload bits divided by nominal frame airtime, excluding gaps and setup. Counts and rates describe the collected sample; they do not establish statistical significance.

Maps display at most 20 trials and 2000 bits per group; CSVs retain the full data. An unavailable tail means sampling stopped. Offline alignment can be wrong under severe noise, so check the raw recording when results look suspicious.

## Software simulations

```bash
gridlink simulate "GridLink" --coding repetition --repetitions 3 --flip-probability 0.1 --trials 100 --seed 1
gridlink simulate "Grid" --coding hamming --burst-length 8 --flip-probability 1 --trials 1
gridlink simulate "Grid" --coding hamming-interleaved --burst-length 8 --flip-probability 1 --trials 1
```

Without a burst interval, each encoded bit flips independently. With `--burst-length`, only bits inside that interval can flip; `--burst-start` sets its first bit. Simulations report decoded BER and rejection counts. Repetition runs also print the theoretical majority-vote BER for comparison with the lab example.

## Rebuilding the report

Every table row, figure and quoted statistic in `report/report.tex` is generated from the per-trial CSVs. The recorded sessions are already in `experiments/results/`, so from a fresh clone you can go straight to:

```bash
python -m pip install -e ".[dev,analysis]"
python -m pytest
python report/make_figures.py      # figures/, generated/table-*.tex, generated/stats.json
python report/gen_allruns.py       # generated/allruns-rows-a, -b and -c .tex
cd report && latexmk -pdf report.tex
```

The report uses the IEEEtran class (two columns, A4) and the Gill Sans MT font in its figures. Without that font the figures fall back to DejaVu Sans. `make_figures.py` also writes `generated/physical.tex`, `contrasts.tex`, `table-physical.tex` and `table-slices.tex`.

`report/data.py` lists the exact results files behind the report and reproduces its G01–G29 grouping. `make_figures.py` computes Wilson intervals, trial-bootstrap BER intervals, Fisher tests, burstiness permutation tests, and fits the Gilbert–Elliott burst models (`experiments/channel_model.py`). `design_sim.py` replays whole frames through a fitted model to compare layouts (spread repetition, interleaver depth, spread header).

## Reading the code

- `cli.py`: command arguments and calls to the relevant functions.
- `transmitter.py` and `receiver.py`: screen display, camera capture and calibration.
- `protocol.py`: framing, bit order and CRC.
- `coding/`: repetition, Hamming, grid parity, interleaving and spreading.
- `optical/`: brightness measurements and timing recovery.
- `experiments/`: trial plans, saved results, simulations, analysis and plots; `stats.py` and `channel_model.py` hold the statistics and burst model used by the report.

Timing recovery uses a sorted list and a binary search to find the camera frame closest to each symbol. Scanning the whole recording for every symbol was too slow on long captures.

## Presentation

The slides are in `presentation/gridlink-presentation.pptx` (and a PDF copy). There is no live demo. To rebuild them from the recorded data:

```bash
cd presentation
npm install
python make_plots.py         # charts and plots/stats.json from experiments/results
python extract_deck_data.py  # numbers from the code for the slides, deck/data.js (runs the tests, about 40 s)
python make_photos.py        # camera crops from the saved recordings
python make_merged.py        # the pictures on the combined slides, deck/figs/
python make_replay.py        # media/replay.mp4, a replay of one recording (needs ffmpeg)
node build_deck.js
```

`build_deck.js` reads those files and the report's `report/generated/stats.json`, so every number on the slides comes from the data. The slide code is in `deck/`. The deck has 36 slides. Slide 15 plays `media/demo.mp4` if you add a recording of a full run, or otherwise `media/replay.mp4`, a replay of one of our recordings that is labelled as not live. The slides and figures use the Gill Sans MT font, which comes with Microsoft Office.
