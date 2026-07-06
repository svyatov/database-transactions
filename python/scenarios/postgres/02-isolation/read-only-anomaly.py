from harness import Scenario, eq


def run(s, t):
    Cashier, Closer, Report = s["Cashier"], s["Closer"], s["Report"]
    # region rr
    t.note("A bank tracks receipts per deposit batch. The cashier files a receipt into the current batch (1) — slowly.")
    Cashier("BEGIN ISOLATION LEVEL REPEATABLE READ")
    [batch] = Cashier("SELECT deposit_no FROM control")
    eq(batch["deposit_no"], 1)
    Cashier("INSERT INTO receipts VALUES (3, 1, 400)")

    t.note("Meanwhile the closer moves the bank to batch 2 — from now on, batch 1 is supposedly complete.")
    Closer("BEGIN ISOLATION LEVEL REPEATABLE READ")
    Closer("UPDATE control SET deposit_no = 2")
    Closer("COMMIT")

    t.note("An auditor prints the report for the closed batch 1.")
    Report("BEGIN ISOLATION LEVEL REPEATABLE READ")
    [current] = Report("SELECT deposit_no FROM control")
    eq(current["deposit_no"], 2)  # batch 1 is closed…
    printed = Report("SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no")
    eq(len(printed), 2)  # …and contains receipts 1 and 2, total 300. The report is published.
    Report("COMMIT")

    t.note("Now the cashier's receipt lands — in batch 1, which the report just declared final.")
    Cashier("COMMIT")

    actual = Report("SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no")
    eq(len(actual), 3)  # the published report was wrong: no serial order of these three transactions produces it
    # endregion rr

    # region serializable
    t.note("Rewind and replay the exact same interleaving — all three transactions SERIALIZABLE.")
    Report("DELETE FROM receipts WHERE receipt_no = 3")
    Report("UPDATE control SET deposit_no = 1")

    Cashier("BEGIN ISOLATION LEVEL SERIALIZABLE")
    Cashier("SELECT deposit_no FROM control")
    Cashier("INSERT INTO receipts VALUES (3, 1, 400)")

    Closer("BEGIN ISOLATION LEVEL SERIALIZABLE")
    Closer("UPDATE control SET deposit_no = 2")
    Closer("COMMIT")

    Report("BEGIN ISOLATION LEVEL SERIALIZABLE")
    Report("SELECT deposit_no FROM control")
    printed_safe = Report("SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no")
    eq(len(printed_safe), 2)
    Report("COMMIT")  # the report itself commits fine —

    t.note("— because SERIALIZABLE protects it by aborting the transaction that would invalidate it: the cashier.")
    err = Cashier.fails("COMMIT")
    eq(err.code, "40001")

    safe = Report("SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no")
    eq(len(safe), 2)  # batch 1 still matches the published report; the cashier retries into batch 2
    # endregion serializable


scenario = Scenario(
    title="The read-only anomaly (and how SERIALIZABLE stops it)",
    claim="At REPEATABLE READ, even a read-only transaction can observe a state no serial execution could produce; at SERIALIZABLE, PostgreSQL aborts the offending writer instead (SQLSTATE 40001).",
    setup="""
        CREATE TABLE control  (deposit_no int NOT NULL);
        CREATE TABLE receipts (receipt_no int PRIMARY KEY, deposit_no int NOT NULL, amount int NOT NULL);
        INSERT INTO control  VALUES (1);
        INSERT INTO receipts VALUES (1, 1, 100), (2, 1, 200);
    """,
    sessions=("Cashier", "Closer", "Report"),
    run=run,
)
