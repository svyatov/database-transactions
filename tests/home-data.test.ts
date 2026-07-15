import { expect, test } from "bun:test";
import { buildCurriculum, sidebarMysql, sidebarPostgres } from "../docs/.vitepress/config";

test("returns one entry per chapter, in order, with non-empty links", () => {
  const curriculum = buildCurriculum(sidebarPostgres, sidebarMysql);
  expect(curriculum.length).toBe(8);
  expect(curriculum[0]!.chapter).toBe("basics");
  expect(curriculum.at(-1)!.chapter).toBe("production");
  for (const entry of curriculum) {
    expect(entry.postgres).toStartWith("/postgres/");
    expect(entry.mysql).toStartWith("/mysql/");
    expect(entry.label).not.toMatch(/^\d/);
  }
});

test("every link is present in the corresponding engine's sidebar", () => {
  const links = (items: readonly import("vitepress").DefaultTheme.SidebarItem[]): string[] =>
    items.flatMap((i) => [...(i.link ? [i.link] : []), ...(i.items ? links(i.items) : [])]);
  const pgLinks = new Set(links(sidebarPostgres));
  const myLinks = new Set(links(sidebarMysql));
  for (const entry of buildCurriculum(sidebarPostgres, sidebarMysql)) {
    expect(pgLinks.has(entry.postgres)).toBe(true);
    expect(myLinks.has(entry.mysql)).toBe(true);
  }
});
