# packages/rag

RAG (Retrieval-Augmented Generation) pipeline: chunk documents, embed them, store
in ChromaDB, and retrieve by semantic similarity.

## Architecture

```
ChunkService (strategy selection by file type)
  ├── FastChunker (byte-level, delimiter-aware)
  └── TokenChunker (token-count based, configurable overlap)

ChromaService (Effect-wrapped ChromaDB client)
  └── RagService (ingest, retrieve, listDocuments, deleteCollection)
```

## Services

| Service | Purpose |
|---------|---------|
| `ChunkService` | Selects chunking strategy by file extension (.md, .txt, .pdf, .csv) |
| `ChromaService` | ChromaDB client wrapper, configured via env vars |
| `RagService` | High-level operations: ingest docs + embeddings, retrieve by similarity |

## Chunking Strategies

- **FastChunker** -- Byte-level chunking with delimiter-aware splitting and
  UTF-8 boundary alignment. Default chunk size: 4096 bytes.
- **TokenChunker** -- Token-count-based chunking with configurable overlap.
  Default: 2048 tokens, 0 overlap. Uses `DelimTokenizer`.
- **Strategy selection** -- `ChunkService` picks the strategy based on file
  extension and content size. Files >100K chars use fast chunking. Markdown
  files get table/prose segment splitting before chunking.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CHROMA_URL` | Full ChromaDB URL (alternative to host/port) |
| `CHROMA_HOST` | ChromaDB hostname (default: `localhost`) |
| `CHROMA_PORT` | ChromaDB port (default: `8000`) |
| `CHROMA_HEADERS_JSON` | JSON string of auth headers |

## Testing

```bash
bun test --filter=rag
```

Tests exist for `FastChunker`, `TokenChunker`, `DelimTokenizer`, and
`ChunkService`.

## Dependencies

- `chromadb` -- vector database client
- `@chroma-core/default-embed` -- default embedding function
- `unpdf` -- PDF text extraction
- `@repo/domain` -- Chunk, Tokenizer, Chunker service interfaces
