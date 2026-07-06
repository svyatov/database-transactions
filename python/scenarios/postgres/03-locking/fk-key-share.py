from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("INSERT INTO orders VALUES (1, 1)")  # FK check locks customers row 1 FOR KEY SHARE

    t.note("FOR KEY SHARE doesn't mind non-key updates — B can change the balance.")
    B("UPDATE customers SET balance = 50 WHERE id = 1")

    t.note("But DELETE needs the strongest row lock (FOR UPDATE) — B has to wait.")
    del_ = B.blocked("DELETE FROM customers WHERE id = 1")

    A("COMMIT")

    t.note("A's order is now committed, so B's DELETE resumes — straight into the FK.")
    err = del_.failure()
    eq(err.code, "23503")  # foreign_key_violation

    [row] = B("SELECT balance FROM customers WHERE id = 1")
    eq(row["balance"], 50)  # the parent survived, with B's earlier non-key update intact
    # endregion demo


scenario = Scenario(
    title="Foreign keys take row locks for you",
    claim="INSERTing a child row locks the referenced parent row with FOR KEY SHARE: updating the parent's other columns still works, but deleting it blocks — and then fails the moment the child commits.",
    setup="""
        CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, balance int NOT NULL);
        CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL REFERENCES customers);
        INSERT INTO customers VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
