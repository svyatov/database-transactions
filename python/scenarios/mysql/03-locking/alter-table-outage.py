from harness import Scenario, eq


def run(s, t):
    A, B, C, M = s["A"], s["B"], s["C"], s["M"]
    # region demo
    t.note("A is any long-lived transaction that has touched the table — a report, a stuck job…")
    A("BEGIN")
    A("SELECT balance FROM accounts WHERE id = 1")

    t.note("The migration needs an exclusive metadata lock, so it waits for A. Expected. But now —")
    migration = B.blocked("ALTER TABLE accounts ADD COLUMN note varchar(50)")

    t.note("— every new query on the table queues behind the *waiting* ALTER. This is the outage.")
    read = C.blocked("SELECT balance FROM accounts WHERE id = 1")

    stuck = M("""
        SELECT state, info FROM performance_schema.processlist
        WHERE state = 'Waiting for table metadata lock' ORDER BY info""")
    eq(
        stuck,
        [
            {"state": "Waiting for table metadata lock", "info": "ALTER TABLE accounts ADD COLUMN note varchar(50)"},
            {"state": "Waiting for table metadata lock", "info": "SELECT balance FROM accounts WHERE id = 1"},
        ],
    )

    t.note("Only when A ends does the pile-up drain — migration first, then the reads.")
    A("COMMIT")
    migration.success()
    read.success()
    # endregion demo


scenario = Scenario(
    title="The classic migration outage, in four statements",
    claim="An ALTER TABLE queued behind one long transaction blocks every later query on that table — even plain SELECTs — because they must queue behind its exclusive metadata-lock request.",
    setup="""
        CREATE TABLE accounts (id int PRIMARY KEY, owner varchar(20) NOT NULL, balance int NOT NULL);
        INSERT INTO accounts VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B", "C", "M"),
    run=run,
)
