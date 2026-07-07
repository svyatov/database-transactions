"""The API scenarios run against — a mirror of harness/scenario.ts.

A scenario opens one dedicated database connection per named session and interleaves
their statements in plain call order. Everything it claims, it asserts. The TypeScript
harness is the transcript generator; this harness re-verifies the same claims through
an independent pair of drivers (psycopg + PyMySQL).
"""

from dataclasses import dataclass
from typing import Callable


class DbError(Exception):
    """A database error. `code` is what that database's users grep for: the SQLSTATE on
    PostgreSQL (e.g. "40001"), the error number on MySQL (e.g. "1213")."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Scenario:
    title: str
    claim: str
    setup: str  # plain SQL, run once before the sessions open; may contain multiple statements
    sessions: tuple[str, ...]
    run: Callable  # (sessions: dict[str, Session], t: Tools) -> None


def eq(actual, expected, message: str | None = None) -> None:
    """Assert deep equality, mirroring eq() in the TypeScript harness."""
    if actual != expected:
        raise AssertionError(f"{message or 'assertion failed'}: expected {expected!r}, got {actual!r}")
