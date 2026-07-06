import { test } from "bun:test";
import { dialectFor } from "../harness/dialect";
import type { Scenario } from "../harness/scenario";
import { runScenario } from "../harness/run";

// One test per scenario file, in path order. Bun runs tests in a file serially,
// which is exactly what we want — scenarios share one database per dialect.
const root = `${import.meta.dir}/../scenarios`;
const files = [...new Bun.Glob("**/*.ts").scanSync({ cwd: root })].sort();

for (const file of files) {
  const { default: s } = (await import(`${root}/${file}`)) as { default: Scenario };
  test(
    `${file} — ${s.claim}`,
    async () => {
      await runScenario(s, dialectFor(file));
    },
    { timeout: 30_000 },
  );
}
