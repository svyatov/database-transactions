## What & why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

Golden rule: **no claim without a proving scenario** ([CONTRIBUTING.md](../CONTRIBUTING.md)).

- [ ] Every new claim in prose is backed by a scenario assertion, or a verbatim, linked official-docs quote
- [ ] `bun test` is green (both PostgreSQL and MySQL)
- [ ] `bun run gen` produced no drift — `git diff --exit-code docs` is clean
- [ ] `bunx tsc --noEmit` and `bunx biome ci .` pass
- [ ] Docs build clean — `bun run docs:build` (pages) and `bun run docs:anchors` (heading anchors)
- [ ] Both database tracks kept in parity where the lesson applies
