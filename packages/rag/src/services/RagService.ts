import type { Metadata } from "chromadb";
import { Context, Data, Effect, Layer } from "effect";
import { ChromaService } from "./ChromaService";

export class RagError extends Data.TaggedError("RagError")<{
  message: string;
  cause: unknown;
}> {}

export class RagService extends Context.Service<RagService>()("RagService", {
  make: Effect.gen(function* () {
    const chroma = yield* ChromaService;

    const getCollection = (name: string) =>
      chroma.use((sdk) =>
        sdk.getOrCreateCollection({
          name,
        }),
      );

    const ingest = Effect.fn("ingest")(function* (
      input: Readonly<{
        collection: string;
        ids: Array<string>;
        documents: Array<string>;
        embeddings?: Array<Array<number>>;
        metadatas?: Metadata[];
      }>,
    ) {
      yield* Effect.logDebug(
        `[RagService] Ingest request received for collection "${input.collection}" with ${input.ids.length} items`,
      );

      const collection = yield* getCollection(input.collection);

      yield* Effect.tryPromise({
        try: () =>
          collection.upsert({
            ids: input.ids,
            documents: input.documents,
            ...(input.embeddings ? { embeddings: input.embeddings } : {}),
            ...(input.metadatas ? { metadatas: input.metadatas } : {}),
          }),
        catch: (error) =>
          new RagError({
            message: `Error during ingestion into collection "${input.collection}"`,
            cause: error,
          }),
      });

      const countResult = yield* Effect.tryPromise({
        try: () => collection.count(),
        catch: (error) =>
          new RagError({
            message: `Error counting collection "${input.collection}" after ingest`,
            cause: error,
          }),
      });
      yield* Effect.logDebug(
        `[RagService] Ingest complete: collection="${input.collection}", count=${countResult}`,
      );

      return { count: input.ids.length } as const;
    });

    const retrieve = Effect.fn("retrieve")(function* (
      input: Readonly<{
        collection: string;
        embedding: Array<number>;
        limit?: number;
        minDistance?: number;
      }>,
    ) {
      yield* Effect.logDebug(
        `[RagService] Retrieve request: collection="${input.collection}", limit=${input.limit}, embeddingDims=${input.embedding ? input.embedding.length : 0}`,
      );
      const collection = yield* getCollection(input.collection);

      const countResult = yield* Effect.tryPromise({
        try: () => collection.count(),
        catch: (error) =>
          new RagError({
            message: `Error counting collection "${input.collection}"`,
            cause: error,
          }),
      });
      yield* Effect.logDebug(
        `[RagService] Retrieve collection count: collection="${input.collection}", count=${countResult}`,
      );

      const result = yield* Effect.tryPromise({
        try: () =>
          collection.query({
            nResults: input.limit ?? 3,
            ...(input.embedding ? { queryEmbeddings: [input.embedding] } : {}),
            include: ["documents", "metadatas", "distances"],
          }),
        catch: (error) =>
          new RagError({
            message: `Error during retrieval from collection "${input.collection}"`,
            cause: error,
          }),
      });

      return (
        result
          .rows()
          .at(0)
          ?.filter((hit) =>
            hit.distance ? hit.distance >= (input.minDistance ?? 0) : false,
          ) || []
      );
    });

    const listDocuments = Effect.fn("listDocuments")(function* (input: {
      collection: string;
      query?: string;
      limit?: number;
    }) {
      const collection = yield* getCollection(input.collection);
      const limit = input.limit ?? 10;

      const result = yield* Effect.tryPromise({
        try: () =>
          collection.get({
            include: ["documents", "metadatas"],
            ...(input.query
              ? { whereDocument: { $contains: input.query } }
              : {}),
            ...(Number.isFinite(limit) ? { limit } : {}),
          }),
        catch: (error) =>
          new RagError({
            message: `Error listing documents in collection "${input.collection}"`,
            cause: error,
          }),
      });

      const documents = (result.documents ?? []).map((doc, index) => ({
        id: result.ids?.[index] ?? null,
        document: doc,
        metadata: result.metadatas?.[index] ?? null,
      }));

      return { documents } as const;
    });

    const deleteCollection = Effect.fn("deleteCollection")(function* (input: {
      collection: string;
    }) {
      yield* chroma.use((sdk) =>
        sdk.deleteCollection({ name: input.collection }),
      );

      yield* Effect.logDebug(
        `[RagService] Deleted collection "${input.collection}"`,
      );

      return { collection: input.collection } as const;
    });

    return { ingest, retrieve, listDocuments, deleteCollection } as const;
  }),
}) {
  static Default = Layer.effect(RagService)(RagService.make).pipe(
    Layer.provide(ChromaService.Default),
  );
}
