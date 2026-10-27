
from gridlink.coding.pipeline import CodingConfig
from gridlink.experiments.plan import make_plan, transmitter_command, parse_config, repeats_per_method, plan_method_labels

def test_transmitter_command_rebuilds_identical_plan():
    plan = make_plan(
        "quiet1",
        [CodingConfig("repetition", 3)],
        repeats=3,
        payload_bytes=4,
        symbol_duration=0.25,
        gap=2.0,
        seed=1,
    )
    command = transmitter_command(plan)
    assert "--seed 1" in command
    assert "repetition:3" in command
    assert "--bit-rate 4" in command
    rebuilt = make_plan(
        plan.name,
        [parse_config(text) for text in plan_method_labels(plan)],
        repeats_per_method(plan),
        len(plan.trials[0].payload),
        plan.symbol_duration,
        plan.gap,
        plan.seed,
    )
    assert rebuilt.trials == plan.trials


def test_transmitter_command_keeps_multi_method_order():
    configs = [parse_config(text) for text in
               "none,repetition:3,repetition:5,repetition:7,hamming,parity2d,hamming-interleaved".split(",")]
    plan = make_plan("full", configs, 3, 2, 0.25, 2.0, 1)
    command = transmitter_command(plan, configs)
    labels = command.split("--configs ")[1].split()[0].split(",")
    rebuilt = make_plan("full", [parse_config(text) for text in labels], 3, 2, 0.25, 2.0, 1)
    assert rebuilt.trials == plan.trials
