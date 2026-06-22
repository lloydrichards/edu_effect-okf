import type { ChromaClient as ChromaSdkClient } from "chromadb";
import { ChromaClient } from "chromadb";
import { Config, Context, Data, Effect, Layer, Option } from "effect";

export class ChromaError extends Data.TaggedError("ChromaError")<{
  cause: unknown;
}> {}

const ChromaConfig = Config.all({
  url: Config.option(Config.string("CHROMA_URL")),
  host: Config.option(Config.string("CHROMA_HOST")),
  port: Config.option(Config.number("CHROMA_PORT")),
  headersJson: Config.option(Config.string("CHROMA_HEADERS_JSON")),
});

export class ChromaService extends Context.Service<ChromaService>()(
  "ChromaService",
  {
    make: Effect.gen(function* () {
      const config = yield* ChromaConfig;
      const url = Option.getOrUndefined(config.url);
      const host = Option.getOrUndefined(config.host);
      const port = Option.getOrUndefined(config.port);
      const headersJson = Option.getOrUndefined(config.headersJson);

      const headers = headersJson ? JSON.parse(headersJson) : undefined;

      yield* Effect.logDebug(
        `[ChromaService] Using endpoint: ${url ? `url=${url}` : `host=${host ?? "localhost"} port=${port ?? 8000}`}`,
      );

      const client = yield* Effect.try({
        try: () =>
          url
            ? new ChromaClient({ path: url, headers })
            : new ChromaClient({
                host: host ?? "localhost",
                port: port ?? 8000,
                headers,
              }),
        catch: (cause) => new ChromaError({ cause }),
      });

      const use = <A>(fn: (client: ChromaSdkClient) => Promise<A>) =>
        Effect.tryPromise({
          try: () => fn(client),
          catch: (cause) => new ChromaError({ cause }),
        }).pipe(
          Effect.tapError((error) =>
            Effect.logError(
              `[ChromaService] ${fn.name || "use"} failed: ${String(
                error.cause,
              )}`,
            ),
          ),
          Effect.withSpan(`chroma.${fn.name || "use"}`),
        );

      return { client, use } as const;
    }),
  },
) {
  static Default = Layer.effect(ChromaService)(ChromaService.make);
}
