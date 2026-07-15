import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { type DefaultTheme, defineConfig, type HeadConfig } from "vitepress";

const REPO = "https://github.com/svyatov/database-transactions";

// GitHub Pages project-site base. `head` hrefs below spell it out because VitePress does not
// auto-prefix them with `base` (unlike page links); reuse this const so the two never drift.
const BASE_PATH = "/database-transactions/";

// Absolute site origin + base, trailing slash included — the single source of truth for the
// canonical origin (sitemap hostname, canonical/OG/Twitter URLs, and every JSON-LD `url`).
const SITE_URL = "https://svyatov.github.io/database-transactions/";

type LedgerRecord = { scenario: string; product: string; version: string; claim: string };

/** Parse `public/ledger.jsonl` once; an absent ledger (fresh tree, `gen` never ran) yields []. */
function ledgerRecords(): LedgerRecord[] {
  try {
    return readFileSync(new URL("../public/ledger.jsonl", import.meta.url), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as LedgerRecord);
  } catch {
    return [];
  }
}

/**
 * Map each lesson page's docs-root-relative path to its lead scenario's ledger `claim`.
 *
 * A lesson page pulls in transcripts with `<!--@include: ./parts/<slug>.md-->`, and a part slug
 * equals its scenario slug. The first include is the page's lead example, so we join `<pageDir>/<slug>`
 * to a ledger record — stripping whatever extension the record keys on (`.yaml` for 110 records,
 * `.ts` for 6), never assuming `.yaml`. Pages without an include, or whose lead slug has no ledger
 * record, are simply absent (they fall back to the first-paragraph description at injection time).
 */
export function buildPageClaims(
  docsDir: URL,
  records: readonly { scenario: string; claim: string }[],
): Map<string, string> {
  const claims = new Map(records.map((r) => [r.scenario.replace(/\.\w+$/, ""), r.claim]));
  const map = new Map<string, string>();
  for (const engine of ["postgres", "mysql"]) {
    const engineDir = new URL(`${engine}/`, docsDir);
    if (!existsSync(engineDir)) continue;
    for (const entry of readdirSync(engineDir, { recursive: true })) {
      const rel = String(entry).replaceAll("\\", "/");
      if (!rel.endsWith(".md") || rel.includes("parts/")) continue;
      const include = readFileSync(new URL(rel, engineDir), "utf8").match(
        /<!--\s*@include:\s*\.\/parts\/(.+?)\.md\s*-->/,
      );
      if (!include) continue;
      const pagePath = `${engine}/${rel}`;
      const claim = claims.get(`${pagePath.slice(0, pagePath.lastIndexOf("/"))}/${include[1]}`);
      if (claim) map.set(pagePath, claim);
    }
  }
  return map;
}

/**
 * Wrap a JSON-LD payload as a `<script type="application/ld+json">` head entry, escaping `<`
 * so a stray `</script>` in any embedded value (a frontmatter field, a claim, an answer) can't
 * break out of the block. The single home for that escape — shared by every JSON-LD builder here.
 */
function ldScript(ld: object): HeadConfig {
  return ["script", { type: "application/ld+json" }, JSON.stringify(ld).replaceAll("<", "\\u003c")];
}

/**
 * JSON-LD for an `errors/<code>` answer page: a QAPage whose question is the code and
 * whose accepted answer is the page's one-sentence explanation. Returns null for any page
 * that isn't an error-code page — including the `errors/` index, which carries no `code` —
 * so the `transformHead` branch stays a one-liner. Throws when an error page is missing a
 * field the structured data needs, so a malformed page fails the build loudly rather than
 * shipping broken JSON-LD.
 */
export function buildErrorJsonLd(
  relativePath: string,
  frontmatter: Record<string, unknown>,
  url: string,
): HeadConfig | null {
  if (!relativePath.startsWith("errors/") || !frontmatter.code) return null;
  const field = (key: string): string => {
    const value = frontmatter[key];
    if (typeof value !== "string" || !value) {
      throw new Error(`errors/ JSON-LD: missing "${key}" in ${relativePath}`);
    }
    return value;
  };
  const code = field("code");
  const ld = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: `What is database error ${code} — ${field("name")}?`,
      acceptedAnswer: { "@type": "Answer", text: field("description"), url },
    },
  };
  return ldScript(ld);
}

/**
 * Plain text from a rendered HTML fragment: drop VitePress's header-anchor links, strip the
 * remaining tags, decode the handful of entities the renderer emits, collapse whitespace.
 * Shared by the meta-description first-paragraph slice and by `parseFaq`.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<a class="header-anchor"[\s\S]*?<\/a>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `TechArticle` JSON-LD for a lesson or concept page — headline/description/url only. */
export function techArticleLd(fields: { title: string; description: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: fields.title,
    description: fields.description,
    url: fields.url,
  };
}

/**
 * Site-wide `WebSite` + `Organization` JSON-LD — identical on every page, so it lives in the
 * static `head[]` rather than `transformHead`. No `WebSite.potentialAction`/`SearchAction`:
 * search is client-side, with no results-page URL to point a sitelinks searchbox at.
 */
export function siteJsonLd(): object[] {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Database Transactions", url: SITE_URL },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Database Transactions",
      url: SITE_URL,
      logo: `${SITE_URL}icon-512.png`,
    },
  ];
}

/**
 * Extract `{ question, answer }` pairs from the rendered FAQ page. `content` is the whole SSR
 * layout, so scope to the `.vp-doc` article body first — an unscoped walk folds the doc-footer
 * and provenance `<footer>` into the last answer. Each `<h2>` is a question; the prose up to the
 * next `<h2>` is its answer. No `.vp-doc` (a bare test fragment) → walk `content` as-is.
 */
export function parseFaq(content: string): { question: string; answer: string }[] {
  // Match `class` wherever it sits in the tag, and `vp-doc` as a whole class token: Vue SSR
  // renders `style` before `class` (`<div style="…" class="vp-doc …">`), so an anchored
  // `<div class="vp-doc` misses in production and the scoping below silently folds in the footer.
  const open = content.match(/<div\b[^>]*\bclass="(?:[^"]*\s)?vp-doc(?:\s[^"]*)?"[^>]*>/);
  let body = content;
  if (open) {
    const start = open.index! + open[0].length;
    let depth = 1;
    const div = /<(\/?)div\b[^>]*>/g;
    div.lastIndex = start;
    let end = content.length;
    for (let m = div.exec(content); m; m = div.exec(content)) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) {
        end = m.index;
        break;
      }
    }
    body = content.slice(start, end);
  }
  const heads = [...body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)];
  const pairs: { question: string; answer: string }[] = [];
  for (let i = 0; i < heads.length; i++) {
    const question = stripHtml(heads[i]![1]!);
    const from = heads[i]!.index! + heads[i]![0].length;
    const to = i + 1 < heads.length ? heads[i + 1]!.index! : body.length;
    const answer = stripHtml(body.slice(from, to));
    if (question && answer) pairs.push({ question, answer });
  }
  return pairs;
}

/** `FAQPage` JSON-LD wrapping parsed pairs into `mainEntity: Question[]`. */
export function faqPageLd(pairs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
}

const records = ledgerRecords();
const pageClaims = buildPageClaims(new URL("../", import.meta.url), records);

/**
 * The footer's trust signal: one sentence, three clauses, each dropped when its evidence
 * is missing rather than asserted without it.
 *
 * Engine versions come from the ledger, so they are the versions the databases themselves
 * reported while proving the transcripts. The commit comes from the environment, never from
 * the ledger — a file committed at a commit cannot name it. The cross-driver clause renders
 * only when a clean `pytest` left `.cross-driver-ok` behind, which `bun run gen` destroys.
 *
 * The default theme renders `footer.message` with v-html, so the commit can be a link. Every
 * value interpolated below comes from the ledger or from `git`, never from user input.
 */
function provenance(): string {
  const clauses = [engines(), commit(), crossDriver()].filter(Boolean).join("");
  return `MIT Licensed · Every transcript on this site was generated by a real database run${clauses}.`;
}

/** Distinct `(product, version)` pairs across the ledger's records, in path order. */
function engines(): string {
  const pairs = [...new Set(records.map((r) => `${r.product} ${r.version}`))];
  return pairs.length ? ` against ${pairs.join(" and ")}` : "";
}

function commit(): string {
  let sha = process.env.GITHUB_SHA;
  if (!sha) {
    try {
      sha = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return ""; // a tarball with no .git, built outside CI
    }
  }
  return ` at <a href="${REPO}/tree/${sha}"><code>${sha.slice(0, 7)}</code></a>`;
}

function crossDriver(): string {
  const ran = existsSync(new URL("../../.cross-driver-ok", import.meta.url));
  return ran ? ", and re-proven through psycopg and PyMySQL" : "";
}

const about: DefaultTheme.SidebarItem = {
  text: "About",
  items: [
    { text: "How this site works", link: "/about/methodology" },
    { text: "Run it locally", link: "/about/run-locally" },
  ],
};

// Entry links into the two lesson tracks, for the neutral (concepts/about) pages
// whose sidebar otherwise has no path into the actual lessons.
const tracks: DefaultTheme.SidebarItem = {
  text: "Pick a database",
  items: [
    { text: "PostgreSQL", link: "/postgres/01-basics/what-is-a-transaction" },
    { text: "MySQL", link: "/mysql/01-basics/what-is-a-transaction" },
  ],
};

// The engine-neutral theory pages; collapsed inside the two track sidebars,
// expanded when browsing /concepts/ itself.
const concepts = (collapsed: boolean): DefaultTheme.SidebarItem => ({
  text: "Concepts",
  link: "/concepts/",
  collapsed,
  items: [
    {
      text: "What is a transaction? (ACID)",
      link: "/concepts/what-is-a-transaction",
    },
    { text: "Isolation levels", link: "/concepts/isolation-levels" },
    {
      text: "The anomaly catalog",
      link: "/concepts/isolation-anomalies",
      collapsed,
      items: [
        { text: "Dirty read", link: "/concepts/dirty-read" },
        { text: "Non-repeatable read", link: "/concepts/non-repeatable-read" },
        { text: "Phantom read", link: "/concepts/phantom-read" },
        { text: "Lost update", link: "/concepts/lost-update" },
        { text: "Write skew", link: "/concepts/write-skew" },
      ],
    },
    {
      text: "Anomalies by engine",
      link: "/concepts/anomalies-by-engine",
    },
    {
      text: "Dual writes & the outbox",
      link: "/concepts/transactional-outbox",
    },
  ],
});

// Shared sidebar for every engine-neutral page (concepts + about): the same
// About and Concepts groups as the track sidebars, then links into both tracks.
const neutral: DefaultTheme.SidebarItem[] = [about, concepts(false), tracks];

const postgres: DefaultTheme.SidebarItem[] = [
  about,
  concepts(true),
  {
    text: "1. Transactions 101",
    items: [
      {
        text: "What is a transaction?",
        link: "/postgres/01-basics/what-is-a-transaction",
      },
      {
        text: "BEGIN, COMMIT, ROLLBACK",
        link: "/postgres/01-basics/begin-commit-rollback",
      },
      { text: "Savepoints", link: "/postgres/01-basics/savepoints" },
    ],
  },
  {
    text: "2. Isolation levels & anomalies",
    items: [
      {
        text: "Snapshots & the four levels",
        link: "/postgres/02-isolation/snapshots-and-the-four-levels",
      },
      { text: "Read Committed", link: "/postgres/02-isolation/read-committed" },
      {
        text: "Repeatable Read",
        link: "/postgres/02-isolation/repeatable-read",
      },
      { text: "Serializable", link: "/postgres/02-isolation/serializable" },
      { text: "Lost updates", link: "/postgres/02-isolation/lost-update" },
      {
        text: "The anomaly catalog",
        link: "/postgres/02-isolation/anomaly-catalog",
      },
    ],
  },
  {
    text: "3. Locking",
    items: [
      { text: "Row locks", link: "/postgres/03-locking/row-locks" },
      { text: "Lock queues", link: "/postgres/03-locking/lock-queues" },
      {
        text: "NOWAIT, lock_timeout, SKIP LOCKED",
        link: "/postgres/03-locking/nowait-skip-locked",
      },
      {
        text: "Table locks & DDL",
        link: "/postgres/03-locking/table-locks-and-ddl",
      },
      { text: "Deadlocks", link: "/postgres/03-locking/deadlocks" },
      {
        text: "Monitoring locks",
        link: "/postgres/03-locking/monitoring-locks",
      },
    ],
  },
  {
    text: "4. MVCC under the hood",
    items: [
      {
        text: "Row versions: xmin, xmax, ctid",
        link: "/postgres/04-mvcc/row-versions",
      },
      {
        text: "Snapshots under the hood",
        link: "/postgres/04-mvcc/snapshots-under-the-hood",
      },
      {
        text: "Dead tuples and bloat",
        link: "/postgres/04-mvcc/dead-tuples-and-bloat",
      },
      { text: "VACUUM", link: "/postgres/04-mvcc/vacuum" },
      {
        text: "Long transactions",
        link: "/postgres/04-mvcc/long-transactions",
      },
      {
        text: "Transaction ID wraparound",
        link: "/postgres/04-mvcc/wraparound",
      },
    ],
  },
  {
    text: "5. Real-world patterns",
    items: [
      {
        text: "Fixing lost updates",
        link: "/postgres/05-patterns/fixing-lost-updates",
      },
      {
        text: "Retrying serialization failures",
        link: "/postgres/05-patterns/retrying-serialization-failures",
      },
      {
        text: "A SKIP LOCKED job queue",
        link: "/postgres/05-patterns/job-queue",
      },
      { text: "Advisory locks", link: "/postgres/05-patterns/advisory-locks" },
      {
        text: "Check-then-insert",
        link: "/postgres/05-patterns/check-then-insert",
      },
      { text: "Idempotency keys", link: "/postgres/05-patterns/idempotency" },
      { text: "ORM pitfalls", link: "/postgres/05-patterns/orm-pitfalls" },
    ],
  },
  {
    text: "6. Transactions across services",
    items: [
      {
        text: "Dual writes & the outbox",
        link: "/postgres/06-distributed/transactional-outbox",
      },
      { text: "LISTEN/NOTIFY", link: "/postgres/06-distributed/listen-notify" },
      { text: "Sagas", link: "/postgres/06-distributed/sagas" },
      {
        text: "Two-phase commit",
        link: "/postgres/06-distributed/two-phase-commit",
      },
    ],
  },
  {
    text: "7. Pitfalls compendium",
    items: [
      {
        text: "Symptom → cause → fix",
        link: "/postgres/07-pitfalls/compendium",
      },
      {
        text: "Queue bloat from a hung worker",
        link: "/postgres/07-pitfalls/queue-bloat",
      },
    ],
  },
  {
    text: "8. Production",
    items: [
      {
        text: "Symptom triage",
        link: "/postgres/08-production/symptom-triage",
      },
      {
        text: "Who is blocking whom",
        link: "/postgres/08-production/who-is-blocking-whom",
      },
      {
        text: "Long & idle transactions",
        link: "/postgres/08-production/long-and-idle-transactions",
      },
      {
        text: "Logs and counters",
        link: "/postgres/08-production/logs-and-counters",
      },
      {
        text: "Bloat & vacuum health",
        link: "/postgres/08-production/bloat-and-vacuum-health",
      },
      {
        text: "Alerting checklist",
        link: "/postgres/08-production/alerting-checklist",
      },
    ],
  },
];

const mysql: DefaultTheme.SidebarItem[] = [
  about,
  concepts(true),
  {
    text: "1. Transactions 101",
    items: [
      {
        text: "What is a transaction?",
        link: "/mysql/01-basics/what-is-a-transaction",
      },
      {
        text: "BEGIN, COMMIT, ROLLBACK",
        link: "/mysql/01-basics/begin-commit-rollback",
      },
      { text: "Savepoints", link: "/mysql/01-basics/savepoints" },
    ],
  },
  {
    text: "2. Isolation levels & anomalies",
    items: [
      {
        text: "Snapshots & the four levels",
        link: "/mysql/02-isolation/snapshots-and-the-four-levels",
      },
      { text: "Read Committed", link: "/mysql/02-isolation/read-committed" },
      { text: "Repeatable Read", link: "/mysql/02-isolation/repeatable-read" },
      { text: "Serializable", link: "/mysql/02-isolation/serializable" },
      { text: "Lost updates", link: "/mysql/02-isolation/lost-update" },
      {
        text: "The anomaly catalog",
        link: "/mysql/02-isolation/anomaly-catalog",
      },
    ],
  },
  {
    text: "3. Locking",
    items: [
      { text: "Row locks", link: "/mysql/03-locking/row-locks" },
      { text: "Gap locks", link: "/mysql/03-locking/gap-locks" },
      { text: "Lock queues", link: "/mysql/03-locking/lock-queues" },
      {
        text: "NOWAIT, lock timeouts, SKIP LOCKED",
        link: "/mysql/03-locking/nowait-skip-locked",
      },
      {
        text: "Table locks & DDL",
        link: "/mysql/03-locking/table-locks-and-ddl",
      },
      { text: "Deadlocks", link: "/mysql/03-locking/deadlocks" },
      { text: "Monitoring locks", link: "/mysql/03-locking/monitoring-locks" },
    ],
  },
  {
    text: "4. MVCC under the hood",
    items: [
      { text: "Undo logs", link: "/mysql/04-mvcc/undo-logs" },
      { text: "Read views", link: "/mysql/04-mvcc/read-views" },
      { text: "The history list", link: "/mysql/04-mvcc/history-list-length" },
      { text: "Purge", link: "/mysql/04-mvcc/purge" },
    ],
  },
  {
    text: "5. Real-world patterns",
    items: [
      {
        text: "Fixing lost updates",
        link: "/mysql/05-patterns/fixing-lost-updates",
      },
      {
        text: "Retrying deadlocks",
        link: "/mysql/05-patterns/retrying-deadlocks",
      },
      {
        text: "A SKIP LOCKED job queue",
        link: "/mysql/05-patterns/job-queue",
      },
      { text: "Advisory locks", link: "/mysql/05-patterns/advisory-locks" },
      {
        text: "Check-then-insert",
        link: "/mysql/05-patterns/check-then-insert",
      },
      { text: "Idempotency keys", link: "/mysql/05-patterns/idempotency" },
      { text: "ORM pitfalls", link: "/mysql/05-patterns/orm-pitfalls" },
    ],
  },
  {
    text: "6. Transactions across services",
    items: [
      {
        text: "Dual writes & the outbox",
        link: "/mysql/06-distributed/transactional-outbox",
      },
      { text: "Sagas", link: "/mysql/06-distributed/sagas" },
      {
        text: "XA transactions (2PC)",
        link: "/mysql/06-distributed/xa-transactions",
      },
    ],
  },
  {
    text: "7. Pitfalls compendium",
    items: [{ text: "Symptom → cause → fix", link: "/mysql/07-pitfalls/compendium" }],
  },
  {
    text: "8. Production",
    items: [
      { text: "Symptom triage", link: "/mysql/08-production/symptom-triage" },
      {
        text: "Who is blocking whom",
        link: "/mysql/08-production/who-is-blocking-whom",
      },
      {
        text: "Long & idle transactions",
        link: "/mysql/08-production/long-and-idle-transactions",
      },
      {
        text: "Logs and counters",
        link: "/mysql/08-production/logs-and-counters",
      },
      {
        text: "History list health",
        link: "/mysql/08-production/history-list-health",
      },
      {
        text: "Alerting checklist",
        link: "/mysql/08-production/alerting-checklist",
      },
    ],
  },
];

// Cross-engine error-code answer pages. Own nav entry and sidebar because the
// section spans both engines, so it lives outside the /postgres/ and /mysql/ trees.
const errors: DefaultTheme.SidebarItem[] = [
  { text: "All error codes", link: "/errors/" },
  {
    text: "PostgreSQL",
    items: [
      { text: "40001 — serialization failure", link: "/errors/40001" },
      { text: "40P01 — deadlock detected", link: "/errors/40P01" },
      { text: "55P03 — lock timeout", link: "/errors/55P03" },
      { text: "57014 — statement timeout", link: "/errors/57014" },
    ],
  },
  {
    text: "MySQL",
    items: [
      { text: "1213 — deadlock found", link: "/errors/1213" },
      { text: "1205 — lock wait timeout", link: "/errors/1205" },
      { text: "3572 — statement aborted (NOWAIT)", link: "/errors/3572" },
    ],
  },
];

// Flat map from a page's docs-relative path (no leading/trailing slash) to its sidebar label,
// walked from every sidebar tree. Powers the per-page BreadcrumbList crumb names below.
const sidebarLabels = new Map<string, string>();
{
  const walk = (items: DefaultTheme.SidebarItem[]) => {
    for (const it of items) {
      if (it.link) sidebarLabels.set(it.link.replace(/^\/|\/$/g, ""), it.text ?? "");
      if (it.items) walk(it.items);
    }
  };
  walk([...neutral, ...postgres, ...mysql, ...errors]);
}

/**
 * Per-page `BreadcrumbList`: Home → any ancestor path segment that is itself a real page
 * (found in the sidebar map) → the page. Numbered lesson-section dirs have no landing page,
 * so they're skipped — every emitted crumb carries an `item` URL, as Google expects. Returns
 * undefined for the home page and bare section indexes (a path ending in "/").
 */
export function breadcrumbLd(path: string, leaf: string): object | undefined {
  if (!path || path.endsWith("/")) return undefined;
  const crumbs: { name: string; url: string }[] = [{ name: "Home", url: SITE_URL }];
  const segs = path.split("/");
  for (let i = 0; i < segs.length - 1; i++) {
    const prefix = segs.slice(0, i + 1).join("/");
    const name = sidebarLabels.get(prefix);
    if (name) crumbs.push({ name, url: `${SITE_URL}${prefix}` });
  }
  crumbs.push({ name: leaf, url: `${SITE_URL}${path}` });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}

export default defineConfig({
  title: "Database Transactions",
  description:
    "Learn database transactions from verified, runnable examples — every claim proven against a real database.",
  base: BASE_PATH,
  cleanUrls: true,
  // Site-wide head tags, identical on every page. `head` hrefs are NOT auto-prefixed with `base`
  // (unlike page links), so each carries BASE_PATH explicitly — same reason the sitemap hostname
  // below spells the path out. The favicon set follows evilmartians.com/chronicles/how-to-favicon-in-2021:
  // one .ico for legacy tabs, one SVG for modern browsers (it carries its own dark-mode query), an
  // Apple touch icon, and a manifest pointing at the maskable + regular PNGs. Every href here points
  // at a docs/public/ asset — tests/seo-meta.test.ts asserts each one exists so a missing/uncommitted
  // file fails CI instead of 404ing silently (the dead-link checker never sees head hrefs).
  head: [
    ["link", { rel: "icon", href: `${BASE_PATH}favicon.ico`, sizes: "32x32" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: `${BASE_PATH}icon.svg` }],
    ["link", { rel: "apple-touch-icon", href: `${BASE_PATH}apple-touch-icon.png` }],
    ["link", { rel: "manifest", href: `${BASE_PATH}manifest.webmanifest` }],
    ["meta", { name: "theme-color", content: "#7a4a1e" }],
    ["link", { rel: "alternate", type: "text/plain", href: `${BASE_PATH}llms.txt`, title: "llms.txt" }],
    // Site-wide WebSite + Organization JSON-LD (same on every page).
    ...siteJsonLd().map(ldScript),
  ],
  // Generated transcript fragments are included into lesson pages, never built as pages.
  // The rest are gitignored working notes — CI never checks them out, so keep local
  // builds matching CI rather than rendering pages that can never ship.
  srcExclude: ["**/parts/**", "plans/**", "ideation/**", "solutions/**", "brainstorms/**"],
  // A public asset, not a page — the dead-link checker only knows how to resolve pages.
  // (It resolves the sibling llms.txt and llms-full.txt on its own.)
  ignoreDeadLinks: ["/ledger.jsonl"],
  // VitePress resolves sitemap <loc>s against this URL, so it must include the
  // base path WITH the trailing slash (SITE_URL has it) — without it the base is dropped.
  sitemap: { hostname: SITE_URL },
  // Distinct SERP titles for the two tracks: "Read Committed — PostgreSQL | …"
  // vs "Read Committed — MySQL | …". Concepts/about/home keep the default.
  transformPageData(pageData) {
    const track = pageData.relativePath.startsWith("postgres/")
      ? "PostgreSQL"
      : pageData.relativePath.startsWith("mysql/")
        ? "MySQL"
        : null;
    if (track) return { titleTemplate: `:title — ${track} | Database Transactions` };
  },
  // Canonical URL, Open Graph tags, and a unique per-page description:
  // frontmatter `description` if present, else the page's first paragraph.
  // Emitting a description meta here suppresses the global fallback.
  transformHead({ page, pageData, title, description, content }) {
    if (page === "404.md") return;
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, "$1").replace(/\.md$/, "");
    const url = `${SITE_URL}${path}`;
    const para = content.match(/<p>([\s\S]*?)<\/p>/)?.[1];
    const text = para ? stripHtml(para) : undefined;
    const firstParagraph = text && text.length > 160 ? `${text.slice(0, 160).replace(/\s+\S*$/, "")}…` : text;
    // Precedence: authored frontmatter → the lead scenario's proven claim (whole, untruncated) →
    // first-paragraph slice. The claim is a crafted single sentence, so it skips the 160-char guillotine.
    const desc = pageData.description || pageClaims.get(pageData.relativePath) || firstParagraph || description;
    const head: HeadConfig[] = [
      ["link", { rel: "canonical", href: url }],
      ["meta", { name: "description", content: desc }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: desc }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:type", content: path ? "article" : "website" }],
      // Twitter falls back to og:* but wants an explicit card type; "summary" since there's no per-page image.
      ["meta", { name: "twitter:card", content: "summary" }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: desc }],
    ];
    const jsonLd = buildErrorJsonLd(pageData.relativePath, pageData.frontmatter, url);
    if (jsonLd) head.push(jsonLd);
    // Per-page article JSON-LD: FAQPage on /faq; TechArticle on lesson and concept article pages;
    // nothing on home, about/*, section indexes, or error pages (they carry QAPage above). A path
    // ending in "/" is a bare index and is skipped.
    let article: object | undefined;
    if (path === "faq") {
      const pairs = parseFaq(content);
      if (pairs.length) article = faqPageLd(pairs);
    } else if (/^(postgres|mysql|concepts)\//.test(path) && !path.endsWith("/")) {
      article = techArticleLd({ title, description: desc, url });
    }
    if (article) head.push(ldScript(article));
    const crumbs = breadcrumbLd(path, pageData.title || title);
    if (crumbs) head.push(ldScript(crumbs));
    return head;
  },
  markdown: {
    config(md) {
      // ```transcript fences: one <span> per line, classed by the session that owns it
      // (A> prompts, ⏳/⏵ markers; result lines inherit the last prompt's session).
      // Statement lines are Shiki-highlighted as SQL; output lines stay plain.
      // The session→color registry lives in `env`, so a session keeps its color
      // across every transcript block of the page.
      const fence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!;
        if (token.info.trim() !== "transcript") return fence(tokens, idx, options, env, self);
        const sessions: string[] = ((env as any).txSessions ??= []);
        const cls = (name: string) => {
          if (!sessions.includes(name)) sessions.push(name);
          return ` tx-s${(sessions.indexOf(name) % 4) + 1}`;
        };
        const sqlLines = (code: string): string[] => {
          const inner = md.options.highlight?.(code, "sql", "")?.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1];
          return inner ? inner.split("\n") : code.split("\n").map((l) => md.utils.escapeHtml(l));
        };

        const out: string[] = [];
        const lines = token.content.replace(/\n$/, "").split("\n");
        let current = "";
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const prompt = line.match(/^(\w+)> /);
          if (prompt) {
            current = cls(prompt[1]!);
            // Collect the whole statement: continuation lines until the `;` terminator
            // (prompt() in harness/transcript.ts guarantees one, `;` or `; -- comment`).
            const indent = prompt[0].length;
            const stmt = [line];
            while (
              !/;\s*(--.*)?$/.test(stmt.at(-1)!) &&
              i + 1 < lines.length &&
              lines[i + 1]!.startsWith(" ".repeat(indent))
            ) {
              stmt.push(lines[++i]!);
            }
            const sql = sqlLines(stmt.map((l) => l.slice(indent)).join("\n"));
            stmt.forEach((_, j) => {
              const head =
                j === 0
                  ? `<span class="tx-prompt">${md.utils.escapeHtml(`${prompt[1]}>`)}</span> `
                  : " ".repeat(indent);
              out.push(`<span class="tx-line${current}">${head}${sql[j] ?? ""}</span>`);
            });
            continue;
          }
          const marker = line.match(/^[⏳⏵]\s*(\w+)/u);
          if (marker) current = cls(marker[1]!);
          const lineCls = line.trim() === "" ? "" : current;
          out.push(`<span class="tx-line${lineCls}">${md.utils.escapeHtml(line)}</span>`);
        }
        return `<div class="transcript" v-pre><pre><code>${out.join("\n")}</code></pre></div>\n`;
      };

      // ```timeline fences: engine-neutral interleaving diagrams for the concepts
      // pages — one grid column per session, one row per step, time flowing down.
      // Line format: `A: statement → result ← annotation`. Reuses the transcript
      // session palette (--tx-s1..4); output is plain HTML text, crawlable.
      const txFence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!;
        if (token.info.trim() !== "timeline") return txFence(tokens, idx, options, env, self);
        const esc = md.utils.escapeHtml;
        const lanes: string[] = [];
        const cells: string[] = [];
        const lines = token.content.split("\n").filter((l) => l.trim() !== "");
        lines.forEach((line, row) => {
          const m = line.match(/^([^:]+):\s+(.*)$/);
          if (!m) return;
          if (!lanes.includes(m[1]!)) lanes.push(m[1]!);
          const lane = lanes.indexOf(m[1]!);
          let body = m[2]!;
          const note = body.match(/←\s*(.*)$/);
          if (note) body = body.slice(0, note.index);
          const result = body.match(/→\s*(.*)$/);
          if (result) body = body.slice(0, result.index);
          cells.push(
            `<div class="tl-cell tl-s${(lane % 4) + 1}" style="grid-area:${row + 2}/${lane + 1}">${esc(body.trim())}` +
              (result ? `<span class="tl-result">→ ${esc(result[1]!)}</span>` : "") +
              (note ? `<span class="tl-note">← ${esc(note[1]!)}</span>` : "") +
              `</div>`,
          );
        });
        const head = lanes
          .map((n, i) => `<div class="tl-head tl-s${(i % 4) + 1}" style="grid-area:1/${i + 1}">${esc(n)}</div>`)
          .join("");
        return `<div class="timeline" v-pre style="grid-template-columns:repeat(${lanes.length},minmax(0,1fr))">${head}${cells.join("")}</div>\n`;
      };
    },
  },
  themeConfig: {
    nav: [
      { text: "Start here", link: "/start-here" },
      { text: "PostgreSQL", link: "/postgres/01-basics/what-is-a-transaction" },
      { text: "MySQL", link: "/mysql/01-basics/what-is-a-transaction" },
      { text: "Concepts", link: "/concepts/" },
      { text: "Error codes", link: "/errors/" },
      { text: "FAQ", link: "/faq" },
      { text: "How it works", link: "/about/methodology" },
    ],
    sidebar: {
      "/postgres/": postgres,
      "/mysql/": mysql,
      "/concepts/": neutral,
      "/errors/": errors,
      "/about/": neutral,
    },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/svyatov/database-transactions",
      },
    ],
    search: { provider: "local" },
    outline: [2, 3],
    footer: {
      message: provenance(),
      copyright: "© 2026 Leonid Svyatov",
    },
  },
});
