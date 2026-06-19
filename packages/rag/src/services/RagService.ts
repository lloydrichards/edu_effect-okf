import type { Metadata, Where, WhereDocument } from "chromadb";
import { Context, Data, Effect, Layer } from "effect";
import { ChromaService } from "./ChromaService";

export class RagError extends Data.TaggedError("RagError")<{
  message: string;
  cause: unknown;
}> {}
export type RagHit = Readonly<{
  id: string;
  score: number | null;
  document: string | null;
  metadata: Record<string, unknown> | null;
}>;

type CollectionSummary = Readonly<{
  ids?: Array<string>;
  documents?: Array<string | null>;
}>;

type CollectionClient = {
  get: (input: {
    limit?: number;
    include?: Array<"documents">;
  }) => Promise<CollectionSummary>;
};

const normalizeHits = (result: {
  ids?: Array<Array<string>>;
  documents?: Array<Array<string | null>>;
  metadatas?: Array<Array<Record<string, unknown> | null>>;
  distances?: Array<Array<number | null>>;
}): Array<RagHit> => {
  const ids = result.ids?.[0] ?? [];
  const documents = result.documents?.[0] ?? [];
  const metadatas = result.metadatas?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];

  return ids.map((id: string, index: number) => ({
    id,
    score: distances[index] ?? null,
    document: documents[index] ?? null,
    metadata: metadatas[index] ?? null,
  }));
};

export class RagService extends Context.Service<RagService>()("RagService", {
  make: Effect.gen(function* () {
    const chroma = yield* ChromaService;

    const getCollection = (name: string) =>
      chroma.use((sdk) =>
        sdk.getOrCreateCollection({
          name,
        }),
      );

    const logCollectionSummary = Effect.fn("logCollectionSummary")(function* (
      collection: CollectionClient,
      label: string,
    ) {
      const info = yield* Effect.tryPromise({
        try: () =>
          collection.get({
            limit: 1,
            include: ["documents"],
          }),
        catch: (error) =>
          new RagError({
            message: `Error getting collection summary for "${label}"`,
            cause: error,
          }),
      });
      const firstId = info.ids?.[0] ?? null;
      const firstDoc = info.documents?.[0] ?? null;
      yield* Effect.log(
        `[RagService] Collection summary: ${label}, sampleId=${firstId ?? "none"}, sampleDocLength=${firstDoc ? firstDoc.length : 0}`,
      );
    });

    const ingest = Effect.fn("ingest")(function* (
      input: Readonly<{
        collection: string;
        ids: Array<string>;
        documents: Array<string>;
        embeddings?: Array<Array<number>>;
        metadatas?: Metadata[];
      }>,
    ) {
      yield* Effect.log(
        `[RagService] Ingest request received for collection "${input.collection}" with ${input.ids.length} items`,
      );
      yield* Effect.log(
        `[RagService] Ingest payload details: documents=${input.documents.length}, embeddings=${input.embeddings ? input.embeddings.length : 0}, metadatas=${input.metadatas ? input.metadatas.length : 0}`,
      );
      if (input.embeddings && input.embeddings.length > 0) {
        yield* Effect.log(
          `[RagService] Ingest embedding dimensions: first=${input.embeddings[0]?.length ?? 0}`,
        );
      }
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
      yield* Effect.log(
        `[RagService] Ingest complete: collection="${input.collection}", count=${countResult}`,
      );
      if (countResult > 0) {
        yield* logCollectionSummary(
          collection,
          `${input.collection} after ingest`,
        );
      }

      return { count: input.ids.length } as const;
    });

    const retrieve = Effect.fn("retrieve")(function* (
      input: Readonly<{
        collection: string;
        queries?: Array<string>;
        embedding?: Array<number>;
        topK: number;
        where?: Where;
        whereDocument?: WhereDocument;
      }>,
    ) {
      yield* Effect.log(
        `[RagService] Retrieve request: collection="${input.collection}", topK=${input.topK}, queries=${input.queries ? input.queries.length : 0}, embeddingDims=${input.embedding ? input.embedding.length : 0}`,
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
      yield* Effect.log(
        `[RagService] Retrieve collection count: collection="${input.collection}", count=${countResult}`,
      );
      if (countResult > 0) {
        yield* logCollectionSummary(
          collection,
          `${input.collection} before retrieve`,
        );
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          collection.query({
            nResults: input.topK,
            ...(input.queries ? { queryTexts: input.queries } : {}),
            ...(input.embedding ? { queryEmbeddings: [input.embedding] } : {}),
            ...(input.where ? { where: input.where } : {}),
            ...(input.whereDocument
              ? { whereDocument: input.whereDocument }
              : {}),
            include: ["documents", "metadatas", "distances"],
          }),
        catch: (error) =>
          new RagError({
            message: `Error during retrieval from collection "${input.collection}"`,
            cause: error,
          }),
      });

      return {
        hits: normalizeHits(
          result as {
            ids?: Array<Array<string>>;
            documents?: Array<Array<string | null>>;
            metadatas?: Array<Array<Record<string, unknown> | null>>;
            distances?: Array<Array<number | null>>;
          },
        ),
      } as const;
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
      yield* Effect.log(
        `[RagService] Deleting collection "${input.collection}"`,
      );

      yield* chroma.use((sdk) =>
        sdk.deleteCollection({ name: input.collection }),
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
