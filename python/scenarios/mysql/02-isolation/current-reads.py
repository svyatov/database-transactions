from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region committed
    A("BEGIN")
    [snap] = A("SELECT balance FROM accounts WHERE id = 1")  # snapshot taken
    eq(snap["balance"], 100)

    t.note("B commits a change. A keeps READING its stale snapshot…")
    B("UPDATE accounts SET balance = 150 WHERE id = 1")

    [stale] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(stale["balance"], 100)

    t.note("…but A's UPDATE is a current read: it computes from B's committed 150, not from the snapshot's 100.")
    A("UPDATE accounts SET balance = balance + 50 WHERE id = 1")

    [after] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(after["balance"], 200)  # 150 + 50 — and now A sees it: the snapshot has a hole

    A("COMMIT")
    t.note("PostgreSQL would have aborted A's UPDATE with 40001 instead. MySQL quietly switches world views.")
    # endregion committed

    # region uncommitted
    t.note("If the competing write is NOT yet committed, A first waits on the row lock…")
    A("BEGIN")
    A("SELECT balance FROM accounts WHERE id = 1")  # snapshot taken

    B("BEGIN")
    B("UPDATE accounts SET balance = 300 WHERE id = 1")

    pending = A.blocked("UPDATE accounts SET balance = balance + 50 WHERE id = 1")

    t.note("…and proceeds from B's value the moment B commits. No error here either.")
    B("COMMIT")

    pending.success()
    [final] = A("SELECT balance FROM accounts WHERE id = 1")
    eq(final["balance"], 350)  # 300 + 50
    A("COMMIT")
    # endregion uncommitted


scenario = Scenario(
    title="Current reads punch holes in the snapshot",
    claim="A REPEATABLE READ transaction's UPDATE operates on the CURRENT committed row, not on its snapshot — and afterwards the transaction sees its own write, so the 'repeatable' read changes.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
