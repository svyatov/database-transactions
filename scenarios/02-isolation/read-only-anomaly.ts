import { scenario, eq } from "../../harness/scenario";

export default scenario({
  title: "The read-only anomaly (and how SERIALIZABLE stops it)",
  claim:
    "At REPEATABLE READ, even a read-only transaction can observe a state no serial execution could produce; at SERIALIZABLE, PostgreSQL aborts the offending writer instead (SQLSTATE 40001).",
  setup: `
    CREATE TABLE control  (deposit_no int NOT NULL);
    CREATE TABLE receipts (receipt_no int PRIMARY KEY, deposit_no int NOT NULL, amount int NOT NULL);
    INSERT INTO control  VALUES (1);
    INSERT INTO receipts VALUES (1, 1, 100), (2, 1, 200);
  `,
  sessions: ["Cashier", "Closer", "Report"],

  async run({ Cashier, Closer, Report }, t) {
    // #region rr
    t.note(
      "A bank tracks receipts per deposit batch. The cashier files a receipt into the current batch (1) — slowly.",
    );
    await Cashier`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [batch] = await Cashier`SELECT deposit_no FROM control`;
    eq(batch!.deposit_no, 1);
    await Cashier`INSERT INTO receipts VALUES (3, 1, 400)`;

    t.note("Meanwhile the closer moves the bank to batch 2 — from now on, batch 1 is supposedly complete.");
    await Closer`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    await Closer`UPDATE control SET deposit_no = 2`;
    await Closer`COMMIT`;

    t.note("An auditor prints the report for the closed batch 1.");
    await Report`BEGIN ISOLATION LEVEL REPEATABLE READ`;
    const [current] = await Report`SELECT deposit_no FROM control`;
    eq(current!.deposit_no, 2); // batch 1 is closed…
    const printed = await Report`SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no`;
    eq(printed.length, 2); // …and contains receipts 1 and 2, total 300. The report is published.
    await Report`COMMIT`;

    t.note("Now the cashier's receipt lands — in batch 1, which the report just declared final.");
    await Cashier`COMMIT`;

    const actual = await Report`SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no`;
    eq(actual.length, 3); // the published report was wrong: no serial order of these three transactions produces it
    // #endregion

    // #region serializable
    t.note("Rewind and replay the exact same interleaving — all three transactions SERIALIZABLE.");
    await Report`DELETE FROM receipts WHERE receipt_no = 3`;
    await Report`UPDATE control SET deposit_no = 1`;

    await Cashier`BEGIN ISOLATION LEVEL SERIALIZABLE`;
    await Cashier`SELECT deposit_no FROM control`;
    await Cashier`INSERT INTO receipts VALUES (3, 1, 400)`;

    await Closer`BEGIN ISOLATION LEVEL SERIALIZABLE`;
    await Closer`UPDATE control SET deposit_no = 2`;
    await Closer`COMMIT`;

    await Report`BEGIN ISOLATION LEVEL SERIALIZABLE`;
    await Report`SELECT deposit_no FROM control`;
    const printedSafe = await Report`SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no`;
    eq(printedSafe.length, 2);
    await Report`COMMIT`; // the report itself commits fine —

    t.note(
      "— because SERIALIZABLE protects it by aborting the transaction that would invalidate it: the cashier.",
    );
    const err = await Cashier.fails`COMMIT`;
    eq(err.code, "40001");

    const safe = await Report`SELECT receipt_no, amount FROM receipts WHERE deposit_no = 1 ORDER BY receipt_no`;
    eq(safe.length, 2); // batch 1 still matches the published report; the cashier retries into batch 2
    // #endregion
  },
});
