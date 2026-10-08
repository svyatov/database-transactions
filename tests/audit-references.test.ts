import { expect, test } from "bun:test";
import { checkReferences, type ReferenceManifest, readBaseline } from "../scripts/check-audit-references";

const baseline = "7a9913800bb15b2d0d76a0fcc80febbbcc6c53a8";
const section = "## Outside-slice reconciliation";
const manifest = (reference = "docs/page.md:2,4-5"): ReferenceManifest => ({
  document: "docs/audits/example.md",
  baseline,
  section,
  references: [{ reference, expected: ["claim", "context", "limit"] }],
});
const document = (reference = "docs/page.md:2,4-5") => `${section}\n\n| \`${reference}\` | Reconcile |\n\n## Next\n`;
const source = () => "# Title\nclaim\n\ncontext\nlimit\n";

test("compares every selected line, including comma-separated ranges, at the pinned baseline", () => {
  const content = document().replace("| Reconcile |", "| Run `bun run docs:references` |");
  checkReferences(content, manifest(), (commit, path) => {
    expect(commit).toBe(baseline);
    expect(path).toBe("docs/page.md");
    return source();
  });
});

test("rejects an in-bounds wrong line even when the document and manifest agree on the number", () => {
  expect(() => checkReferences(document("docs/page.md:3,4-5"), manifest("docs/page.md:3,4-5"), source)).toThrow(
    "differ from the expected excerpt",
  );
});

test("rejects missing, changed, or duplicate citations and a missing section", () => {
  for (const content of [document("docs/page.md:1"), `${section}\nNo references\n`, "## Missing\n"]) {
    expect(() => checkReferences(content, manifest(), source)).toThrow();
  }
  expect(() => checkReferences(document(), { ...manifest(), references: [] }, source)).toThrow();
  expect(() =>
    checkReferences(`${section}\n\`docs/page.md:2,4-5\` \`docs/page.md:2,4-5\`\n`, manifest(), source),
  ).toThrow();
});

test("rejects invalid ranges and paths rather than checking partial excerpts", () => {
  for (const reference of ["docs/page.md:5-4", "docs/page.md:2,4-6", "docs/page.md:0", "../page.md:2"]) {
    expect(() => checkReferences(document(reference), manifest(reference), source)).toThrow();
  }
});

test("rejects a moving baseline or changed expected text", () => {
  expect(() => checkReferences(document(), { ...manifest(), baseline: "main" }, source)).toThrow("full commit SHA");
  const changed = manifest();
  changed.references[0]!.expected[0] = "different claim";
  expect(() => checkReferences(document(), changed, source)).toThrow("expected excerpt");
});

test("catches the original HomeCurriculum line 17 error using the historical source", () => {
  const path = "docs/.vitepress/theme/components/HomeCurriculum.vue";
  const expected = manifest(`${path}:16`);
  expected.references[0]!.expected = [
    "        <p>Eight chapters, each proven against PostgreSQL and MySQL. Pick a database and start anywhere.</p>",
  ];
  const read = (commit: string, file: string) => readBaseline(`${import.meta.dir}/..`, commit, file);
  checkReferences(document(`${path}:16`), expected, read);
  expected.references[0]!.reference = `${path}:17`;
  expect(() => checkReferences(document(`${path}:17`), expected, read)).toThrow("expected excerpt");
  expect(() => readBaseline(`${import.meta.dir}/..`, "0".repeat(40), path)).toThrow("cannot read");
});
