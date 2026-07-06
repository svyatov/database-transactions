from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Same story, same statements, same order — only the isolation level differs.")
    A("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
    B("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")
    A("BEGIN")
    B("BEGIN")

    [a] = A("SELECT count(*) AS on_call FROM doctors WHERE on_call")
    eq(a["on_call"], 2)

    [b] = B("SELECT count(*) AS on_call FROM doctors WHERE on_call")
    eq(b["on_call"], 2)

    t.note("Those SELECTs took shared locks on the rows they read. A's write now waits for B…")
    pending = A.blocked("UPDATE doctors SET on_call = false WHERE name = 'alice'")

    t.note("…and B's write closes the cycle. InnoDB detects the deadlock and rolls B back entirely.")
    err = B.fails("UPDATE doctors SET on_call = false WHERE name = 'bob'")
    eq(err.code, "1213")  # ER_LOCK_DEADLOCK

    pending.success()  # B's rollback freed the locks; A's update proceeds
    A("COMMIT")

    [final] = A("SELECT count(*) AS on_call FROM doctors WHERE on_call")
    eq(final["on_call"], 1)  # the invariant survived

    t.note("PostgreSQL detects the same skew without blocking (SSI, at COMMIT). MySQL prevents it the classic way: locks and a deadlock victim.")
    # endregion demo


scenario = Scenario(
    title="SERIALIZABLE catches write skew — with locks",
    claim="Under MySQL's SERIALIZABLE, plain SELECTs take shared locks, so the write-skew interleaving deadlocks: one transaction is rolled back with errno 1213, and the invariant survives.",
    setup="""
        CREATE TABLE doctors (name varchar(20) PRIMARY KEY, on_call boolean NOT NULL);
        INSERT INTO doctors VALUES ('alice', true), ('bob', true);
    """,
    sessions=("A", "B"),
    run=run,
)
