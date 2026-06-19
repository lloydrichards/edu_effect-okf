# packages/ai

Agentic AI layer providing LLM integration, toolkits, and a streaming chat loop.

## Architecture

```
LanguageModel (Anthropic)
  └── Toolkits (composable tool sets)
        └── AgenticLoop (multi-turn tool calling, max 12 iterations)
              └── ChatService (orchestrates chat, streams events via Queue)
```

## Models

Two presets configured via Layers:

- `SmartModelLive` -- Claude Sonnet 4.5 (complex reasoning)
- `FastModelLive` -- Claude Haiku 4.5 (low-latency responses)

Environment: `ANTHROPIC_API_KEY`

## Toolkits

| Toolkit | Tools | Purpose |
|---------|-------|---------|
| `ThinkToolkit` | `think` | Chain-of-thought reasoning step |
| `DateTimeToolkit` | `get_current_datetime` | Real-time clock with timezone |
| `RagToolkit` | `listDocuments`, `retriever`, `deleteCollection` | RAG over ChromaDB |

Adding a toolkit:
1. Create `src/toolkits/MyToolkit.ts`
2. Define tools using Effect AI toolkit patterns
3. Merge into `ChatToolkit` in `src/services/ChatService.ts`

## Streaming

`AgenticLoop` emits `ChatStreamPart` events through a typed Queue (via
`MailboxEvents`). Consumers read from the queue to stream responses.

## Dependencies

- `@repo/domain` -- ChatStreamPart schema, ChatMessage types
- `@repo/rag` -- RagService (used by RagToolkit)
