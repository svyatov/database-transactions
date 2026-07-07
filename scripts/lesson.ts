/**
 * Replay any scenario live against your own database.
 *
 *   bun lesson                — list every scenario, grouped by chapter
 *   bun lesson <id>           — run one scenario, streaming the transcript as it happens
 *   bun lesson <id> --step    — pause before every statement (press Enter to fire it)
 *
 * <id> is any unique part of the scenario path: "deadlock", "02-isolation/write-skew-rr", …
 */
import { dialectFor } from "../harness/dialect";
import { loadScenario } from "../harness/loader";
import { type Event, runScenario } from "../harness/run";
import { liveRenderer } from "../harness/transcript";

const root = new URL("..", import.meta.url).pathname;
const files = [...new Bun.Glob("**/*.{ts,yaml}").scanSync({ cwd: `${root}scenarios` })].sort();
const load = (file: string) => loadScenario(`${root}scenarios/${file}`);

const args = Bun.argv.slice(2);
const step = args.includes("--step");
const query = args.find((a) => a !== "--step");

if (!query) {
  let chapter = "";
  for (const file of files) {
    const dir = file.split("/").slice(0, 2).join("/");
    if (dir !== chapter) console.log(`\n${(chapter = dir)}`);
    console.log(`  ${file.replace(/\.(ts|yaml)$/, "").padEnd(44)} ${(await load(file)).title}`);
  }
  console.log("\nRun one:  bun lesson <id> [--step]");
  process.exit(0);
}

const exact = files.find((f) =>
  [f, f.replace(/\.(ts|yaml)$/, ""), f.replace(/^.*\/|\.(ts|yaml)$/g, "")].includes(query),
);
const matches = exact ? [exact] : files.filter((f) => f.replace(/\.(ts|yaml)$/, "").includes(query));
if (matches.length !== 1) {
  console.error(
    matches.length
      ? `"${query}" is ambiguous:\n  ${matches.join("\n  ")}`
      : `no scenario matches "${query}" — run \`bun lesson\` for the list`,
  );
  process.exit(1);
}

const s = await load(matches[0]!);
const dialect = dialectFor(matches[0]!);
console.log(`\n${s.title}\nClaim: ${s.claim}\n`);

const stdin = console[Symbol.asyncIterator]();
let render = (e: Event): string => JSON.stringify(e);
await runScenario(s, dialect, {
  ready: (pids) => (render = liveRenderer(pids, dialect)),
  before: step
    ? async (session, sql) => {
        process.stdout.write(`⏎ next up — [${session}] ${sql.split("\n")[0]}`);
        await stdin.next();
      }
    : undefined,
  event: (e) => console.log(render(e)),
});
console.log("✓ every assertion held — the claim above was just verified against your database");
process.exit(0);
