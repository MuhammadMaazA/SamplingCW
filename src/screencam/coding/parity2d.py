"""Even row/column parity: 16 data bits in a 4x4 grid become a 5x5 codeword."""

from .errors import UncorrectableError

DATA_BITS = 16
WORD_BITS = 25


def encode(bits: list[int]) -> list[int]:
    if len(bits) % DATA_BITS or any(bit not in (0, 1) for bit in bits):
        raise ValueError("2D parity input needs complete 16-bit binary blocks")
    output = []
    for start in range(0, len(bits), DATA_BITS):
        rows = [bits[start + row * 4 : start + (row + 1) * 4] for row in range(4)]
        for row in rows:
            row.append(sum(row) % 2)
        # Include the row-parity column so the bottom-right bit is protected too.
        rows.append([sum(row[column] for row in rows) % 2 for column in range(5)])
        output.extend(bit for row in rows for bit in row)
    return output


def decode(bits: list[int]) -> tuple[list[int], int]:
    if len(bits) % WORD_BITS or any(bit not in (0, 1) for bit in bits):
        raise ValueError("2D parity stream needs complete 25-bit binary codewords")
    output = []
    corrected = 0
    for start in range(0, len(bits), WORD_BITS):
        rows = [bits[start + row * 5 : start + (row + 1) * 5] for row in range(5)]
        bad_rows = [row for row in range(5) if sum(rows[row]) % 2]
        bad_columns = [column for column in range(5)
                       if sum(row[column] for row in rows) % 2]
        if len(bad_rows) == len(bad_columns) == 1:
            rows[bad_rows[0]][bad_columns[0]] ^= 1
            corrected += 1
        elif bad_rows or bad_columns:
            raise UncorrectableError(f"uncorrectable codeword at index {start // WORD_BITS}")
        output.extend(bit for row in rows[:4] for bit in row[:4])
    return output, corrected
