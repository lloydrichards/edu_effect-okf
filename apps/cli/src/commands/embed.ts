import { OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Console, Effect } from "effect";
import { EmbeddingModel } from "effect/unstable/ai";
import { Command } from "effect/unstable/cli";
import { bundlePath } from "../args";
import { reset } from "../flags";

const conceptEmbeddingText = (concept: {
  readonly id: string;
    readonly body?: string;
    readonly frontmatter: {
    readonly title?: string | undefined;
    readonly description?: string | undefined;
    readonly tags?: ReadonlyArray<string> | undefined;
  };
}) =>
  [
    `ID: ${concept.id}`,
    concept.frontmatter.title ? `Title: ${concept.frontmatter.title}` : null,
    concept.frontmatter.description
      ? `Description: ${concept.frontmatter.description}`
      : null,
    concept.frontmatter.tags?.length
      ? `Tags: ${concept.frontmatter.tags.join(", ")}`
      : null,
    concept.body ? `Body: ${concept.body}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");

export const embed = Command.make("embed", { bundlePath, reset }, ({ bundlePath, reset }) =>
  Effect.gen(function* () {
    const okf = yield* OkfService;
    const rag = yield* RagService;
    const embedder = yield* EmbeddingModel.EmbeddingModel;

    const { bundle, graph } = yield* okf.make(bundlePath);

    const documents = bundle.concepts.map(conceptEmbeddingText);

    const embeddings = yield* embedder.embedMany(documents);

    const collectionName = bundlePath.split("/").pop() || bundle.root;

    if (reset) {
      yield* rag.deleteCollection({ collection: collectionName }).pipe(
        Effect.catch(() => Effect.void),
      );
    }

    const result = yield* rag.ingest({
      collection: collectionName,
      ids: bundle.concepts.map((c) => c.id),
      embeddings: embeddings.embeddings.map((e) => [...e.vector]),
      documents,
      metadatas: bundle.concepts.map((c) => ({
        graphNode: graph.nodeIndex.get(c.id) || "",
        conceptId: c.id,
      })),
    });

    yield* Console.log(
      `Ingested ${result.count} documents into collection "${collectionName}"${reset ? " after reset" : ""}`,
    );
  }),
).pipe(
  Command.withDescription(
    "Embed an OKF bundle into a vector database for semantic search and retrieval",
  ),
);
