from harness import Scenario, eq


def run(s, t):
    A, B, C, M = s["A"], s["B"], s["C"], s["M"]
    # region demo
    A("BEGIN")
    A("UPDATE accounts SET balance = balance + 1 WHERE id = 1")

    B("BEGIN")
    second = B.blocked("UPDATE accounts SET balance = balance + 10 WHERE id = 1")
    third = C.blocked("UPDATE accounts SET balance = balance + 100 WHERE id = 1")

    t.note("A fourth session, M, can watch the pile-up in pg_stat_activity.")
    before = M("""
        SELECT application_name AS waiting, pg_blocking_pids(pid) AS blocked_by
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
        ORDER BY application_name""")
    eq([r["waiting"] for r in before], ["B", "C"])

    t.note("A commits. The lock goes to B — the head of the queue — not to C.")
    A("COMMIT")
    second.success()
    t.locked("C")  # C wakes to requeue behind B; wait until it's provably waiting again

    after = M("""
        SELECT application_name AS waiting, pg_blocking_pids(pid) AS blocked_by
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
        ORDER BY application_name""")
    eq([r["waiting"] for r in after], ["C"])  # C is still in line, now behind B

    B("COMMIT")
    third.success()

    [final] = C("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 211)  # 100 + 1 + 10 + 100 — every update landed, in queue order
    # endregion demo


scenario = Scenario(
    title="Waiters form a queue — first come, first locked",
    claim="Sessions waiting for the same row lock queue up: when the holder commits, the lock goes to the first waiter, and everyone else keeps waiting behind it.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner text NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'shared', 100);
    """,
    sessions=("A", "B", "C", "M"),
    run=run,
)
