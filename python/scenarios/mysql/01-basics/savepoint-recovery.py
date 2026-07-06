from harness import Scenario, eq


def run(s, t):
    A = s["A"]
    # region demo
    A("BEGIN")
    A("INSERT INTO items VALUES (2, 'gadget')")
    A("SAVEPOINT before_risky")

    t.note("The risky branch makes real progress before it fails…")
    A("INSERT INTO items VALUES (3, 'gizmo')")
    err = A.fails("INSERT INTO items VALUES (4, 'widget')")
    eq(err.code, "1062")  # ER_DUP_ENTRY

    t.note("The transaction is still alive — but the branch is half-done. Rewind all of it in one go.")
    A("ROLLBACK TO SAVEPOINT before_risky")
    A("INSERT INTO items VALUES (3, 'doohickey')")
    A("COMMIT")

    rows = A("SELECT id, name FROM items ORDER BY id")
    eq(
        rows,
        [
            {"id": 1, "name": "widget"},
            {"id": 2, "name": "gadget"},  # survived — it predates the savepoint
            {"id": 3, "name": "doohickey"},  # 'gizmo' is gone with the branch
        ],
    )
    # endregion demo


scenario = Scenario(
    title="Savepoints: discard a risky branch mid-transaction",
    claim="ROLLBACK TO SAVEPOINT discards only the work done after the savepoint — the rest of the transaction commits normally.",
    setup="""
        CREATE TABLE items (id int PRIMARY KEY, name varchar(50) NOT NULL UNIQUE);
        INSERT INTO items VALUES (1, 'widget');
    """,
    sessions=("A",),
    run=run,
)
