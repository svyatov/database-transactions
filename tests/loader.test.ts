import { expect, test } from "bun:test";
import { fromYaml } from "../harness/loader";

const base = {
  title: "t",
  claim: "c",
  setup: "CREATE TABLE t (id int)",
  sessions: ["A"],
  steps: [{ A: "SELECT 1" }],
};

const doc = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as any;

test("a scenario declaring neither field loads", () => {
  const s = fromYaml(doc({}), "x.yaml");
  expect(s.anomaly).toBeUndefined();
  expect(s.isolation).toBeUndefined();
});

test("both fields pass through", () => {
  const s = fromYaml(
    doc({ anomaly: "P4", steps: [{ A: "BEGIN ISOLATION LEVEL REPEATABLE READ" }], isolation: "REPEATABLE READ" }),
    "x.yaml",
  );
  expect(s.anomaly).toBe("P4");
  expect(s.isolation).toBe("REPEATABLE READ");
});

test("an off-enum anomaly is rejected, naming the file and the value", () => {
  expect(() => fromYaml(doc({ anomaly: "G7" }), "x.yaml")).toThrow(/x\.yaml.*G7/);
});

test("an isolation level the SQL never sets is rejected", () => {
  expect(() =>
    fromYaml(doc({ steps: [{ A: "BEGIN ISOLATION LEVEL SERIALIZABLE" }], isolation: "REPEATABLE READ" }), "pg.yaml"),
  ).toThrow(/SERIALIZABLE/);
  expect(() =>
    fromYaml(
      doc({ steps: [{ A: "SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE" }], isolation: "REPEATABLE READ" }),
      "my.yaml",
    ),
  ).toThrow(/SERIALIZABLE/);
});

test("a declared level cannot be faked by prose", () => {
  expect(() =>
    fromYaml(doc({ steps: [{ note: "BEGIN ISOLATION LEVEL SERIALIZABLE" }], isolation: "SERIALIZABLE" }), "x.yaml"),
  ).toThrow(/no level/);
});

test("a scenario that sets no level and declares none is not checked", () => {
  expect(() => fromYaml(doc({ anomaly: "G0" }), "x.yaml")).not.toThrow();
});
