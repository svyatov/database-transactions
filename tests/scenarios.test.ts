import { test } from "bun:test";
import { dialectFor } from "../harness/dialect";
import { loadScenario } from "../harness/loader";
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
