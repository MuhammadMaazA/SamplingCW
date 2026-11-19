import csv
import json
import tempfile
from pathlib import Path

import pytest

from screencam.coding.pipeline import CODING_IDS, REPETITION_SCHEMES, CodingConfig, decode, encode
from screencam.coding.spreading import spread, unspread
from screencam.experiments.analysis import analyse_capture, summarise_records
from screencam.experiments.capture import Capture, load_capture
from screencam.experiments.plan import (
    config_label,
    load_plan,
    make_plan,
    parse_config,
    save_plan,
    transmitter_command,
    trial_offsets,
)
from screencam.experiments.recording import read_csv, write_csv
from screencam.protocol import (
    HEADER_CODED_BITS,
    SYNC_BITS,
    Frame,
    build_frame,
    bytes_to_bits,
    parse_frame,
)

REPO = Path(__file__).resolve().parent.parent
NEW_TOKENS = [
    "repetition:3", "repetition-spread:3", "repetition-spread:3+sh",
    "hamming-interleaved", "hamming-interleaved-16", "hamming-interleaved-16+sh",
]
# Built by the code before spread layouts existed, so old frames must still parse.
OLD_FRAMES = [
    (Frame(b"Hi", 7, "repetition", 3), 336,
     "aaaaaaaad39100003800000700003f0001ff000000000038007007000fff1c0e001f8e071f81c0ff81c7"),
    (Frame(b"ok", 200, "hamming-interleaved"), 296,
     "aaaaaaaad39100003800003f000007fc0e00000000000038e3f038038038ebf55e40ebf55e"),
]


def _flip(bits, start, length):
    noisy = bits[:]
    for index in range(start, start + length):
        noisy[index] ^= 1
    return noisy


@pytest.mark.parametrize("factor", [1, 3, 5, 7])
def test_spread_and_unspread_round_trip(factor):
    bits = [(i * 5 + i // 3) % 2 for i in range(factor * 13)]
    assert unspread(spread(bits, factor), factor) == bits


def test_spread_is_copy_major():
    assert spread([1, 1, 1, 0, 0, 0], 3) == [1, 0, 1, 0, 1, 0]
    with pytest.raises(ValueError):
        spread([1, 0], 3)


@pytest.mark.parametrize("factor", [3, 5])
def test_spread_repetition_corrects_a_burst_one_copy_long(factor):
    data = [1, 0, 1, 1, 0, 0, 1, 0] * 4
    spread_config = CodingConfig("repetition-spread", factor)
    adjacent_config = CodingConfig("repetition", factor)
    spread_bits = encode(data, spread_config)
    adjacent_bits = encode(data, adjacent_config)
    adjacent_failures = 0
    for start in range(len(spread_bits) - len(data) + 1):
        noisy = _flip(spread_bits, start, len(data))
        assert decode(noisy, len(data), spread_config)[0] == data
        noisy = _flip(adjacent_bits, start, len(data))
        adjacent_failures += decode(noisy, len(data), adjacent_config)[0] != data
    assert adjacent_failures == len(spread_bits) - len(data) + 1


def test_depth_16_interleaving_corrects_a_16_bit_burst():
    data = [1, 0, 0, 1, 1, 1, 0, 1] * 16
    deep = CodingConfig("hamming-interleaved-16")
    shallow = CodingConfig("hamming-interleaved")
    encoded = encode(data, deep)
    for start in range(len(encoded) - 16 + 1):
        assert decode(_flip(encoded, start, 16), len(data), deep)[0] == data
    assert decode(_flip(encode(data, shallow), 0, 16), len(data), shallow)[0] != data


@pytest.mark.parametrize("spread_header", [False, True])
@pytest.mark.parametrize("coding", list(CODING_IDS))
def test_frame_round_trip_every_layout(coding, spread_header):
    repetitions = 3 if coding in REPETITION_SCHEMES else 1
    frame = Frame(b"GL\x00\xff", sequence=42, coding=coding, repetitions=repetitions,
                  spread_header=spread_header)
    parsed = parse_frame([0, 1, 1] + build_frame(frame) + [0, 0])
    assert parsed == frame


@pytest.mark.parametrize("frame,length,golden", OLD_FRAMES)
def test_frames_built_the_old_way_still_parse(frame, length, golden):
    bits = bytes_to_bits(bytes.fromhex(golden))[:length]
    assert build_frame(frame) == bits
    assert parse_frame(bits) == frame
    assert parse_frame(bits, spread_header=False) == frame


def _header_burst(frame, start, length):
    return _flip(build_frame(frame), SYNC_BITS + start, length)


def test_spread_header_survives_a_burst_that_kills_the_adjacent_header():
    adjacent = Frame(b"ok", coding="repetition-spread", repetitions=3)
    spread_frame = Frame(b"ok", coding="repetition-spread", repetitions=3, spread_header=True)
    with pytest.raises(ValueError, match="header CRC"):
        parse_frame(_header_burst(adjacent, 30, 3))
    assert parse_frame(_header_burst(spread_frame, 30, 3)) == spread_frame
    # A spread header also survives a burst as long as one whole header copy.
    copy = HEADER_CODED_BITS // 3
    for start in range(0, HEADER_CODED_BITS - copy + 1, 8):
        assert parse_frame(_header_burst(spread_frame, start, copy)) == spread_frame


def test_parse_frame_can_be_told_the_header_layout():
    bits = build_frame(Frame(b"ok", spread_header=True))
    assert parse_frame(bits, spread_header=True).spread_header
    with pytest.raises(ValueError, match="header CRC"):
        parse_frame(bits, spread_header=False)


@pytest.mark.parametrize("token", NEW_TOKENS + ["repetition:5+sh", "none+sh", "parity2d"])
def test_config_tokens_round_trip(token):
    assert config_label(parse_config(token)) == token


def test_config_tokens_parse_to_expected_layouts():
    assert parse_config("repetition-spread:3+sh") == CodingConfig("repetition-spread", 3, True)
    assert parse_config("hamming-interleaved+sh") == CodingConfig("hamming-interleaved", 1, True)
    assert parse_config("hamming-interleaved-16") == CodingConfig("hamming-interleaved-16")
    with pytest.raises(ValueError):
        parse_config("repetition-spread:4")


def test_transmitter_command_rebuilds_plan_with_new_layouts():
    configs = [parse_config(token) for token in NEW_TOKENS]
    plan = make_plan("glare", configs, 4, 4, 0.25, 2.0, 7)
    command = transmitter_command(plan, configs)
    assert "repetition-spread:3+sh" in command and "hamming-interleaved-16+sh" in command
    labels = command.split("--configs ")[1].split()[0].split(",")
    rebuilt = make_plan("glare", [parse_config(text) for text in labels], 4, 4, 0.25, 2.0, 7)
    assert rebuilt.trials == plan.trials
    assert sum(trial.spread_header for trial in plan.trials) == 8


def test_new_options_leave_the_old_shuffle_unchanged():
    old = [parse_config(token) for token in NEW_TOKENS[:1] + NEW_TOKENS[3:4]]
    new = [parse_config(token) for token in NEW_TOKENS[1:3]]
    mixed = make_plan("p", old + new, 3, 4, 0.25, 2.0, 1)
    plain = make_plan("p", old + [CodingConfig("hamming"), CodingConfig("parity2d")],
                      3, 4, 0.25, 2.0, 1)
    assert [trial.payload for trial in mixed.trials] == [trial.payload for trial in plain.trials]


def test_old_plan_json_still_loads_and_regenerates():
    plan = load_plan(REPO / "experiments" / "plans" / "comparison.json")
    tokens = "none,repetition:3,repetition:5,repetition:7,hamming,parity2d,hamming-interleaved"
    rebuilt = make_plan("comparison", [parse_config(text) for text in tokens.split(",")],
                        5, 4, 0.1, 2.0, 1)
    assert plan == rebuilt
    assert not any(trial.spread_header for trial in plan.trials)


def test_plan_save_load_keeps_spread_header():
    configs = [parse_config(token) for token in NEW_TOKENS]
    plan = make_plan("glare", configs, 2, 4, 0.25, 2.0, 3)
    old = make_plan("old", configs[:2], 2, 4, 0.25, 2.0, 3)
    with tempfile.TemporaryDirectory() as folder:
        for saved, version in ((plan, 2), (old, 1)):
            path = Path(folder) / f"{saved.name}.json"
            save_plan(saved, path)
            document = json.loads(path.read_text(encoding="utf-8"))
            assert document["version"] == version
            assert all(("spread_header" in trial) == (version == 2)
                       for trial in document["trials"])
            assert load_plan(path) == saved


def _ideal_capture(plan, samples_per_symbol=4, lead_in=3.0):
    """A noiseless capture of the plan, sampled several times per symbol."""
    step = plan.symbol_duration / samples_per_symbol
    levels = []
    for trial, offset in zip(plan.trials, trial_offsets(plan)):
        start = round((lead_in + offset) / step)
        levels.extend([0] * (start - len(levels)))
        for bit in trial.frame_bits():
            levels.extend([bit] * samples_per_symbol)
    levels.extend([0] * round(lead_in / step))
    timestamps = [index * step + step / 2 for index in range(len(levels))]
    return Capture(timestamps, [20.0 + 200.0 * level for level in levels])


def test_analysis_reads_each_trial_with_its_planned_header_layout():
    configs = [parse_config(token) for token in NEW_TOKENS]
    plan = make_plan("glare", configs, 1, 2, 0.25, 2.0, 5)
    records = analyse_capture(plan, _ideal_capture(plan), threshold=120.0)
    assert all(record.frame_valid for record in records)
    assert [record.spread_header for record in records] == [
        trial.spread_header for trial in plan.trials
    ]
    labels = {(row.coding, row.repetitions, row.spread_header) for row in
              summarise_records(records)}
    assert ("repetition-spread", 3, True) in labels and ("repetition-spread", 3, False) in labels


def test_analysis_rejects_a_frame_whose_header_layout_differs_from_the_plan():
    sent = make_plan("glare", [parse_config("repetition-spread:3+sh")], 1, 2, 0.25, 2.0, 5)
    planned = make_plan("glare", [parse_config("repetition-spread:3")], 1, 2, 0.25, 2.0, 5)
    [record] = analyse_capture(planned, _ideal_capture(sent), threshold=120.0)
    assert not record.frame_valid
    assert record.failure_reason == "header CRC check failed"
    assert record.decoded_bit_errors == 0


def test_glare_session_still_matches_the_final_report():
    folders = list((REPO / "experiments" / "results").glob("quiet1b-lab-repetition-3-*"))
    summary = REPO / "experiments" / "results" / "report-final" / "summary.csv"
    if not folders or not summary.exists():
        pytest.skip("recorded results are not available")
    folder = folders[0]
    records = analyse_capture(load_plan(folder / "plan.json"), load_capture(folder / "capture.csv"),
                              threshold=143.0)
    row = summarise_records(records)[0]
    with summary.open(newline="", encoding="utf-8") as stream:
        expected = next(line for line in csv.DictReader(stream) if line["group"] == "G23")
    assert (row.trials, row.synchronised, row.valid_frames) == (
        int(expected["trials"]), int(expected["synchronised"]), int(expected["valid_frames"])
    )
    assert row.channel_ber == pytest.approx(float(expected["channel_ber"]))
    assert row.decoded_ber == pytest.approx(float(expected["decoded_ber"]))
    assert row.useful_throughput_bps == pytest.approx(float(expected["useful_throughput_bps"]))


def test_results_csv_keeps_spread_header_and_old_csvs_default_to_false():
    plan = make_plan("glare", [parse_config("hamming-interleaved-16+sh")], 1, 2, 0.25, 2.0, 5)
    records = analyse_capture(plan, _ideal_capture(plan), threshold=120.0)
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "results.csv"
        write_csv(records, path)
        assert read_csv(path) == records
        with path.open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        with path.open("w", newline="", encoding="utf-8") as stream:
            names = [name for name in rows[0] if name != "spread_header"]
            writer = csv.DictWriter(stream, fieldnames=names, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        assert not read_csv(path)[0].spread_header
