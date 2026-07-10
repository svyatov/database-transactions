// Every internal `page#fragment` link in the docs must point at a heading that exists.
// `vitepress build` strips the fragment before checking a link, so it catches a missing
// page and never a stale heading slug — this closes that hole.
//
// The guard's own failure mode is going green while a dead anchor ships, so it errs loud:
// a link syntax it cannot parse is reported, never skipped.

import { Glob } from "bun";
import config from "../docs/.vitepress/config";

// biome-ignore lint/suspicious/noControlCharactersInRegex: verbatim from vitepress@1.6.4
const rControl = /[\u0000-\u001f]/g;
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const rCombining = /[\u0300-\u036F]/g;

// Verbatim from the slugify that vitepress@1.6.4 bundles from @mdit-vue/shared, which has
// no importable path. Feed it `inlineText()` below, not raw source — the anchor plugin
// slugifies rendered text. ponytail: copy 1 line, don't reach into node_modules.
const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(rCombining, "")
    .replace(rControl, "")
    .replace(rSpecial, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^(\d)/, "_$1")
    .toLowerCase();

/**
 * Fenced code is not markdown: its `#` lines are comments, its `](…)` are examples.
 * Handles ``` and ~~~ of any length; an unterminated fence swallows the rest of the file,
 * which surfaces as a reported anchor rather than a silent pass.
 */
const stripFences = (md: string): string => {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of md.split("\n")) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = null;
    } else if (m) {
      fence = m[1]!;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * markdown-it-anchor slugifies a heading's *rendered* text, not its source. Reduce the
 * source to that text first, or `` ## Random `40001`s `` yields `random-40001-s` here and
 * `random-40001s` on the site — a stale anchor that would pass unnoticed.
 *
 * Emphasis markers are deliberately left alone: slugify maps `*` and `_` to `-`, then
 * collapses and trims, so `*not*` and `lock_timeout` already agree with the rendered text.
 * Stripping them would break `lock_timeout` (markdown-it does not open emphasis intraword).
 */
const inlineText = (s: string) =>
  s
    .replace(/!?\[([^\]]*)]\([^)]*\)/g, "$1") // links and images render as their text
    .replace(/`+([^`]*)`+/g, "$1") // code spans
    .replace(/<[^>]+>/g, "") // raw HTML tags
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(Number(e[1] === "x" ? `0x${e.slice(2)}` : e.slice(1)))
        : (ENTITIES[e.toLowerCase()] ?? m),
    );

const headingSlugs = (md: string): Set<string> => {
  const seen = new Set<string>();
  for (const line of stripFences(md).split("\n")) {
    const m = /^#{1,6}\s+(.+)$/.exec(line);
    if (!m) continue;
    // markdown-it-anchor's uniqueSlug: a repeated heading becomes `slug-1`, `slug-2`, …
    const base = slugify(inlineText(m[1]!.trim()));
    let slug = base;
    for (let i = 1; seen.has(slug); i++) slug = `${base}-${i}`;
    seen.add(slug);
  }
  return seen;
};

/** Inline link: `](dest)`, `](<dest>)`, `](dest "title")`. */
const INLINE_LINK = /]\(\s*<?([^<>()\s]*)>?(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/g;

/** Anchored link shapes this checker cannot resolve — reported rather than skipped. */
const UNVERIFIABLE = [
  /^[ \t]*\[[^\]]+]:[ \t]*\S*#\S/gm, // reference-style definition
  /<a\s[^>]*href\s*=\s*["'][^"']*#[^"']/gi, // raw HTML anchor
];

const isExternal = (dest: string) => /^[a-z][a-z0-9+.-]*:/i.test(dest);

export type Broken = { from: string; link: string; reason: string };

/** `pages` maps a docs-relative path (`concepts/index.md`) to its markdown source. */
export function findBrokenAnchors(pages: Map<string, string>): Broken[] {
  const slugs = new Map([...pages].map(([path, md]) => [path, headingSlugs(md)]));
  const broken: Broken[] = [];

  for (const [from, md] of pages) {
    const body = stripFences(md);

    for (const re of UNVERIFIABLE) {
      for (const [match] of body.matchAll(re)) {
        broken.push({
          from,
          link: match.trim(),
          reason: "unsupported anchored-link syntax — rewrite as an inline link",
        });
      }
    }

    for (const [, dest] of body.matchAll(INLINE_LINK)) {
      if (!dest!.includes("#") || isExternal(dest!)) continue;
      // Resolve `./x`, `../x`, `/x`, and bare `#frag` the way a browser would.
      const url = new URL(dest!, `file:///${from}`);
      const frag = decodeURIComponent(url.hash.slice(1));
      const path = url.pathname.slice(1);
      const page = path.endsWith(".md") ? path : path.endsWith("/") || path === "" ? `${path}index.md` : `${path}.md`;

      const found = slugs.get(page);
      if (!found) broken.push({ from, link: dest!, reason: `no such page: ${page}` });
      else if (!found.has(frag)) broken.push({ from, link: dest!, reason: `no heading slugifies to \`${frag}\`` });
    }
  }
  return broken;
}

// A check that never fails on a known-bad input proves nothing. Every branch below is a
// breakage this gate must catch; `ok`/`local`/`dup` are the valid links it must not reject.
function selfTest() {
  const pages = new Map([
    [
      "a.md",
      "# Hello World\n" +
        "[ok](/b#the-target)\n" +
        "[local](#hello-world)\n" +
        "[dup](/b#the-target-1)\n" + // duplicate heading -> markdown-it-anchor appends -1
        "[glued](/b#random-40001s)\n" + // code span glued to a word: rendered text, not source
        "[stale](/b#the-targt)\n" +
        "[rel](./b#the-targt)\n" + // relative
        "[up](../a#nope)\n" + // parent-relative, resolves back to a.md
        '[titled](/b#the-targt "a title")\n' +
        "[deadpage](/c#whatever)\n" +
        "[fence](#not-a-heading)\n" + // only a heading if the fence stripper breaks
        "[tilde](#nor-this-one)\n" +
        "```sh\n# not a heading\n```\n" +
        "~~~sh\n# nor this one\n~~~\n",
    ],
    ["b.md", "## The target\n## The target\n## Random `40001`s\n"],
  ]);
  const got = findBrokenAnchors(pages)
    .map((b) => b.link)
    .sort();
  const want = [
    "../a#nope",
    "./b#the-targt",
    "/b#the-targt",
    "/b#the-targt",
    "/c#whatever",
    "#not-a-heading",
    "#nor-this-one",
  ].sort();
  if (!Bun.deepEquals(got, want)) throw new Error(`self-test failed:\n  got  ${got}\n  want ${want}`);

  const unverifiable = findBrokenAnchors(new Map([["a.md", '[ref]: /b#frag\n<a href="/b#frag">x</a>\n']]));
  if (unverifiable.length !== 2) throw new Error(`self-test failed: unsupported syntax not reported`);
}

if (import.meta.main) {
  selfTest();

  const root = `${import.meta.dir}/../docs`;
  // Check exactly the page set vitepress builds. Read `srcExclude` from the config rather
  // than restating it: a folder silently un-excluded there would silently go unchecked here.
  // Renaming the key away must break loudly, not quietly widen the page set.
  if (!config.srcExclude?.length) throw new Error("docs/.vitepress/config.ts no longer defines srcExclude");
  const excluded = config.srcExclude.map((p) => new Glob(p));
  const files = [...new Glob("**/*.md").scanSync({ cwd: root })]
    .filter((f) => !excluded.some((g) => g.match(f)))
    .sort();
  const pages = new Map(await Promise.all(files.map(async (f) => [f, await Bun.file(`${root}/${f}`).text()] as const)));

  const broken = findBrokenAnchors(pages);
  for (const b of broken) console.error(`docs/${b.from}: ${b.link} — ${b.reason}`);
  console.log(`${pages.size} pages checked, ${broken.length} broken anchor${broken.length === 1 ? "" : "s"}`);
  if (broken.length) process.exit(1);
}
