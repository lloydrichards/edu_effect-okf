import { OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Console, Effect } from "effect";
import { EmbeddingModel } from "effect/unstable/ai";
import { Command } from "effect/unstable/cli";
import { bundlePath } from "../args";

export const embed = Command.make("embed", { bundlePath }, ({ bundlePath }) =>
  Effect.gen(function* () {
    const okf = yield* OkfService;
    const rag = yield* RagService;
    const embedder = yield* EmbeddingModel.EmbeddingModel;

    const { bundle, graph } = yield* okf.make(bundlePath);

    const embeddings = yield* embedder.embedMany(
      bundle.concepts.map((c) => c.body),
    );

    const collectionName = bundlePath.split("/").pop() || bundle.root;

    const result = yield* rag.ingest({
      collection: collectionName,
      ids: bundle.concepts.map((c) => c.id),
      embeddings: embeddings.embeddings.map((e) => [...e.vector]),
      documents: bundle.concepts.map((c) => c.body),
      metadatas: bundle.concepts.map((c) => ({
        graphNode: graph.nodeIndex.get(c.id) || "",
        conceptId: c.id,
      })),
    });

    yield* Console.log(
      `Ingested ${result.count} documents into collection "${collectionName}"`,
    );
  }),
).pipe(
  Command.withDescription(
    "Embed an OKF bundle into a vector database for semantic search and retrieval",
  ),
);
