from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("UPDATE items SET value = value * 2 WHERE id = 1")  # row 1: 10 → 20, uncommitted

    t.note("B targets WHERE value = 10. The latest committed version of row 1 still qualifies — but it's locked by A, so B waits.")
    B("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
    B("BEGIN")
    pending = B.blocked("UPDATE items SET value = 99 WHERE value = 10")

    t.note("A commits. B wakes up and re-checks the row it waited for — against the NEW version, where value is 20.")
    A("COMMIT")

    result = pending.success()
    eq(result.affected, 0)  # 0 rows affected — the row slipped away
    B("COMMIT")

    rows = B("SELECT id, value FROM items ORDER BY id")
    eq(
        rows,
        [
            {"id": 1, "value": 20},
            {"id": 2, "value": 30},
        ],
    )
    # endregion demo


scenario = Scenario(
    title="READ COMMITTED re-checks WHERE after waiting",
    claim="An UPDATE at READ COMMITTED that waited for a lock re-evaluates its WHERE clause against the new row version — rows that no longer match are silently skipped.",
    setup="""
        CREATE TABLE items (id int PRIMARY KEY, value int NOT NULL);
        INSERT INTO items VALUES (1, 10), (2, 30);
    """,
    sessions=("A", "B"),
    run=run,
)
