"""Loads a scenario from its canonical YAML form — a mirror of harness/loader.ts.

A step is a map whose one non-reserved key names the session (with an optional
`.fails` verb suffix); the value is the SQL. `expect` rows are subset-matched,
`${name.field}` in SQL refers to a `capture`d row, and `$pid(A)` in expected
values resolves to that session's backend id.
"""

import re
import time
from pathlib import Path

import yaml

from .run import Pending
from .scenario import Scenario, eq

RESERVED = {"note", "sleep", "locked", "success", "failure", "expect", "affected", "error", "comment", "capture", "blocks", "tl"}
REQUIRED = ("title", "claim", "setup", "sessions", "steps")
PID = re.compile(r"^\$pid\((\w+)\)$")
CAPTURE = re.compile(r"\$\{(\w+)\.(\w+)\}")


def load_scenario(path: Path) -> Scenario:
    doc = yaml.safe_load(path.read_text())
    for key in REQUIRED:
        if not doc.get(key):
            raise ValueError(f"{path}: missing {key!r}")

    def run(sessions, t):
        captures: dict[str, dict] = {}
        pendings: dict[str, Pending] = {}

        def finish(rows, step):
            if "expect" in step:
                match_rows(rows, step["expect"], t, captures)
            if "affected" in step:
                eq(rows.affected, step["affected"], "affected rows")
            if step.get("capture"):
                captures[step["capture"]] = rows[0] if rows else {}

        for step in doc["steps"]:
            if "note" in step:
                t.note(step["note"])
            elif "sleep" in step:
                time.sleep(step["sleep"] / 1000)
            elif "locked" in step:
                t.locked(step["locked"])
            elif "success" in step:
                finish(pendings.pop(step["success"]).success(), step)
            elif "failure" in step:
                check_code(pendings.pop(step["failure"]).failure().code, step["error"])
            else:
                keys = [k for k in step if k not in RESERVED]
                if len(keys) != 1:
                    raise ValueError(f"{path}: step must have exactly one session key, got {step!r}")
                name, _, verb = keys[0].partition(".")
                session = sessions[name]
                sql = CAPTURE.sub(lambda m: str(captures[m.group(1)][m.group(2)]), str(step[keys[0]]))
                if step.get("comment"):
                    sql = f"{sql} -- {step['comment']}"
                if verb == "fails":
                    check_code(session.fails(sql).code, step["error"])
                elif verb:
                    raise ValueError(f"{path}: unknown verb {verb!r} in step {step!r}")
                elif step.get("blocks"):
                    pendings[step["blocks"]] = session.blocked(sql)
                else:
                    finish(session(sql), step)

    return Scenario(
        title=doc["title"],
        claim=doc["claim"],
        setup=doc["setup"],
        sessions=tuple(doc["sessions"]),
        run=run,
    )


def check_code(code, want):
    """`error:` accepts one code or a list — a list means any of them proves the claim
    (drivers differ on connection kills: psycopg reports the server FATAL's SQLSTATE,
    Bun.sql only notices the closed socket)."""
    accepted = [str(w) for w in (want if isinstance(want, list) else [want])]
    if code not in accepted:
        raise AssertionError(f"error code: expected {' | '.join(accepted)}, got {code}")


def match_rows(actual, expected, t, captures):
    """Subset row matching: rows correspond 1:1, but only the listed fields are compared."""
    eq(len(actual), len(expected), f"expected {len(expected)} row(s), got {len(actual)}")
    for i, exp in enumerate(expected):
        act = {key: actual[i].get(key) for key in exp}
        want = {key: resolve(value, t, captures) for key, value in exp.items()}
        eq(act, want, f"row {i + 1}")


def resolve(value, t, captures):
    """`$pid(A)` → that session's backend id; `${name.field}` → a captured row's field."""
    if isinstance(value, str):
        if m := PID.match(value):
            return t.pid(m.group(1))
        if m := CAPTURE.fullmatch(value):
            return captures[m.group(1)][m.group(2)]
    return value
