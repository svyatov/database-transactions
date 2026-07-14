import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import config, { buildPageClaims } from "../docs/.vitepress/config";

const docsDir = new URL("../docs/", import.meta.url);

const ledger = readFileSync(new URL("public/ledger.jsonl", docsDir), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { scenario: string; claim: string });

const claimOf = (scenario: string): string => {
  const rec = ledger.find((r) => r.scenario === scenario);
  if (!rec) throw new Error(`no ledger record for ${scenario}`);
  return rec.claim;
};

const map = buildPageClaims(docsDir, ledger);

test("single-scenario page maps to its scenario's claim", () => {
  expect(map.get("mysql/03-locking/monitoring-locks.md")).toBe(claimOf("mysql/03-locking/monitoring-locks.yaml"));
});

test("multi-scenario page uses the first included scenario's claim, not a later one", () => {
  const desc = map.get("mysql/02-isolation/read-committed.md");
  expect(desc).toBe(claimOf("mysql/02-isolation/non-repeatable-read.yaml"));
  expect(desc).not.toBe(claimOf("mysql/02-isolation/phantom-read.yaml"));
});

test("a .ts-backed page joins by stripping the .ts extension, not assuming .yaml", () => {
  expect(map.get("postgres/04-mvcc/row-versions.md")).toBe(claimOf("postgres/04-mvcc/row-versions.ts"));
});

test("a zero-scenario page is absent from the map", () => {
  expect(map.has("mysql/07-pitfalls/compendium.md")).toBe(false);
});

test("an empty ledger yields an empty map without throwing", () => {
  expect(buildPageClaims(docsDir, []).size).toBe(0);
});

test("a page whose include has no matching ledger record is absent", () => {
  const partial = buildPageClaims(docsDir, [
    { scenario: "mysql/03-locking/monitoring-locks.yaml", claim: "only this" },
  ]);
  expect(partial.get("mysql/03-locking/monitoring-locks.md")).toBe("only this");
  expect(partial.has("mysql/02-isolation/read-committed.md")).toBe(false);
});

// Every head[] href and manifest icon must resolve to a committed docs/public/ asset. A fresh CI
// checkout carries only tracked files, so this fails there if a referenced asset was never
// committed — VitePress's dead-link checker never inspects head hrefs or the manifest.
const base = config.base ?? "/";
const publicFile = (href: string) => new URL(`public/${href.slice(base.length)}`, docsDir);

test("every head[] href resolves to an existing docs/public/ asset", () => {
  const hrefs = (config.head ?? [])
    .map((entry) => (Array.isArray(entry) ? (entry[1] as { href?: string })?.href : undefined))
    .filter((href): href is string => !!href && href.startsWith(base));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.filter((href) => !existsSync(publicFile(href)))).toEqual([]);
});

test("every manifest icon resolves to an existing docs/public/ asset", () => {
  const manifest = JSON.parse(readFileSync(new URL("public/manifest.webmanifest", docsDir), "utf8")) as {
    icons: { src: string }[];
  };
  const srcs = manifest.icons.map((icon) => icon.src);
  expect(srcs.length).toBeGreaterThan(0);
  expect(srcs.filter((src) => !src.startsWith(base) || !existsSync(publicFile(src)))).toEqual([]);
});
