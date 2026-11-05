"""Two-state Gilbert-Elliott burst model, fitted to measured error sequences.

The channel is either Good (rare flips) or Bad (frequent flips) and switches state
between bits as a Markov chain. Parameters are fitted by Baum-Welch (EM) on the
per-trial error indicator sequences, so bursts are learned from the data, not assumed.

Optionally each bit carries a context class (for example "early" or "late" in a run of
identical symbols), and each state then has one error probability per class. This lets
the model separate *when* the channel is bad from *which symbols* a bad spell damages.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import log

import numpy as np


@dataclass(frozen=True)
class GilbertElliott:
    p_good_to_bad: float
    p_bad_to_good: float
    error_good: tuple[float, ...]
    error_bad: tuple[float, ...]
    log_likelihood: float = float("nan")

    @property
    def bad_fraction(self) -> float:
        """Stationary probability of the Bad state."""
        return self.p_good_to_bad / (self.p_good_to_bad + self.p_bad_to_good)

    @property
    def mean_bad_length(self) -> float:
        return 1 / self.p_bad_to_good

    @property
    def parameters(self) -> int:
        return 2 + len(self.error_good) + len(self.error_bad)


def _forward_backward(errors, contexts, transition, emission, start):
    rate = emission[:, contexts].T
    likelihood = np.where(errors[:, None] == 1, rate, 1 - rate)
    length = len(errors)
    alpha = np.empty((length, 2))
    scale = np.empty(length)
    alpha[0] = start * likelihood[0]
    scale[0] = alpha[0].sum()
    alpha[0] /= scale[0]
    for t in range(1, length):
        alpha[t] = (alpha[t - 1] @ transition) * likelihood[t]
        scale[t] = alpha[t].sum()
        alpha[t] /= scale[t]
    beta = np.ones((length, 2))
    for t in range(length - 2, -1, -1):
        beta[t] = transition @ (likelihood[t + 1] * beta[t + 1]) / scale[t + 1]
    gamma = alpha * beta
    gamma /= gamma.sum(axis=1, keepdims=True)
    step = alpha[:-1, :, None] * transition[None] * (likelihood[1:] * beta[1:])[:, None, :]
    xi = (step / step.sum(axis=(1, 2), keepdims=True)).sum(axis=0)
    return gamma, xi, float(np.log(scale).sum())


def fit_gilbert_elliott(
    sequences: list[list[int]],
    contexts: list[list[int]] | None = None,
    iterations: int = 300,
    tolerance: float = 1e-7,
) -> GilbertElliott:
    """Maximum-likelihood fit over independent trials, starting each trial at stationarity."""
    if contexts is None:
        contexts = [[0] * len(sequence) for sequence in sequences]
    data = [
        (np.asarray(sequence, dtype=int), np.asarray(context, dtype=int))
        for sequence, context in zip(sequences, contexts) if len(sequence) > 1
    ]
    if not data:
        raise ValueError("need at least one sequence longer than one bit")
    classes = 1 + max(int(context.max()) for _, context in data)
    transition = np.array([[0.99, 0.01], [0.2, 0.8]])
    emission = np.tile(np.array([[0.005], [0.5]]), (1, classes))
    previous = -np.inf
    for _ in range(iterations):
        pi = transition[0, 1] / (transition[0, 1] + transition[1, 0])
        start = np.array([1 - pi, pi])
        counts = np.zeros((2, 2))
        state_bits = np.zeros((2, classes))
        state_errors = np.zeros((2, classes))
        total = 0.0
        for errors, context in data:
            gamma, xi, log_likelihood = _forward_backward(
                errors, context, transition, emission, start
            )
            counts += xi
            for cls in range(classes):
                mask = context == cls
                state_bits[:, cls] += gamma[mask].sum(axis=0)
                state_errors[:, cls] += gamma[mask & (errors == 1)].sum(axis=0)
            total += log_likelihood
        transition = counts / counts.sum(axis=1, keepdims=True)
        transition = np.clip(transition, 1e-6, 1 - 1e-6)
        transition /= transition.sum(axis=1, keepdims=True)
        emission = np.clip(state_errors / np.maximum(state_bits, 1e-12), 1e-6, 1 - 1e-6)
        if emission[0].mean() > emission[1].mean():
            emission = emission[::-1].copy()
            transition = transition[::-1, ::-1].copy()
        if total - previous < tolerance:
            break
        previous = total
    return GilbertElliott(
        float(transition[0, 1]), float(transition[1, 0]),
        tuple(float(e) for e in emission[0]), tuple(float(e) for e in emission[1]), total,
    )


def memoryless_log_likelihood(sequences: list[list[int]]) -> tuple[float, float]:
    """Best binary-symmetric-channel fit, returning (flip probability, log-likelihood)."""
    errors = sum(sum(sequence) for sequence in sequences)
    bits = sum(len(sequence) for sequence in sequences)
    p = errors / bits
    if p in (0, 1):
        return p, 0.0
    return p, errors * log(p) + (bits - errors) * log(1 - p)


def bic(log_likelihood: float, parameters: int, observations: int) -> float:
    return -2 * log_likelihood + parameters * log(observations)


def sample_errors(
    model: GilbertElliott,
    length: int,
    rng: np.random.Generator,
    contexts: list[int] | None = None,
) -> np.ndarray:
    """Draw one error indicator sequence, starting in the stationary state distribution."""
    if contexts is None:
        contexts = [0] * length
    bad = rng.random() < model.bad_fraction
    switches = rng.random(length)
    flips = rng.random(length)
    errors = np.zeros(length, dtype=int)
    for index in range(length):
        rates = model.error_bad if bad else model.error_good
        errors[index] = flips[index] < rates[contexts[index]]
        bad = (switches[index] >= model.p_bad_to_good) if bad else (
            switches[index] < model.p_good_to_bad
        )
    return errors


def run_position_context(bits: list[int], long_run: int = 3) -> list[int]:
    """Context 1 for a symbol that is at least the ``long_run``-th identical one in a row."""
    contexts = []
    position = 0
    for index, bit in enumerate(bits):
        position = position + 1 if index and bit == bits[index - 1] else 1
        contexts.append(int(position >= long_run))
    return contexts
