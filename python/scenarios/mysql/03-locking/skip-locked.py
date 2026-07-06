from harness import Scenario, eq


def run(s, t):
    A, B, C, D = s["A"], s["B"], s["C"], s["D"]
    # region demo
    t.note("Four workers run the exact same query at the same time.")
    A("BEGIN")
    [a] = A("SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")
    eq(a["id"], 1)

    B("BEGIN")
    [b] = B("SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")
    eq(b["id"], 2)  # job 1 is locked by A — skipped, no waiting

    C("BEGIN")
    [c] = C("SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")
    eq(c["id"], 3)

    t.note("Worker D finds the queue empty — an instant answer, not a wait.")
    none = D("SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")
    eq(len(none), 0)

    t.note("A worker crash (rollback) puts its job straight back on the queue.")
    A("ROLLBACK")
    [retry] = D("SELECT * FROM jobs ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")
    eq(retry["id"], 1)

    B("COMMIT")
    C("COMMIT")
    # endregion demo


scenario = Scenario(
    title="SKIP LOCKED: take what's free, skip what's taken",
    claim="SELECT ... FOR UPDATE SKIP LOCKED silently skips locked rows, so concurrent workers each grab a different row without ever waiting — the backbone of SQL job queues.",
    setup="""
        CREATE TABLE jobs (id int PRIMARY KEY, task varchar(50) NOT NULL);
        INSERT INTO jobs VALUES (1, 'send email'), (2, 'resize image'), (3, 'build report');
    """,
    sessions=("A", "B", "C", "D"),
    run=run,
)
