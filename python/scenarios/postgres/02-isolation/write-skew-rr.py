from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("Hospital rule: at least one doctor must stay on call. Alice and Bob both want the night off.")
    A("BEGIN ISOLATION LEVEL REPEATABLE READ")
    B("BEGIN ISOLATION LEVEL REPEATABLE READ")

    [a] = A("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(a["on_call"], 2)  # "two of us — safe for me to leave"

    [b] = B("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(b["on_call"], 2)  # "two of us — safe for me to leave"

    t.note("Each updates a DIFFERENT row, so there is no write-write conflict to detect.")
    A("UPDATE doctors SET on_call = false WHERE name = 'alice'")
    B("UPDATE doctors SET on_call = false WHERE name = 'bob'")

    A("COMMIT")
    B("COMMIT")  # both succeed!

    [final] = A("SELECT count(*)::int AS on_call FROM doctors WHERE on_call")
    eq(final["on_call"], 0)  # nobody is on call — the invariant is broken

    t.note("Each transaction was internally consistent; together they broke the rule. Only SERIALIZABLE catches this.")
    # endregion demo


scenario = Scenario(
    title="Write skew: REPEATABLE READ is not enough",
    claim="Two REPEATABLE READ transactions can each validate an invariant against their snapshots, write to different rows, and both commit — leaving the invariant broken. This is write skew.",
    setup="""
        CREATE TABLE doctors (name text PRIMARY KEY, on_call boolean NOT NULL);
        INSERT INTO doctors VALUES ('alice', true), ('bob', true);
    """,
    sessions=("A", "B"),
    run=run,
)
