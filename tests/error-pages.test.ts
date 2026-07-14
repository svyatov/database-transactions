import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import config, { buildErrorJsonLd } from "../docs/.vitepress/config";

const docsDir = new URL("../docs/", import.meta.url);
const errorsDir = new URL("errors/", docsDir);

// The transaction-specific cluster: every code that gets a page, and no others.
const CLUSTER = ["40001", "40P01", "55P03", "57014", "1213", "1205", "3572"].sort();

// Raw ledger read, exactly as tests/seo-meta.test.ts does — the config's LedgerRecord
// type omits errors[], but the JSONL carries it, so this join reads the raw line.
const ledger = readFileSync(new URL("public/ledger.jsonl", docsDir), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { scenario: string; errors?: string[] });

const errorsOf = (scenario: string): string[] => {
  const rec = ledger.find((r) => r.scenario === scenario);
  if (!rec) throw new Error(`no ledger record for ${scenario}`);
  return rec.errors ?? [];
};

// Leading `---`…`---` block, parsed with the same YAML engine harness/loader.ts uses.
const frontmatter = (md: string): Record<string, string> => {
  const block = md.match(/^---\n([\s\S]*?)\n---/);
  if (!block) throw new Error("no frontmatter block");
  return Bun.YAML.parse(block[1]!) as Record<string, string>;
};

// Recursive so the gate enumerates the same tree VitePress builds: a page dropped in a
// subdirectory of errors/ still ships (with JSON-LD) and must not escape the proof tie.
const pages = readdirSync(errorsDir, { recursive: true })
  .map((entry) => String(entry).replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".md") && file !== "index.md")
  .map((file) => {
    const md = readFileSync(new URL(file, errorsDir), "utf8");
    return { file, md, fm: frontmatter(md) };
  });

// Proof tie: a page may only claim a code the ledger records for its scenario.
test("every error page claims a code its linked scenario proves", () => {
  for (const { file, fm } of pages) {
    expect(fm.code, `${file}: has a code`).toBeTruthy();
    expect(fm.scenario, `${file}: names a proving scenario`).toBeTruthy();
    expect(errorsOf(fm.scenario!), `${file}: ${fm.code} ∈ ${fm.scenario} errors[]`).toContain(String(fm.code));
  }
});

// Cluster coverage: the seven codes each have exactly one page, no strays.
test("the seven cluster codes each have exactly one page and no others", () => {
  expect(pages.map(({ fm }) => String(fm.code)).sort()).toEqual(CLUSTER);
});

// The exported JSON-LD builder, unit-tested without a full site build.
const sampleUrl = "https://svyatov.github.io/database-transactions/errors/1213";
const sampleFm = { code: "1213", name: "Deadlock found", description: "InnoDB rolled one transaction back." };

test("the builder emits well-formed QAPage JSON-LD for an error page", () => {
  const entry = buildErrorJsonLd("errors/1213.md", sampleFm, sampleUrl);
  expect(entry?.[0]).toBe("script");
  expect((entry?.[1] as { type: string }).type).toBe("application/ld+json");
  const ld = JSON.parse(entry![2] as string);
  expect(ld["@type"]).toBe("QAPage");
  expect(ld.mainEntity.name).toContain("1213");
  expect(ld.mainEntity.name).toContain("Deadlock found");
  expect(ld.mainEntity.acceptedAnswer.text).toBe(sampleFm.description);
  expect(ld.mainEntity.acceptedAnswer.url).toBe(sampleUrl);
});

test("the builder yields no JSON-LD off the errors/ prefix", () => {
  expect(buildErrorJsonLd("postgres/03-locking/deadlocks.md", sampleFm, sampleUrl)).toBeNull();
  expect(buildErrorJsonLd("errors/index.md", { description: "the index" }, sampleUrl)).toBeNull();
});

test("the builder throws on an error page missing a required field", () => {
  expect(() => buildErrorJsonLd("errors/1213.md", { code: "1213", name: "Deadlock found" }, sampleUrl)).toThrow(
    /description/,
  );
});

// The meta description IS the page's one-sentence answer, so bind the two hand-authored copies:
// the frontmatter description equals the answer paragraph with its code backticks stripped.
const answerParagraph = (md: string): string =>
  md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^\s*#[^\n]*\n/, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find(Boolean) ?? "";

test("each page's frontmatter description matches its answer paragraph", () => {
  for (const { file, md, fm } of pages) {
    expect(answerParagraph(md).replaceAll("`", ""), `${file}: description == answer sentence`).toBe(fm.description!);
  }
});

// A page unreachable from nav ships silently: bind the sidebar and the index to the cluster too,
// so a page added or removed without wiring it in fails here rather than shipping orphaned.
const errorCodeLinks = (text: string): string[] =>
  [...new Set([...text.matchAll(/\/errors\/([0-9A-Za-z]+)/g)].map((m) => m[1]!))].sort();

test("the nav sidebar and the index both link exactly the cluster codes", () => {
  expect(errorCodeLinks(JSON.stringify(config.themeConfig)), "sidebar").toEqual(CLUSTER);
  expect(errorCodeLinks(readFileSync(new URL("index.md", errorsDir), "utf8")), "index.md").toEqual(CLUSTER);
});

// The builder is wired into transformHead: an error page carries a QAPage and no article node; the
// errors index and a section index (no code, path ends in "/") and the home page carry none; a
// lesson page carries a TechArticle; the /faq page carries a FAQPage built from its rendered body.
test("transformHead emits QAPage on errors, TechArticle on lessons, FAQPage on /faq, nothing on indexes or home", () => {
  const run = (relativePath: string, fm: Record<string, unknown>, content = "<p>body</p>"): unknown[] =>
    (config.transformHead as (ctx: unknown) => unknown[] | undefined)?.({
      page: relativePath,
      pageData: { relativePath, frontmatter: fm, description: fm.description ?? "" },
      title: "t",
      description: "d",
      content,
    }) ?? [];
  const jsonLd = (head: unknown[]): unknown[] =>
    head.filter(
      (e) => Array.isArray(e) && e[0] === "script" && (e[1] as { type?: string })?.type === "application/ld+json",
    );
  const ldTypes = (head: unknown[]): string[] =>
    jsonLd(head).map((e) => JSON.parse((e as unknown[])[2] as string)["@type"] as string);
  expect(ldTypes(run("errors/1213.md", { code: "1213", name: "Deadlock found", description: "x" }))).toEqual([
    "QAPage",
  ]);
  expect(ldTypes(run("postgres/03-locking/deadlocks.md", {}))).toEqual(["TechArticle"]);
  expect(jsonLd(run("errors/index.md", { description: "the index" }))).toHaveLength(0);
  // A section index under the article-prefix regex must still be skipped (the !endsWith("/") guard).
  expect(jsonLd(run("concepts/index.md", {}))).toHaveLength(0);
  expect(jsonLd(run("index.md", {}))).toHaveLength(0);

  // FAQ wiring end-to-end: content shaped as VitePress actually renders it — `style` before `class`,
  // a trailing site <footer> — so the .vp-doc scoping runs against the real attribute order, not a
  // class-first fixture. Regression guard for the footer folding into the last answer.
  const faqContent = `<div style="position:relative;" class="vp-doc _database-transactions_faq" data-v-abc123>
<h2 id="q1" tabindex="-1">Does it work? <a class="header-anchor" href="#q1">​</a></h2>
<p>Yes, it works.</p>
</div>
<footer class="VPFooter"><p>MIT Licensed. © 2026 Leonid Svyatov</p></footer>`;
  const faqHead = run("faq.md", {}, faqContent);
  expect(ldTypes(faqHead)).toEqual(["FAQPage"]);
  const faqLd = JSON.parse((jsonLd(faqHead)[0] as unknown[])[2] as string);
  expect(faqLd.mainEntity[0].acceptedAnswer.text).toBe("Yes, it works.");
});
