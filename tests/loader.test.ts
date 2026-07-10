import { expect, test } from "bun:test";
import { fromYaml, loadScenario } from "../harness/loader";

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

/** A code scenario declares through the same fields, and its SQL lives in backticks. */
const tsScenario = (meta: string, body: string) => `
  import { scenario } from "../harness/scenario";
  export default scenario({
    title: "t", claim: "c", setup: \`CREATE TABLE t (id int)\`, sessions: ["A"], ${meta}
    async run({ A }: any) { ${body} },
  });
`;

async function loadTs(name: string, source: string) {
  const path = `${import.meta.dir}/.tmp-${name}.ts`;
  await Bun.write(path, source);
  try {
    return await loadScenario(path);
  } finally {
    await Bun.file(path).unlink();
  }
}

test("a code scenario's declared level is checked against the SQL in its backticks", async () => {
  const s = await loadTs(
    "ok",
    tsScenario('anomaly: "P4", isolation: "REPEATABLE READ",', "await A`BEGIN ISOLATION LEVEL REPEATABLE READ`;"),
  );
  expect(s.isolation).toBe("REPEATABLE READ");
});

test("a comment in a code scenario cannot satisfy the isolation check", async () => {
  const promise = loadTs(
    "prose",
    tsScenario('isolation: "SERIALIZABLE",', "// BEGIN ISOLATION LEVEL SERIALIZABLE\n await A`BEGIN`;"),
  );
  await expect(promise).rejects.toThrow(/no level/);
});

// The prose that can fake a claim is whatever the narrowing lets through, not whatever
// prose looked like the day it was written. Each of these once satisfied the check.
test.each([
  ["a backticked line comment", "// `BEGIN ISOLATION LEVEL SERIALIZABLE`\n await A`BEGIN`;"],
  ["a trailing backticked comment", "await A`BEGIN`; // see `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`\n"],
  ["a backticked block comment", "/* `BEGIN ISOLATION LEVEL SERIALIZABLE` */\n await A`BEGIN`;"],
  ["a narrator note", "t.note(`we could BEGIN ISOLATION LEVEL SERIALIZABLE here`);\n await A`BEGIN`;"],
])("%s cannot satisfy the isolation check", async (name, body) => {
  const promise = loadTs(name.replace(/\W+/g, "-"), tsScenario('isolation: "SERIALIZABLE",', body));
  await expect(promise).rejects.toThrow(/no level/);
});
