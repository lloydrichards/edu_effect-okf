# apps/server

HTTP + RPC server exposing API endpoints and streaming chat.

## Stack

- `effect/unstable/http` (HttpRouter, HttpServer, HttpApiBuilder)
- `@effect/platform-bun` (BunHttpServer, BunRuntime)
- `@repo/domain` -- API definitions, ChatRpc
- `@repo/ai` -- ChatService (used by RPC handler)

## Patterns

- `HttpApiBuilder.layer(Api)` for typed HTTP API groups
- RPC via `ChatRpcLive` merged into router composition
- CORS configured via `HttpRouter.cors`
- Config via `Config.all` with env defaults (PORT=9000, HOST=0.0.0.0)
- API groups in `src/Api/<Name>.ts`, RPC handlers in `src/Rpc/<Name>.ts`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `9000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS origins (comma-separated) |
| `DEVTOOLS` | `false` | Enable Effect DevTools |

## Run

```bash
bun dev --filter=server
```
