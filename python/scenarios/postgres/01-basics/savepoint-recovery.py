from harness import Scenario, eq


def run(s, t):
    A = s["A"]
    # region demo
    A("BEGIN")
    A("INSERT INTO items VALUES (2, 'gadget')")
    A("SAVEPOINT before_risky")

    err = A.fails("INSERT INTO items VALUES (3, 'widget')")
    eq(err.code, "23505")  # unique_violation — the transaction is aborted

    t.note("Without the savepoint this transaction would be doomed. With it, we rewind past the failure and carry on.")
    A("ROLLBACK TO SAVEPOINT before_risky")
    A("INSERT INTO items VALUES (3, 'doohickey')")
    A("COMMIT")

    rows = A("SELECT id, name FROM items ORDER BY id")
    eq(
        rows,
        [
            {"id": 1, "name": "widget"},
            {"id": 2, "name": "gadget"},  # survived — it predates the savepoint
            {"id": 3, "name": "doohickey"},
        ],
    )
    # endregion demo


scenario = Scenario(
    title="Savepoints: recover from errors mid-transaction",
    claim="ROLLBACK TO SAVEPOINT un-aborts a failed transaction, discarding only the work done after the savepoint — the rest commits normally.",
    setup="""
        CREATE TABLE items (id int PRIMARY KEY, name text NOT NULL UNIQUE);
        INSERT INTO items VALUES (1, 'widget');
    """,
    sessions=("A",),
    run=run,
)
