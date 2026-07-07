"""One test per scenario file, in path order — the Python mirror of tests/scenarios.test.ts.

The canonical YAML scenarios at the repo root are the single source of truth; this
suite re-verifies the same claims through a second pair of drivers (psycopg, PyMySQL).
Tests run
serially — scenarios share one database per dialect.
"""

from pathlib import Path

import pytest

from harness.dialects import dialect_for
from harness.loader import load_scenario
from harness.run import run_scenario

ROOT = Path(__file__).parent.parent.parent / "scenarios"
FILES = sorted(ROOT.glob("**/*.yaml"))


@pytest.mark.parametrize("path", FILES, ids=lambda p: str(p.relative_to(ROOT)).removesuffix(".yaml"))
def test_scenario(path: Path):
    run_scenario(load_scenario(path), dialect_for(str(path.relative_to(ROOT))))
