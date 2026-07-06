from harness import Scenario, eq


def run(s, t):
    A = s["A"]
    # region demo
    A("BEGIN")
    A("INSERT INTO steps VALUES (1)")
    A("SAVEPOINT outer_sp")
    A("INSERT INTO steps VALUES (2)")
    A("SAVEPOINT inner_sp")
    A("INSERT INTO steps VALUES (3)")

    t.note("Rolling back to the OUTER savepoint discards rows 2 and 3 — and inner_sp itself.")
    A("ROLLBACK TO SAVEPOINT outer_sp")

    gone = A.fails("ROLLBACK TO SAVEPOINT inner_sp")
    eq(gone.code, "1305")  # SAVEPOINT inner_sp does not exist — destroyed by the outer rollback

    t.note("RELEASE keeps the work done after the savepoint, but you can no longer rewind to it.")
    A("INSERT INTO steps VALUES (4)")
    A("RELEASE SAVEPOINT outer_sp")
    A("COMMIT")

    rows = A("SELECT n FROM steps ORDER BY n")
    eq(rows, [{"n": 1}, {"n": 4}])
    # endregion demo


scenario = Scenario(
    title="Nested savepoints and RELEASE",
    claim="Rolling back to an outer savepoint discards inner savepoints along with their work; RELEASE keeps the changes but forfeits the rollback point.",
    setup="""CREATE TABLE steps (n int PRIMARY KEY);""",
    sessions=("A",),
    run=run,
)
