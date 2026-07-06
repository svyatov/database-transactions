"""One test per scenario file, in path order — the Python mirror of tests/scenarios.test.ts.

Scenario files use kebab-case names (mirroring the TypeScript tree 1:1), so they are
loaded by path rather than imported as modules. Tests run serially — scenarios share
one database per dialect.
"""

import importlib.util
from pathlib import Path

import pytest

from harness.dialects import dialect_for
from harness.run import run_scenario

ROOT = Path(__file__).parent.parent / "scenarios"
FILES = sorted(ROOT.glob("**/*.py"))


def load(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem.replace("-", "_"), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.scenario


@pytest.mark.parametrize("path", FILES, ids=lambda p: str(p.relative_to(ROOT)).removesuffix(".py"))
def test_scenario(path: Path):
    s = load(path)
    run_scenario(s, dialect_for(str(path.relative_to(ROOT))))
