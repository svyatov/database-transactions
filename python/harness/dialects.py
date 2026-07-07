"""Everything database-specific, side by side — a mirror of harness/dialect.ts.

Both drivers are sync (concurrency for `.blocked` comes from threads in run.py):
psycopg 3 for PostgreSQL, PyMySQL for MySQL.
"""

import os
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlparse

import psycopg
import pymysql
import pymysql.cursors
from psycopg.rows import dict_row
from psycopg.types.numeric import IntLoader

from .scenario import DbError

# xid columns (xmin, xmax, …) decode as int, matching Bun.sql — scenario expectations
# would otherwise compare a YAML number against psycopg's string. OID 28 = pg_catalog.xid.
psycopg.adapters.register_loader(28, IntLoader)


@dataclass(frozen=True)
class Dialect:
    name: str
    connect: Callable[[], Any]  # a fresh autocommit connection with dict rows
    reset: Callable[[Any], None]  # wipe everything a previous scenario left behind
    open_session: Callable[[Any, str], int]  # name the session, return its backend id
    is_blocked: Callable[[Any, int], bool]  # the signal behind `.blocked`
    cancel: Callable[[Any, int], None]  # cancel the backend's running statement
    to_error: Callable[[Exception], DbError]  # put the assertable value in .code


# --- PostgreSQL -----------------------------------------------------------------

def _pg_connect():
    url = os.environ.get("DATABASE_URL", "postgres://postgres:postgres@localhost:54321/postgres")
    return psycopg.connect(url, autocommit=True, row_factory=dict_row)


def _pg_reset(admin) -> None:
    with admin.cursor() as cur:
        cur.execute("SELECT gid FROM pg_prepared_xacts")
        for row in cur.fetchall():
            gid = str(row["gid"]).replace("'", "''")
            cur.execute(f"ROLLBACK PREPARED '{gid}'")
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")


def _pg_open_session(conn, name: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('application_name', %s, false), pg_backend_pid() AS pid", (name,))
        return cur.fetchone()["pid"]


def _pg_is_blocked(monitor, pid: int) -> bool:
    with monitor.cursor() as cur:
        cur.execute("SELECT wait_event_type FROM pg_stat_activity WHERE pid = %s", (pid,))
        row = cur.fetchone()
        return row is not None and row["wait_event_type"] == "Lock"


def _pg_cancel(admin, pid: int) -> None:
    with admin.cursor() as cur:
        cur.execute("SELECT pg_cancel_backend(%s)", (pid,))


def _pg_to_error(e: Exception) -> DbError:
    if isinstance(e, psycopg.Error) and e.sqlstate:
        return DbError(e.sqlstate, str(e))
    raise e


postgres = Dialect("postgres", _pg_connect, _pg_reset, _pg_open_session, _pg_is_blocked, _pg_cancel, _pg_to_error)


# --- MySQL ----------------------------------------------------------------------

def _my_connect():
    url = urlparse(os.environ.get("MYSQL_URL", "mysql://root:mysql@localhost:33061/app"))
    return pymysql.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=url.username,
        password=url.password or "",
        database=url.path.lstrip("/"),
        autocommit=True,
        cursorclass=pymysql.cursors.DictCursor,
        client_flag=pymysql.constants.CLIENT.MULTI_STATEMENTS,
    )


def _my_reset(admin) -> None:
    with admin.cursor() as cur:
        # Orphaned XA transactions survive their session AND the drop — roll them
        # back first, or DROP DATABASE blocks on their row locks.
        cur.execute("XA RECOVER")
        for row in cur.fetchall():
            data = row["data"]
            gid = (data.decode() if isinstance(data, (bytes, bytearray)) else str(data)).replace("'", "''")
            cur.execute(f"XA ROLLBACK '{gid}'")
        cur.execute("DROP DATABASE IF EXISTS app; CREATE DATABASE app; USE app;")
        while cur.nextset():
            pass


def _my_open_session(conn, name: str) -> int:
    # No application_name equivalent — @session_name makes the session findable via
    # performance_schema.user_variables_by_thread (deterministic KILLs and monitoring).
    with conn.cursor() as cur:
        cur.execute("SET @session_name = '%s'" % name.replace("'", "''"))
        cur.execute("SELECT CONNECTION_ID() AS pid")
        return cur.fetchone()["pid"]


def _my_is_blocked(monitor, pid: int) -> bool:
    # Row-lock waits from performance_schema.data_locks (live engine state); DDL blocked
    # on a metadata lock only in processlist. Never poll information_schema.innodb_trx
    # for this: its cache refreshes only after 100ms of idle time — polling it faster
    # than that reads stale data forever.
    with monitor.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM performance_schema.data_locks dl
              JOIN performance_schema.threads th ON th.thread_id = dl.thread_id
              WHERE th.processlist_id = %s AND dl.lock_status = 'WAITING'
            UNION ALL
            SELECT 1 FROM performance_schema.processlist
              WHERE id = %s AND state LIKE 'Waiting for%%lock'
            """,
            (pid, pid),
        )
        return cur.fetchone() is not None


def _my_cancel(admin, pid: int) -> None:
    with admin.cursor() as cur:
        cur.execute(f"KILL QUERY {int(pid)}")


def _my_to_error(e: Exception) -> DbError:
    if isinstance(e, pymysql.MySQLError) and e.args and isinstance(e.args[0], int):
        return DbError(str(e.args[0]), str(e.args[1]) if len(e.args) > 1 else str(e))
    raise e


mysql = Dialect("mysql", _my_connect, _my_reset, _my_open_session, _my_is_blocked, _my_cancel, _my_to_error)


def dialect_for(path: str) -> Dialect:
    """Scenario paths are namespaced by database: scenarios/<db>/<chapter>/<name>.py."""
    return mysql if path.startswith("mysql/") else postgres
