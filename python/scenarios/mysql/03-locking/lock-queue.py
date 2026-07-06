from harness import Scenario, eq


def run(s, t):
    A, B, C, M = s["A"], s["B"], s["C"], s["M"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = balance + 1 WHERE id = 1")

    second = B.blocked("UPDATE accounts SET balance = balance + 10 WHERE id = 1")

    t.note("A fourth session, M, can watch the wait live.")
    waits = M("SELECT waiting_pid, blocking_pid FROM sys.innodb_lock_waits")
    eq(waits, [{"waiting_pid": t.pid("B"), "blocking_pid": t.pid("A")}])

    third = C.blocked("UPDATE accounts SET balance = balance + 100 WHERE id = 1")

    t.note("A commits — the waiters drain. (InnoDB's CATS scheduler does not promise strict FIFO order, but every update lands.)")
    A("COMMIT")
    second.success()
    third.success()

    [final] = C("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 211)  # 100 + 1 + 10 + 100 — nothing was lost in the pile-up
    # endregion demo


scenario = Scenario(
    title="Waiters pile up — and sys.innodb_lock_waits shows who blocks whom",
    claim="Sessions waiting for the same row lock pile up behind the holder, visible live in sys.innodb_lock_waits — and every queued update lands once the holder commits.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'shared', 100);
    """,
    sessions=("A", "B", "C", "M"),
    run=run,
)
