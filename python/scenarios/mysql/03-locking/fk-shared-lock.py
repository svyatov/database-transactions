from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    A("BEGIN")
    A("INSERT INTO orders VALUES (1, 1)")  # FK check takes an S lock on customers row 1

    t.note("InnoDB has no key-share granularity: B's harmless balance update needs an X lock and waits.")
    upd = B.blocked("UPDATE customers SET balance = 50 WHERE id = 1")

    A("COMMIT")
    upd.success()

    t.note("With the order committed, deleting the parent doesn't block — it fails on the spot.")
    err = B.fails("DELETE FROM customers WHERE id = 1")
    eq(err.code, "1451")  # ER_ROW_IS_REFERENCED_2

    [row] = B("SELECT balance FROM customers WHERE id = 1")
    eq(row["balance"], 50)  # the parent survived, with B's update applied after the wait
    # endregion demo


scenario = Scenario(
    title="Foreign keys take row locks for you — big ones",
    claim="INSERTing a child row locks the referenced parent row with a plain shared lock: even a non-key UPDATE of the parent blocks until the child commits (PostgreSQL's FOR KEY SHARE would allow it), and deleting a referenced parent fails outright.",
    setup="""
        CREATE TABLE customers (id int PRIMARY KEY, name varchar(20) NOT NULL, balance int NOT NULL);
        -- Beware: MySQL silently IGNORES inline "REFERENCES" on a column — the constraint
        -- must be declared at table level or there is no foreign key at all.
        CREATE TABLE orders (
          id          int PRIMARY KEY,
          customer_id int NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers (id)
        );
        INSERT INTO customers VALUES (1, 'alice', 100);
    """,
    sessions=("A", "B"),
    run=run,
)
