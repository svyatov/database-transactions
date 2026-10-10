// Source-line citations are historical evidence. Check their exact text at the
// recorded commit; whether that text supports a disposition still needs review.
import { Glob } from "bun";

export type ReferenceManifest = {
  document: string;
  baseline: string;
  section: string;
  references: { reference: string; expected: string[] }[];
};

export function checkReferences(
  document: string,
  manifest: ReferenceManifest,
  readSource: (baseline: string, path: string) => string,
): void {
  if (!/^[0-9a-f]{40}$/.test(manifest.baseline)) throw new Error("baseline must be a full commit SHA");
  if (!/^## .+/.test(manifest.section)) throw new Error("section must be a level-two heading");
  const sections = document.split(`${manifest.section}\n`);
  if (sections.length !== 2) throw new Error(`expected one section: ${manifest.section}`);
  const section = sections[1]!.split("\n## ")[0]!;
  const cited = [...section.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1]!)
    .filter((reference) => /^[A-Za-z0-9_./-]+:/.test(reference));
  const registered = manifest.references.map(({ reference }) => reference);
  if (!cited.length || !Bun.deepEquals(cited, registered)) {
    throw new Error("section citations must match the manifest references in order");
  }

  for (const { reference, expected } of manifest.references) {
    const match = /^([A-Za-z0-9_./-]+):([1-9]\d*(?:-[1-9]\d*)?(?:,[1-9]\d*(?:-[1-9]\d*)?)*)$/.exec(reference);
    if (!match || match[1]!.startsWith("/") || match[1]!.split("/").includes("..")) {
      throw new Error(`unsupported source reference: ${reference}`);
    }
    const source = readSource(manifest.baseline, match[1]!).split("\n");
    if (source.at(-1) === "") source.pop();
    const actual: string[] = [];
    for (const range of match[2]!.split(",")) {
      const [first, last = first] = range.split("-").map(Number) as [number, number?];
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first || last > source.length) {
        throw new Error(`invalid line range: ${reference}`);
      }
      actual.push(...source.slice(first - 1, last));
    }
    if (!Bun.deepEquals(actual, expected)) {
      throw new Error(`${reference}: cited lines differ from the expected excerpt at ${manifest.baseline}`);
    }
  }
}

export function readBaseline(root: string, baseline: string, path: string): string {
  const result = Bun.spawnSync(["git", "show", `${baseline}:${path}`], { cwd: root });
  if (result.exitCode !== 0) throw new Error(`cannot read ${baseline}:${path}: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

if (import.meta.main) {
  const root = `${import.meta.dir}/..`;
  const files = [...new Glob("docs/audits/*.references.json").scanSync({ cwd: root })].sort();
  if (!files.length) throw new Error("no audit reference manifests found");
  let references = 0;
  for (const file of files) {
    try {
      const manifest: ReferenceManifest = await Bun.file(`${root}/${file}`).json();
      const commit = Bun.spawnSync(["git", "cat-file", "-t", manifest.baseline], { cwd: root });
      if (commit.exitCode !== 0 || commit.stdout.toString().trim() !== "commit") {
        throw new Error(`baseline commit unavailable: ${manifest.baseline}`);
      }
      checkReferences(await Bun.file(`${root}/${manifest.document}`).text(), manifest, (baseline, path) =>
        readBaseline(root, baseline, path),
      );
      references += manifest.references.length;
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`${files.length} audit manifest(s) checked, ${references} source references verified`);
}
