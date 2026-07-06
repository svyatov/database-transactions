from harness import Scenario, eq


def run(s, t):
    A, B, C = s["A"], s["B"], s["C"]
    # region demo
    A("BEGIN")
    A("SELECT balance FROM accounts WHERE id = 1")  # the same long transaction as before

    t.note("Same migration — but this time it gives up after a second instead of camping in the queue.")
    B("SET SESSION lock_wait_timeout = 1")
    err = B.fails("ALTER TABLE accounts ADD COLUMN note varchar(50)")
    eq(err.code, "1205")  # ER_LOCK_WAIT_TIMEOUT

    t.note("No waiting ALTER in the queue means no outage: C's read is instant.")
    [row] = C("SELECT balance FROM accounts WHERE id = 1")
    eq(row["balance"], 100)

    A("COMMIT")
    t.note("Retry the migration when it can actually get the lock — now it sails through.")
    B("ALTER TABLE accounts ADD COLUMN note varchar(50)")
    # endregion demo


scenario = Scenario(
    title="The fix: run DDL with a lock_wait_timeout",
    claim="With lock_wait_timeout set, a migration that can't get its metadata lock fails fast (errno 1205) instead of queueing — and other sessions' queries are never blocked behind it.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B", "C"),
    run=run,
)
