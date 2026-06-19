import { RagService } from "@repo/rag";
import { Effect, Schema } from "effect";
import { EmbeddingModel, Tool, Toolkit } from "effect/unstable/ai";

const DocumentMetadata = Schema.Record(Schema.String, Schema.Unknown);

const readMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => (typeof metadata?.[key] === "string" ? metadata[key] : null);

/**
 * List Document Tool - Lists documents in a collection
 */
const listDocumentsTool = Tool.make("listDocuments", {
  description:
    "List documents in a collection. Example: listDocuments(collection: 'uploads')",
  parameters: Schema.Struct({
    query: Schema.String.pipe(
      Schema.annotate({
        description: "Optional text query to filter documents.",
      }),
    ),
  }),
  success: Schema.Struct({
    documents: Schema.Array(
      Schema.Struct({
        id: Schema.NullOr(Schema.String),
        document: Schema.String,
        fileName: Schema.NullOr(Schema.String),
        metadata: Schema.NullOr(DocumentMetadata),
      }),
    ),
  }),
  failure: Schema.String,
});

const RetrieverTool = Tool.make("retriever", {
  description:
    "Retrieve documents from a collection based on a query. Example: retriever(collection: 'uploads', query: 'What is in the collection?')",
  parameters: Schema.Struct({
    query: Schema.String.pipe(
      Schema.annotate({
        description: "The query to use for retrieving documents.",
      }),
    ),
    filename: Schema.NullOr(Schema.String).pipe(
      Schema.annotate({
        description:
          "(optional) The name of the file to retrieve documents from.",
      }),
    ),
  }),
  success: Schema.Struct({
    documents: Schema.Array(
      Schema.Struct({
        id: Schema.NullOr(Schema.String),
        document: Schema.String,
        score: Schema.NullishOr(Schema.Number),
        fileName: Schema.NullOr(Schema.String),
        metadata: Schema.NullOr(DocumentMetadata),
      }),
    ),
  }),
  failure: Schema.String,
});

const DeleteCollectionTool = Tool.make("deleteCollection", {
  description:
    "Delete a collection by name. Example: deleteCollection(collection: 'uploads')",
  parameters: Schema.Struct({
    collection: Schema.String.pipe(
      Schema.annotate({
        default: "uploads",
        description: "The name of the collection to delete.",
      }),
    ),
  }),
  success: Schema.Struct({
    collection: Schema.String,
  }),
  failure: Schema.String,
});

export const RagToolkit = Toolkit.make(
  listDocumentsTool,
  RetrieverTool,
  DeleteCollectionTool,
);

export const RagToolkitLive = RagToolkit.toLayer(
  Effect.gen(function* () {
    const rag = yield* RagService;
    const embedder = yield* EmbeddingModel.EmbeddingModel;
    return {
      listDocuments: (params) =>
        Effect.gen(function* () {
          const listResult = yield* rag.listDocuments({
            collection: "uploads",
            limit: 5,
            ...(params.query ? { query: params.query } : {}),
          });
          return {
            documents: listResult.documents.map((doc) => ({
              id: doc.id,
              document: doc.document ?? "",
              fileName: readMetadataString(doc.metadata, "fileName"),
              metadata: doc.metadata,
            })),
          };
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              "Error listing documents in collection 'uploads': " +
                String(error),
            ),
          ),
        ),
      retriever: (params) =>
        Effect.gen(function* () {
          const embedded = yield* embedder.embed(params.query);
          yield* Effect.log(
            `[RagToolkit] Retrieve embed: queryLength=${params.query.length}, embeddingDims=${embedded.vector.length}`,
          );
          const retrieveResult = yield* rag.retrieve({
            collection: "uploads",
            embedding: [...embedded.vector],
            topK: 3,
            ...(params.filename
              ? { where: { fileName: { $contains: params.filename } } }
              : {}),
          });
          yield* Effect.log(
            `[RagToolkit] Retrieve result: hits=${retrieveResult.hits.length}`,
          );
          return {
            documents:
              retrieveResult.hits.map((hit) => ({
                id: hit.id,
                document: hit.document || "",
                score: hit.score,
                fileName: readMetadataString(hit.metadata, "fileName"),
                metadata: hit.metadata,
              })) ?? [],
          };
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              "Error retrieving documents from collection 'uploads': " +
                String(error),
            ),
          ),
        ),
      deleteCollection: (params) =>
        Effect.gen(function* () {
          return yield* rag.deleteCollection({
            collection: params.collection,
          });
        }).pipe(
          Effect.catch((error) =>
            Effect.fail(
              "Error deleting collection '" +
                params.collection +
                "': " +
                String(error),
            ),
          ),
        ),
    };
  }),
);
