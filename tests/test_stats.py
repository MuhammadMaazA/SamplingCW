import numpy as np
import pytest

from gridlink.experiments.channel_model import (
    GilbertElliott,
    fit_gilbert_elliott,
    memoryless_log_likelihood,
    run_position_context,
    sample_errors,
)
from gridlink.experiments.stats import (
    bootstrap_ratio_interval,
    burst_share,
    burstiness_permutation_test,
    fisher_exact,
    run_lengths,
    wilson_interval,
)


def test_wilson_interval_known_values():
    low, high = wilson_interval(0, 3)
    assert low == 0 and high == pytest.approx(0.5615, abs=1e-3)
    low, high = wilson_interval(3, 3)
    assert low == pytest.approx(0.4385, abs=1e-3) and high == 1


def test_fisher_exact_matches_textbook_tea_tasting():
    assert fisher_exact(3, 1, 1, 3) == pytest.approx(0.4857, abs=1e-4)
    assert fisher_exact(3, 0, 0, 3) == pytest.approx(0.1, abs=1e-9)


def test_bootstrap_interval_contains_pooled_ratio():
    low, high = bootstrap_ratio_interval([1, 2, 0, 5], [100, 100, 100, 100])
    assert low <= 8 / 400 <= high


def test_run_lengths_and_burst_share():
    assert run_lengths([9, 1, 2, 3, 7]) == [3, 1, 1]
    assert burst_share([[1, 2, 3, 7]]) == pytest.approx(0.75)


def test_permutation_test_flags_bursts_but_not_scattered_errors():
    burst = [[list(range(start, start + 6)) for start in (20, 140, 260)]]
    _, _, p_burst = burstiness_permutation_test(burst[0], [300] * 3, permutations=500)
    scattered = [[10, 90, 170, 250], [40, 120, 200, 280], [5, 77, 160, 299]]
    _, _, p_scattered = burstiness_permutation_test(scattered, [300] * 3, permutations=500)
    assert p_burst < 0.01 and p_scattered > 0.5


def test_gilbert_elliott_fit_recovers_a_bursty_channel():
    truth = GilbertElliott(0.01, 0.2, (0.002,), (0.6,))
    rng = np.random.default_rng(3)
    sequences = [sample_errors(truth, 400, rng).tolist() for _ in range(40)]
    fitted = fit_gilbert_elliott(sequences)
    assert fitted.error_bad[0] == pytest.approx(0.6, abs=0.15)
    assert fitted.mean_bad_length == pytest.approx(5, rel=0.5)
    assert fitted.log_likelihood > memoryless_log_likelihood(sequences)[1]


def test_context_aware_fit_learns_which_symbols_a_bad_spell_damages():
    truth = GilbertElliott(0.02, 0.2, (0.001, 0.001), (0.05, 0.9))
    rng = np.random.default_rng(5)
    contexts, sequences = [], []
    for _ in range(40):
        bits = rng.integers(0, 2, 400).tolist()
        context = run_position_context(bits, long_run=2)
        contexts.append(context)
        sequences.append(sample_errors(truth, 400, rng, context).tolist())
    fitted = fit_gilbert_elliott(sequences, contexts)
    assert fitted.error_bad[1] > 0.6 > 0.25 > fitted.error_bad[0]


def test_run_position_context_marks_late_symbols_in_a_run():
    assert run_position_context([0, 0, 0, 0, 1, 0, 1, 1, 1]) == [0, 0, 1, 1, 0, 0, 0, 0, 1]
