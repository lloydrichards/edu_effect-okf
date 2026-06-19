# edu_effect-okf

Exploring Google's [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) with Effect v4 and RAG.

## What is OKF?

Open Knowledge Format is a vendor-neutral specification from Google for representing knowledge as plain markdown files with YAML frontmatter, organized in directory hierarchies ("bundles"). It is human-readable, version-controllable, and designed for both agents and people to produce and consume.

- [OKF Spec (v0.1)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [Google Knowledge Catalog repo](https://github.com/GoogleCloudPlatform/knowledge-catalog)

## What this repo explores

This is a learning and experimentation repo with two goals:

1. **Learn OKF concepts** -- understand the spec, bundle structure, concept documents, cross-linking, and how knowledge bundles are produced/consumed.
2. **Build Effect-based tooling** -- use Effect v4 (beta) to create CLI tools and services that can parse, validate, ingest, query, and reason over OKF bundles, integrated with RAG (Retrieval-Augmented Generation) via ChromaDB.

## Architecture

```
edu_effect-okf/
├── apps/
│   ├── cli/              # Main tool for interacting with OKF bundles
│   └── server/           # Example HTTP/RPC server with AI chat (experimental)
├── packages/
│   ├── ai/              # Agentic loop: LLM integration, toolkits, streaming chat
│   ├── rag/             # RAG pipeline: chunking, embedding, ChromaDB storage/retrieval
│   ├── domain/          # Shared schemas: API, Chat protocol, Chunk types, OKF types (planned)
│   └── config-typescript/  # Shared tsconfig base
```

| Workspace | Purpose |
|-----------|---------|
| `apps/cli` | CLI for OKF operations (skeleton -- commands TBD) |
| `apps/server` | Example AI chat server over RPC (experimental) |
| `packages/ai` | Anthropic LLM, toolkits (think, datetime, rag), agentic loop |
| `packages/rag` | Chunking (byte/token), ChromaDB client, ingest/retrieve |
| `packages/domain` | Effect Schema definitions shared across packages |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.2+
- Docker (for ChromaDB)
- `ANTHROPIC_API_KEY` environment variable

### Install

```bash
bun install
```

### Development

```bash
bun dev              # Start all apps
bun dev --filter=cli # Start CLI only
bun run build        # Build all
bun lint             # Lint with Biome
bun format           # Format with Biome
bun test             # Run all tests (Vitest)
```

## Infrastructure

### Local ChromaDB (Docker)

For local dev, run the ChromaDB container and point the server at it:

```bash
# Start the ChromaDB service only
docker run -d --name edu_chroma -p 8000:8000 chromadb/chroma

# In another shell, run with ChromaDB env vars
CHROMA_HOST=localhost CHROMA_PORT=8000 bun dev --filter=server
```

ChromaDB will be available at `http://localhost:8000`.

## References

- [OKF Spec v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [Google Knowledge Catalog](https://github.com/GoogleCloudPlatform/knowledge-catalog)
- [Effect (v4 beta)](https://github.com/Effect-TS/effect-smol)
- [Chonkie (chunking library)](https://github.com/chonkie-inc/chonkie)
- [edu_effect-rag-builder (predecessor)](https://github.com/lloydrichards/edu_effect-rag-builder)
