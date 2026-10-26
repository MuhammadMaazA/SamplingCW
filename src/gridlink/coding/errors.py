"""Errors shared by decoders that can reject a damaged codeword."""


class UncorrectableError(ValueError):
    """The parity checks cannot identify a correctable single-bit error."""
