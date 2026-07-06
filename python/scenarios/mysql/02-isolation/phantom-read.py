from harness import Scenario, eq


def run(s, t):
    A, B = s["A"], s["B"]
    # region demo
    t.note("A computes a report twice inside one transaction: count first, then the total.")
    A("SET TRANSACTION ISOLATION LEVEL READ COMMITTED")
    A("BEGIN")

    [count] = A("SELECT count(*) AS n FROM orders WHERE amount >= 100")
    eq(count["n"], 2)

    t.note("Between A's two statements, B commits a new order that matches A's WHERE clause.")
    B("INSERT INTO orders VALUES (3, 700)")

    [total] = A("SELECT count(*) AS n, CAST(sum(amount) AS SIGNED) AS total FROM orders WHERE amount >= 100")
    eq(total["n"], 3)  # a third row appeared out of nowhere — a phantom
    eq(total["total"], 1500)

    A("COMMIT")
    t.note("A's report now says '2 orders' in one place and '3 orders, total 1500' in another.")
    # endregion demo


scenario = Scenario(
    title="Phantom read under READ COMMITTED",
    claim="At READ COMMITTED, re-running the same range query inside one transaction can return rows that weren't there before — phantoms.",
    setup="""
        CREATE TABLE orders (id int PRIMARY KEY, amount int NOT NULL);
        INSERT INTO orders VALUES (1, 500), (2, 300);
    """,
    sessions=("A", "B"),
    run=run,
)
