import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import config, {
  breadcrumbLd,
  buildPageClaims,
  faqPageLd,
  parseFaq,
  siteJsonLd,
  techArticleLd,
} from "../docs/.vitepress/config";

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

// --- JSON-LD builders and the FAQ parser ---

test("techArticleLd carries the exact three fields under TechArticle", () => {
  const ld = techArticleLd({ title: "Read Committed — PostgreSQL", description: "no dirty reads", url: "https://x/y" });
  expect(ld).toMatchObject({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Read Committed — PostgreSQL",
    description: "no dirty reads",
    url: "https://x/y",
  });
});

test("siteJsonLd emits WebSite + Organization anchored at the site URL", () => {
  const [website, org] = siteJsonLd() as Record<string, unknown>[];
  expect(website).toMatchObject({ "@type": "WebSite", url: "https://svyatov.github.io/database-transactions/" });
  expect(org).toMatchObject({
    "@type": "Organization",
    url: "https://svyatov.github.io/database-transactions/",
    logo: "https://svyatov.github.io/database-transactions/icon-512.png",
  });
});

test("breadcrumbLd includes an ancestor that is a real page (concepts index)", () => {
  const ld = breadcrumbLd("concepts/write-skew", "Write skew") as { itemListElement: Record<string, unknown>[] };
  expect(ld.itemListElement.map((i) => i.name)).toEqual(["Home", "Concepts", "Write skew"]);
  expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
  expect(ld.itemListElement.every((i) => typeof i.item === "string")).toBe(true);
});

test("breadcrumbLd skips section dirs with no landing page (lesson pages get Home → leaf)", () => {
  const ld = breadcrumbLd("postgres/03-locking/deadlocks", "Deadlocks") as {
    itemListElement: Record<string, unknown>[];
  };
  expect(ld.itemListElement.map((i) => i.name)).toEqual(["Home", "Deadlocks"]);
});

test("breadcrumbLd returns undefined for home and bare indexes", () => {
  expect(breadcrumbLd("", "Home")).toBeUndefined();
  expect(breadcrumbLd("concepts/", "Concepts")).toBeUndefined();
});

test("transformHead emits twitter card meta and a BreadcrumbList script", () => {
  const head = config.transformHead?.({
    page: "postgres/03-locking/deadlocks.md",
    pageData: { relativePath: "postgres/03-locking/deadlocks.md", frontmatter: {}, title: "Deadlocks" },
    title: "Deadlocks — PostgreSQL | Database Transactions",
    description: "fallback",
    content: "<p>Two transactions lock rows in opposite order.</p>",
  } as any);
  const tags = (head ?? []) as [string, Record<string, string>, string?][];
  expect(tags.some(([tag, a]) => tag === "meta" && a.name === "twitter:card")).toBe(true);
  const ld = tags.filter(([tag, a]) => tag === "script" && a.type === "application/ld+json").map(([, , body]) => body);
  expect(ld.some((body) => body?.includes('"@type":"BreadcrumbList"'))).toBe(true);
});

// A `.vp-doc` article with two questions, wrapped as VitePress actually renders it: `style` before
// `class` plus a trailing `data-v-*` scope id (the real SSR attribute order — an anchored
// `<div class=` regex would miss it), header-anchor links inside each <h2>, and a nested transcript
// <div> so the div-depth scan is exercised.
const twoQuestionDoc = `
<div style="position:relative;" class="vp-doc pageName" data-v-abc123>
<h1>FAQ</h1>
<p>Intro.</p>
<h2 id="q1" tabindex="-1">Does PostgreSQL have dirty reads? <a class="header-anchor" href="#q1">​</a></h2>
<p>No. <a href="/proof">See it</a>.</p>
<div class="transcript"><pre><code>A&gt; SELECT 1;</code></pre></div>
<h2 id="q2" tabindex="-1">Is REPEATABLE READ the same as SERIALIZABLE? <a class="header-anchor" href="#q2">​</a></h2>
<p>No, write skew slips through.</p>
</div>`;

test("parseFaq extracts every question and its answer, tags stripped", () => {
  const pairs = parseFaq(twoQuestionDoc);
  expect(pairs).toEqual([
    { question: "Does PostgreSQL have dirty reads?", answer: "No. See it. A> SELECT 1;" },
    { question: "Is REPEATABLE READ the same as SERIALIZABLE?", answer: "No, write skew slips through." },
  ]);
});

test("parseFaq on content with no question headings returns [], does not throw", () => {
  expect(parseFaq(`<div style="position:relative;" class="vp-doc" data-v-abc123><p>Nothing to see.</p></div>`)).toEqual(
    [],
  );
  expect(faqPageLd(parseFaq('<div style="position:relative;" class="vp-doc" data-v-abc123></div>')).mainEntity).toEqual(
    [],
  );
});

test("parseFaq scopes to .vp-doc, so a trailing footer stays out of the last answer", () => {
  const withFooter = `
<div style="position:relative;" class="vp-doc" data-v-abc123>
<h2 id="q" tabindex="-1">Only question? <a class="header-anchor" href="#q">​</a></h2>
<p>The real answer.</p>
</div>
<footer class="VPDocFooter"><p>Previous page</p></footer>
<footer class="VPFooter"><p>MIT Licensed. Generated by a real database run.</p></footer>`;
  const pairs = parseFaq(withFooter);
  expect(pairs).toHaveLength(1);
  expect(pairs[0]!.answer).toBe("The real answer.");
});

test("faqPageLd nests each pair as a Question with an acceptedAnswer", () => {
  const ld = faqPageLd([{ question: "Q?", answer: "A." }]);
  expect(ld).toMatchObject({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }],
  });
});

// Every committed static asset referenced from head[] or the manifest must exist. A fresh CI
// checkout carries only tracked files, so this fails there if a referenced asset was never
// committed — VitePress's dead-link checker never inspects head hrefs or the manifest. Build
// artifacts produced by `bun run gen` (llms.txt is gitignored and regenerated before docs:build)
// are excluded: they legitimately don't exist at `bun test` time, which runs before gen in CI.
const base = config.base ?? "/";
const publicFile = (href: string) => new URL(`public/${href.slice(base.length)}`, docsDir);
const isGenerated = (href: string): boolean => {
  try {
    execFileSync("git", ["check-ignore", "-q", fileURLToPath(publicFile(href))], { stdio: "ignore" });
    return true; // check-ignore exits 0 -> the path is gitignored, i.e. a `bun run gen` artifact
  } catch {
    return false; // exit 1 -> not ignored, so it must be a committed asset
  }
};
const missingAssets = (refs: string[]) => refs.filter((ref) => !isGenerated(ref) && !existsSync(publicFile(ref)));

test("every committed head[] asset resolves to an existing docs/public/ file", () => {
  const hrefs = (config.head ?? [])
    .map((entry) => (Array.isArray(entry) ? (entry[1] as { href?: string })?.href : undefined))
    .filter((href): href is string => !!href && href.startsWith(base));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(missingAssets(hrefs)).toEqual([]);
});

test("every manifest icon is base-prefixed and resolves to an existing docs/public/ file", () => {
  const manifest = JSON.parse(readFileSync(new URL("public/manifest.webmanifest", docsDir), "utf8")) as {
    icons: { src: string }[];
  };
  const srcs = manifest.icons.map((icon) => icon.src);
  expect(srcs.length).toBeGreaterThan(0);
  expect(srcs.filter((src) => !src.startsWith(base))).toEqual([]);
  expect(missingAssets(srcs)).toEqual([]);
});
