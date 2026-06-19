# packages/domain

Shared domain schemas, service interfaces, and RPC definitions consumed by all
other packages.

## Modules

| Module    | Exports                                          |
| --------- | ------------------------------------------------ |
| `Api`     | `HealthGroup`, `HelloGroup`, `MyApi`             |
| `Chat`    | `ChatStreamPart`, `ChatMessage`, `ChatResponse`  |
| `ChatRpc` | `ChatRpc`                                        |
| `Chunk`   | `Chunk`, `Tokenizer`, `Chunker`, `ChunkError`    |

## Import Pattern

```typescript
import { ChatStreamPart } from "@repo/domain/Chat"
import { Chunk, Chunker } from "@repo/domain/Chunk"
import { MyApi } from "@repo/domain/Api"
```

## Patterns

- Effect Schema for all type definitions and validation
- Tagged errors (`ChunkError`, `TokenizerError`) for error channel
- `typeof Schema.Type` inline; `Schema.Schema.Type<typeof T>` for exports
- Only dependency: `effect` (no external packages)
