# packages/okf

OKF (Open Knowledge Format) bundle parser, validator, and graph projection
service. Pure read-only service -- no RAG or AI dependencies.

## Architecture

```
OkfService (single service, eagerly loads one bundle)
  ├── loadBundle (walk + parse + validate + resolve links)
  ├── buildGraph (effect/Graph directed graph projection)
  ├── validate (conformance diagnostics)
  └── stats (bundle-level metrics)
```

## Service

| Export | Purpose |
|--------|---------|
| `OkfService` | Context tag for the OKF service |
| `OkfServiceLive(path)` | Layer factory -- loads bundle from filesystem |

## Types

| Type | Purpose |
|------|---------|
| `Bundle` | Full in-memory parsed bundle |
| `Concept` | Single parsed concept (frontmatter + body + links) |
| `ConceptFrontmatter` | Typed YAML frontmatter with extension fields |
| `ConceptLink` | Extracted markdown link (resolved or broken) |
| `ConceptNode` / `ConceptEdge` | Graph projection shapes |
| `OkfGraph` | Directed graph + node index map |
| `BundleStats` | Counts, type distribution, orphans |
| `ValidationResult` | Conformance check output |

## Errors

| Error | When |
|-------|------|
| `BundleNotFound` | Path doesn't exist or isn't a directory |
| `BundleInvalid` | Conformance failure (unparseable YAML, missing `type`) |
| `ConceptNotFound` | Requested concept ID not in bundle |

## Design Decisions

- Single bundle, eagerly loaded, read-only
- Fail fast: invalid OKF rejects at load time
- Broken links are diagnostics (data), not errors
- Graph computed once and cached
- Uses `effect/FileSystem` (consumers provide platform layer)
- Uses `effect/Graph` for directed graph operations
- Link extraction via regex (inline markdown links only)
- No dependency on `@repo/rag` -- higher layers compose both

## Testing

```bash
bun test --filter=okf
```

## Dependencies

- `effect` -- core, FileSystem, Graph
- `@repo/domain` -- shared types
