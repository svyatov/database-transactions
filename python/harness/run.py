"""The engine — a deliberately thin mirror of harness/run.ts.

No transcripts, no normalization: the TypeScript harness generates those. This runner
exists to prove the same claims hold when driven by Python drivers (psycopg, PyMySQL).
Concurrency comes from threads: a `.blocked` statement executes in a worker thread while
the main thread polls the database's lock-wait views until the wait is provably real.
"""

import time
from concurrent.futures import Future, ThreadPoolExecutor

from .dialects import Dialect
from .scenario import DbError, Scenario

BLOCK_DEADLINE_S = 10.0
POLL_S = 0.015


class Rows(list):
    """Rows of a statement, plus the affected-row count (cursor.rowcount)."""

    affected: int = 0


class Pending:
    """A statement fired with `.blocked` — still executing in a worker thread.
    Consume with `.success()` (must complete) or `.failure()` (must error)."""

    def __init__(self, session: str, sql: str, future: Future, dialect: Dialect, unconsumed: set):
        self.session, self.sql = session, sql
        self._future, self._dialect, self._unconsumed = future, dialect, unconsumed

    def success(self) -> Rows:
        self._unconsumed.discard(self)
        try:
            return self._future.result()
        except Exception as raw:
            e = self._dialect.to_error(raw)
            raise AssertionError(
                f"[{self.session}] blocked statement failed unexpectedly ({e.code}): {self.sql}\n{e}"
            ) from e

    def failure(self) -> DbError:
        self._unconsumed.discard(self)
        try:
            self._future.result()
        except Exception as raw:
            return self._dialect.to_error(raw)
        raise AssertionError(f"[{self.session}] expected blocked statement to fail, but it succeeded: {self.sql}")


class Session:
    """One named database session — a dedicated connection. Callable: `A("SQL")`."""

    def __init__(self, name: str, pid: int, conn, monitor, dialect: Dialect, executor, unconsumed: set):
        self._name, self.pid, self._conn = name, pid, conn
        self._monitor, self._dialect, self._executor, self._unconsumed = monitor, dialect, executor, unconsumed

    def _execute(self, sql: str) -> Rows:
        with self._conn.cursor() as cur:
            cur.execute(sql)
            rows = Rows(cur.fetchall() if cur.description else [])
            rows.affected = cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0
            return rows

    def __call__(self, sql: str) -> Rows:
        try:
            return self._execute(sql)
        except Exception as raw:
            e = self._dialect.to_error(raw)
            raise AssertionError(f"[{self._name}] unexpected error ({e.code}) on: {sql}\n{e}") from e

    def fails(self, sql: str) -> DbError:
        try:
            self._execute(sql)
        except Exception as raw:
            return self._dialect.to_error(raw)
        raise AssertionError(f"[{self._name}] expected an error, but statement succeeded: {sql}")

    def blocked(self, sql: str) -> Pending:
        future = self._executor.submit(self._execute, sql)
        deadline = time.monotonic() + BLOCK_DEADLINE_S
        while True:
            if future.done():
                state = "errored" if future.exception() else "completed"
                raise AssertionError(f"[{self._name}] expected to block, but statement {state}: {sql}")
            if self._dialect.is_blocked(self._monitor, self.pid):
                break
            if time.monotonic() > deadline:
                raise AssertionError(f"[{self._name}] statement never blocked within {BLOCK_DEADLINE_S}s: {sql}")
            time.sleep(POLL_S)
        pending = Pending(self._name, sql, future, self._dialect, self._unconsumed)
        self._unconsumed.add(pending)
        return pending


class Tools:
    def __init__(self, sessions: dict[str, Session], dialect: Dialect, monitor):
        self._sessions, self._dialect, self._monitor = sessions, dialect, monitor

    def note(self, _text: str) -> None:
        pass  # narration lives in the transcripts, which the TypeScript harness generates

    def pid(self, session: str) -> int:
        return self._sessions[session].pid

    def locked(self, session: str) -> None:
        """Wait until a session is provably back in a lock wait (requeue fence)."""
        deadline = time.monotonic() + BLOCK_DEADLINE_S
        while not self._dialect.is_blocked(self._monitor, self._sessions[session].pid):
            if time.monotonic() > deadline:
                raise AssertionError(f"[{session}] not in a lock wait within {BLOCK_DEADLINE_S}s")
            time.sleep(POLL_S)


def run_scenario(s: Scenario, dialect: Dialect) -> None:
    admin = dialect.connect()
    conns, pids = [], {}
    unconsumed: set[Pending] = set()
    executor = ThreadPoolExecutor(max_workers=len(s.sessions))
    try:
        dialect.reset(admin)
        with admin.cursor() as cur:
            cur.execute(s.setup)
            while cur.nextset():
                pass

        sessions: dict[str, Session] = {}
        for name in s.sessions:
            conn = dialect.connect()
            conns.append(conn)
            pids[name] = dialect.open_session(conn, name)
            sessions[name] = Session(name, pids[name], conn, admin, dialect, executor, unconsumed)

        s.run(sessions, Tools(sessions, dialect, admin))

        if unconsumed:
            left = "; ".join(f"[{p.session}] {p.sql}" for p in unconsumed)
            raise AssertionError(f"scenario ended with unresolved blocked statements: {left}")
    finally:
        # Cancel anything still running, unblocking worker threads, then close everything.
        try:
            canceller = dialect.connect()
            for pid in pids.values():
                dialect.cancel(canceller, pid)
            canceller.close()
        except Exception:
            pass
        executor.shutdown(wait=True, cancel_futures=True)
        for conn in conns:
            try:
                conn.close()
            except Exception:
                pass
        admin.close()
