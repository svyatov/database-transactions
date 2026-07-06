from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Same story, same statements, same order — only the isolation level differs.")
    A("BEGIN ISOLATION LEVEL SERIALIZABLE")
    B("BEGIN ISOLATION LEVEL SERIALIZABLE")

    [a] = A("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(a["on_call"], 2)

    [b] = B("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(b["on_call"], 2)

    A("UPDATE doctors SET on_call = false WHERE name = 'alice'")
    B("UPDATE doctors SET on_call = false WHERE name = 'bob'")

    t.note("The first committer wins. The second cannot be serialized against it and is aborted.")
    A("COMMIT")

    err = B.fails("COMMIT")
    eq(err.code, "40001")  # serialization_failure

    [final] = A("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(final["on_call"], 1)  # the invariant survived

    t.note("B's job is to retry. On retry it would see only one doctor on call — and refuse the night off.")
    # endregion demo


scenario = Scenario(
    title="SERIALIZABLE catches write skew",
    claim="The exact interleaving that breaks the invariant under REPEATABLE READ fails with SQLSTATE 40001 under SERIALIZABLE — one transaction commits, the other must retry.",
    setup="""
        CREATE TABLE doctors (name text PRIMARY KEY, on_call boolean NOT NULL);
        INSERT INTO doctors VALUES ('alice', true), ('bob', true);
    """,
    sessions=("A", "B"),
    run=run,
)
