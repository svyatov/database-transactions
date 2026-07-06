from harness import Scenario, eq


def run(s, t):
    A = s["A"]
    # region demo
    A("BEGIN")

    err = A.fails("SELECT 1 / 0")
    eq(err.code, "22012")  # division_by_zero

    t.note("The transaction is now aborted. Even a perfectly innocent statement is refused.")
    refused = A.fails("SELECT 1 AS innocent")
    eq(refused.code, "25P02")  # in_failed_sql_transaction

    t.note("ROLLBACK is the only way out. Afterwards, the session works normally again.")
    A("ROLLBACK")

    [row] = A("SELECT 1 AS innocent")
    eq(row["innocent"], 1)
    # endregion demo


scenario = Scenario(
    title="One error aborts the whole transaction",
    claim="After any error inside a transaction, PostgreSQL rejects every further statement with 25P02 until you ROLLBACK.",
    setup="""SELECT 1;""",
    sessions=("A",),
    run=run,
)
