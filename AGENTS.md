# AGENTS.md

> Authoritative source for coding agent instructions. Prefer over README.md.

## Project Context

OKF (Open Knowledge Format) exploration repo -- building Effect-based tooling to
parse, validate, ingest, and query OKF bundles with RAG (ChromaDB + retrieval).

## Commands

| Command                                     | Purpose              |
| ------------------------------------------- | -------------------- |
| `bun install`                               | Install dependencies |
| `bun dev`                                   | Start all apps       |
| `bun dev --filter=cli`                      | Start CLI only       |
| `bun dev --filter=server`                   | Start server only    |
| `bun run build`                             | Build all apps       |
| `bun lint`                                  | Lint with Biome      |
| `bun format`                                | Format with Biome    |
| `bun test`                                  | Run all tests        |
| `bun test --filter=rag -- src/file.test.ts` | Run single test file |

## Tech Stack

Bun 1.2+, TypeScript 5.9, Effect 4-beta, Vitest 4, Biome 2.4, ChromaDB,
Anthropic AI

## Code Style

- Spaces (not tabs), double quotes
- Imports: `@repo/domain` for shared types; Biome auto-organizes
- Types: Effect Schema; `typeof Schema.Type` inline, `Schema.Schema.Type<typeof T>` for exports
- Naming: camelCase vars/fns, PascalCase types/classes
- Effect: `Effect.gen` + `yield*` always; Layer composition for DI
- Errors: Effect error channel; no try/catch

```typescript
Effect.gen(function* () {
  const service = yield* MyService;
  const result = yield* service.method();
  yield* Effect.log("done");
  return result;
});
```

## Workspace Context

Each workspace has its own AGENTS.md with package-specific patterns. Load on
first use when working in that package -- do NOT preload all of them.

| Workspace         | Stack                |
| ----------------- | -------------------- |
| `apps/cli`        | Effect CLI, Bun      |
| `apps/server`     | Effect Platform, RPC |
| `packages/ai`     | Effect AI, Anthropic |
| `packages/rag`    | ChromaDB, Chunking   |
| `packages/domain` | Effect Schema, RPC   |

## Local Source References

`.reference/` contains cloned repos (git ignored). Search these for
implementation details before guessing:

- `.reference/chonkie/` -- chunking library reference
- `.reference/okf/` -- OKF spec + examples
- `.reference/rag-builder/` -- prior RAG implementation

If missing, clone:
- `https://github.com/chonkie-inc/chonkie.git`
- `https://github.com/GoogleCloudPlatform/knowledge-catalog.git`
- `https://github.com/lloydrichards/edu_effect-rag-builder.git`
