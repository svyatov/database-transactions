import { type DefaultTheme, defineConfig } from "vitepress";

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

export default defineConfig({
  title: "Database Transactions",
  description:
    "Learn database transactions from verified, runnable examples — every claim proven against a real database.",
  base: "/database-transactions/",
  cleanUrls: true,
  // Generated transcript fragments are included into lesson pages, never built as pages.
  srcExclude: ["**/parts/**"],
  // VitePress resolves sitemap <loc>s against this URL, so it must include the
  // base path WITH the trailing slash — without it the base is dropped.
  sitemap: { hostname: "https://svyatov.github.io/database-transactions/" },
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
    const url = `https://svyatov.github.io/database-transactions/${path}`;
    const text = content
      .match(/<p>([\s\S]*?)<\/p>/)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    const firstParagraph = text && text.length > 160 ? `${text.slice(0, 160).replace(/\s+\S*$/, "")}…` : text;
    const desc = pageData.description || firstParagraph || description;
    return [
      ["link", { rel: "canonical", href: url }],
      ["meta", { name: "description", content: desc }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: desc }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:type", content: path ? "article" : "website" }],
    ];
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
      { text: "How it works", link: "/about/methodology" },
    ],
    sidebar: {
      "/postgres/": postgres,
      "/mysql/": mysql,
      "/concepts/": neutral,
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
      message: "MIT Licensed · Every transcript on this site was generated by a real database run.",
      copyright: "© 2026 Leonid Svyatov",
    },
  },
});
