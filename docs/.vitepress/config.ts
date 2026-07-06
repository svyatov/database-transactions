import { defineConfig, type DefaultTheme } from "vitepress";

const about: DefaultTheme.SidebarItem = {
  text: "About",
  items: [
    { text: "Why trust this site?", link: "/about/methodology" },
    { text: "Run it locally", link: "/about/run-locally" },
  ],
};

const postgres: DefaultTheme.SidebarItem[] = [
  about,
  {
    text: "1. Transactions 101",
    items: [
      { text: "What is a transaction?", link: "/postgres/01-basics/what-is-a-transaction" },
      { text: "BEGIN, COMMIT, ROLLBACK", link: "/postgres/01-basics/begin-commit-rollback" },
      { text: "Savepoints", link: "/postgres/01-basics/savepoints" },
    ],
  },
  {
    text: "2. Isolation levels & anomalies",
    items: [
      { text: "Snapshots & the four levels", link: "/postgres/02-isolation/snapshots-and-the-four-levels" },
      { text: "Read Committed", link: "/postgres/02-isolation/read-committed" },
      { text: "Repeatable Read", link: "/postgres/02-isolation/repeatable-read" },
      { text: "Serializable", link: "/postgres/02-isolation/serializable" },
      { text: "Lost updates", link: "/postgres/02-isolation/lost-update" },
      { text: "The anomaly catalog", link: "/postgres/02-isolation/anomaly-catalog" },
    ],
  },
  {
    text: "3. Locking",
    items: [
      { text: "Row locks", link: "/postgres/03-locking/row-locks" },
      { text: "Lock queues", link: "/postgres/03-locking/lock-queues" },
      { text: "NOWAIT, lock_timeout, SKIP LOCKED", link: "/postgres/03-locking/nowait-skip-locked" },
      { text: "Table locks & DDL", link: "/postgres/03-locking/table-locks-and-ddl" },
      { text: "Deadlocks", link: "/postgres/03-locking/deadlocks" },
      { text: "Monitoring locks", link: "/postgres/03-locking/monitoring-locks" },
    ],
  },
  {
    text: "4. MVCC under the hood",
    items: [
      { text: "Row versions: xmin, xmax, ctid", link: "/postgres/04-mvcc/row-versions" },
      { text: "Snapshots under the hood", link: "/postgres/04-mvcc/snapshots-under-the-hood" },
      { text: "Dead tuples & bloat", link: "/postgres/04-mvcc/dead-tuples-and-bloat" },
      { text: "VACUUM", link: "/postgres/04-mvcc/vacuum" },
      { text: "Long transactions", link: "/postgres/04-mvcc/long-transactions" },
      { text: "Transaction ID wraparound", link: "/postgres/04-mvcc/wraparound" },
    ],
  },
  {
    text: "5. Real-world patterns",
    items: [
      { text: "Fixing lost updates", link: "/postgres/05-patterns/fixing-lost-updates" },
      { text: "Retrying serialization failures", link: "/postgres/05-patterns/retrying-serialization-failures" },
      { text: "A SKIP LOCKED job queue", link: "/postgres/05-patterns/job-queue" },
      { text: "Advisory locks", link: "/postgres/05-patterns/advisory-locks" },
      { text: "Check-then-insert", link: "/postgres/05-patterns/check-then-insert" },
      { text: "Idempotency keys", link: "/postgres/05-patterns/idempotency" },
      { text: "ORM pitfalls", link: "/postgres/05-patterns/orm-pitfalls" },
    ],
  },
  {
    text: "6. Transactions across services",
    items: [
      { text: "Dual writes & the outbox", link: "/postgres/06-distributed/transactional-outbox" },
      { text: "LISTEN/NOTIFY", link: "/postgres/06-distributed/listen-notify" },
      { text: "Sagas", link: "/postgres/06-distributed/sagas" },
      { text: "Two-phase commit", link: "/postgres/06-distributed/two-phase-commit" },
    ],
  },
  {
    text: "7. Pitfalls compendium",
    items: [{ text: "Symptom → cause → fix", link: "/postgres/07-pitfalls/compendium" }],
  },
  {
    text: "8. Production",
    items: [
      { text: "Symptom triage", link: "/postgres/08-production/symptom-triage" },
      { text: "Who is blocking whom", link: "/postgres/08-production/who-is-blocking-whom" },
      { text: "Long & idle transactions", link: "/postgres/08-production/long-and-idle-transactions" },
      { text: "Logs & counters", link: "/postgres/08-production/logs-and-counters" },
      { text: "Bloat & vacuum health", link: "/postgres/08-production/bloat-and-vacuum-health" },
      { text: "Alerting checklist", link: "/postgres/08-production/alerting-checklist" },
    ],
  },
];

const mysql: DefaultTheme.SidebarItem[] = [
  about,
  {
    text: "1. Transactions 101",
    items: [
      { text: "What is a transaction?", link: "/mysql/01-basics/what-is-a-transaction" },
      { text: "BEGIN, COMMIT, ROLLBACK", link: "/mysql/01-basics/begin-commit-rollback" },
      { text: "Savepoints", link: "/mysql/01-basics/savepoints" },
    ],
  },
  {
    text: "2. Isolation levels & anomalies",
    items: [
      { text: "Snapshots & the four levels", link: "/mysql/02-isolation/snapshots-and-the-four-levels" },
      { text: "Read Committed", link: "/mysql/02-isolation/read-committed" },
      { text: "Repeatable Read", link: "/mysql/02-isolation/repeatable-read" },
      { text: "Serializable", link: "/mysql/02-isolation/serializable" },
      { text: "Lost updates", link: "/mysql/02-isolation/lost-update" },
      { text: "The anomaly catalog", link: "/mysql/02-isolation/anomaly-catalog" },
    ],
  },
  {
    text: "3. Locking",
    items: [
      { text: "Row locks", link: "/mysql/03-locking/row-locks" },
      { text: "Lock queues", link: "/mysql/03-locking/lock-queues" },
      { text: "NOWAIT, lock timeouts, SKIP LOCKED", link: "/mysql/03-locking/nowait-skip-locked" },
      { text: "Table locks & DDL", link: "/mysql/03-locking/table-locks-and-ddl" },
      { text: "Deadlocks", link: "/mysql/03-locking/deadlocks" },
      { text: "Monitoring locks", link: "/mysql/03-locking/monitoring-locks" },
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
  themeConfig: {
    nav: [
      { text: "PostgreSQL", link: "/postgres/01-basics/what-is-a-transaction" },
      { text: "MySQL", link: "/mysql/01-basics/what-is-a-transaction" },
      { text: "Methodology", link: "/about/methodology" },
    ],
    sidebar: {
      "/postgres/": postgres,
      "/mysql/": mysql,
      "/about/": postgres,
    },
    socialLinks: [{ icon: "github", link: "https://github.com/svyatov/database-transactions" }],
    search: { provider: "local" },
    outline: [2, 3],
    footer: {
      message: "MIT Licensed · Every transcript on this site was generated by a real database run.",
      copyright: "© 2026 Leonid Svyatov",
    },
  },
});
