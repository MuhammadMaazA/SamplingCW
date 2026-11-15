# Glare layouts session

One session comparing the as-built frame layouts with the spread and deep-interleaving layouts, under the same glare conditions as the earlier glare runs: the same dim room, the same iPad set-up, 4 bits/s and a 4-byte (32-bit) payload.

Laptop 1 transmits (A) in front of the iPad, whose front camera is open and shows A live on its screen. Laptop 2 records (B) with its built-in webcam, which films the iPad screen.

## Plan

`glare-layouts.json` was made with:

```bash
gridlink plan experiments/plans/glare-layouts.json --name glare-layouts --configs repetition:3,repetition-spread:3,repetition-spread:3+sh,hamming-interleaved,hamming-interleaved-16,hamming-interleaved-16+sh --repeats 12 --payload-bytes 4 --bit-rate 4 --gap 2 --seed 1
```

| Layout | Role | Trials | Frame bits | Seconds per frame |
|---|---|---|---|---|
| `repetition:3` | as built, the baseline | 12 | 384 | 96 |
| `repetition-spread:3` | spread copies | 12 | 384 | 96 |
| `repetition-spread:3+sh` | spread copies plus spread header | 12 | 384 | 96 |
| `hamming-interleaved` | depth 8 | 12 | 324 | 81 |
| `hamming-interleaved-16` | depth 16 | 12 | 324 | 81 |
| `hamming-interleaved-16+sh` | depth 16 plus spread header | 12 | 324 | 81 |

72 trials in shuffled order, with 2 s gaps. Planned airtime is 6514 s (108.6 min). B records for airtime plus 30 s, 6544 s (109.1 min), and stops by itself.

## Before you start

- Both laptops pull the same new code and reinstall: `git pull --ff-only` then `python -m pip install -e .`. Old code cannot send or decode these layouts.
- Check on both: `gridlink transmit --help` lists `repetition-spread` and `--spread-header`.
- Both laptops plugged in. Sleep, screen saver and screen dimming off for at least two hours.
- iPad auto-lock off (Settings, Display and Brightness, Auto-Lock, Never). iPad charging.
- Same dim room, same lamp and glare position, same iPad set-up as the earlier glare runs. Do not change the lighting, the devices or the threshold during the session.
- Do not touch either laptop or the iPad while recording.

## 1. Calibrate (once, at the start)

On laptop 2 (B):

```bash
gridlink calibrate --camera 0
```

Select a tight box inside the screen patch and press Enter. When B asks for black, run on laptop 1 (A):

```bash
gridlink reference black --duration 15
```

Press Space on B while black is showing. When B asks for white, run on A:

```bash
gridlink reference white --duration 15
```

Press Space on B while white is showing. Check `valid=True` and write down the threshold. Use this one threshold for the whole session.

## 2. Start recording on laptop 2 (B)

Replace `143` with the calibrated threshold and `0` with the camera index:

```bash
gridlink record experiments/plans/glare-layouts.json --name glare-layouts --camera 0 --threshold 143 --venue lab --lighting "indoor dim" --glare --notes "ipad live view; glare; auto-lock off; glare-layouts"
```

Select the box inside A's screen, check the preview, then press Space. Wait for **RECORDING**.

`gridlink setup` also works: name it `glare-layouts`, choose methods `2,8,9,7,10,11` in that order, 12 trials per method, 4 bits/s, 4 payload bytes, the calibrated threshold, lighting `indoor dim`, glare `y`, and type the notes above. It builds the same 72 trials.

## 3. Transmit on laptop 1 (A)

Straight after B says RECORDING (within 20 s, so the last frame is not cut off):

```bash
gridlink transmit-plan experiments/plans/glare-layouts.json
```

If A does not have the JSON, this rebuilds the identical plan from the seed. Keep the `--configs` order exactly as written:

```bash
gridlink transmit-plan --name glare-layouts --configs repetition:3,repetition-spread:3,repetition-spread:3+sh,hamming-interleaved,hamming-interleaved-16,hamming-interleaved-16+sh --repeats 12 --payload-bytes 4 --bit-rate 4 --gap 2 --seed 1
```

It should print `rebuilt plan: 72 trials, 6514.0s airtime, seed=1`. If the numbers differ, stop and check the code version.

## 4. During and after

- Do not press Q on either laptop. Do not stop the recording early. B stops by itself after 109 min and then analyses the capture.
- A prints `completed` at the end. B prints valid frames per layout, for example `repetition-spread x3 +sh: 5/12 valid frames`.
- Keep the whole session folder `experiments/results/glare-layouts-lab-comparison-<timestamp>/` and back it up.

## Checklist

- [ ] Both laptops on the new code, `pip install -e .` done
- [ ] Laptops plugged in, sleep and screen saver off
- [ ] iPad auto-lock off and charging
- [ ] Same room, lighting, glare and iPad set-up as the earlier glare runs
- [ ] Calibrated once, `valid=True`, threshold written down: ______
- [ ] B started with `--name glare-layouts`, `--threshold`, `--glare` and `--lighting "indoor dim"`
- [ ] A started within 20 s of RECORDING
- [ ] Nobody touched the set-up or pressed Q for the full 109 min
- [ ] Session folder backed up
