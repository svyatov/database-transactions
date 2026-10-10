import { test } from "bun:test";
import { dialectFor, mysql } from "../harness/dialect";
import { fromYaml, loadScenario } from "../harness/loader";
import { runScenario } from "../harness/run";

// One test per scenario file, in path order. Bun runs tests in a file serially,
// which is exactly what we want — scenarios share one database per dialect.
const root = `${import.meta.dir}/../scenarios`;
const files = [...new Bun.Glob("**/*.{ts,yaml}").scanSync({ cwd: root })].sort();

for (const file of files) {
  const s = await loadScenario(`${root}/${file}`);
  test(
    `${file} — ${s.claim}`,
    async () => {
      await runScenario(s, dialectFor(file));
    },
    // Must stay well above harness BLOCK_DEADLINE_MS (30s): a scenario can spend that whole
    // budget on a single lock-wait fence, and with the two equal the test wall fired first —
    // killing the run with a bare "timed out after 30000ms" before the harness could report
    // which claim was false. The slack also gives a CPU-starved CI runner room on a green run.
    { timeout: 45_000 },
  );
}

// Keep these in the serial Scenario suite: they reset the same MySQL database.
for (const table of ["other_accounts", "monitoring_locks_noise.accounts"]) {
  test(
    `MySQL monitoring ignores unrelated locks and waits on ${table}`,
    async () => {
      const path = `${root}/mysql/03-locking/monitoring-locks.yaml`;
      const doc = Bun.YAML.parse(await Bun.file(path).text()) as Parameters<typeof fromYaml>[0];
      const admin = mysql.connect(1);
      let created = false;
      try {
        // Do not reuse or remove a database that this test did not create.
        await admin.unsafe("CREATE DATABASE monitoring_locks_noise");
        created = true;
        doc.setup += `\nCREATE TABLE ${table} (id int PRIMARY KEY, balance int NOT NULL);
          INSERT INTO ${table} VALUES (1, 100);`;
        doc.sessions.push("C", "D");
        doc.steps.unshift(
          { C: "BEGIN" },
          { C: `UPDATE ${table} SET balance = 200 WHERE id = 1` },
          { D: `UPDATE ${table} SET balance = 300 WHERE id = 1`, blocks: "noise" },
        );
        doc.steps.push({ C: "COMMIT" }, { success: "noise" });
        await runScenario(fromYaml(doc, path), mysql);
      } finally {
        try {
          if (created) await admin.unsafe("DROP DATABASE monitoring_locks_noise");
        } finally {
          await admin.close();
        }
      }
    },
    { timeout: 45_000 },
  );
}
