import type { ConceptEdge, ConceptNode } from "@repo/domain/Okf";
import { OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Array, Console, Effect, Graph, pipe, Result } from "effect";
import { EmbeddingModel } from "effect/unstable/ai";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, query } from "../args";
import { json } from "../flags";
import { neighborhood, union } from "../lib/graph-utils";

export const queryCommand = Command.make(
  "query",
  { bundlePath, query, json },
  ({ bundlePath, query, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const rag = yield* RagService;
      const embedder = yield* EmbeddingModel.EmbeddingModel;

      const { bundle, graph } = yield* okf.make(bundlePath);

      const embeddings = yield* embedder.embed(query);

      const collectionName = bundlePath.split("/").pop() || bundle.root;

      const result = yield* rag.retrieve({
        collection: collectionName,
        embedding: [...embeddings.vector],
        topK: 5,
      });

      yield* Effect.log(
        `Retrieved ${result.hits.length} hits from "${collectionName}"`,
      );

      // Map RAG hit IDs to graph node indices (seeds)
      const seeds = Array.filterMap(result.hits, (hit) =>
        Result.fromNullishOr(graph.nodeIndex.get(hit.id), () => undefined),
      );

      // Build subgraph by composing neighborhoods of each seed
      const subgraph = Array.reduce(
        Array.map(seeds, (seed) =>
          neighborhood(graph.graph, seed, { radius: 1 }),
        ),
        Graph.directed<ConceptNode, ConceptEdge>(),
        (acc, g) => union(acc, g, (n) => n.id),
      );

      const mermaid = Graph.toMermaid(subgraph, {
        nodeLabel: (node) => node.id,
        edgeLabel: (edge) => edge.label ?? edge.kind,
      });

      const hitSummary = pipe(
        result.hits,
        Array.map(
          (hit) => `- ${hit.id} (score: ${hit.score?.toFixed(4) ?? "n/a"})`,
        ),
      );

      const payload = {
        query,
        collection: collectionName,
        seeds: result.hits.map((h) => h.id),
        subgraph,
        mermaid,
      };

      const content = yield* Box.renderPretty(
        Box.vsep(
          [
            Box.hsep([Box.text("Query:"), Box.text(query)], 1, Box.left),
            Box.hsep(
              [Box.text("Collection:"), Box.text(collectionName)],
              1,
              Box.left,
            ),
            Box.vcat(
              [Box.text("Hits:"), ...hitSummary.map((line) => Box.text(line))],
              Box.left,
            ),
            Box.hsep(
              [
                Box.text("Full Graph:"),
                Box.text(
                  `${Graph.nodeCount(graph.graph)} nodes, ${Graph.edgeCount(graph.graph)} edges`,
                ),
              ],
              1,
              Box.left,
            ),
            Box.hsep(
              [
                Box.text("Subgraph:"),
                Box.text(
                  `${Graph.nodeCount(subgraph)} nodes, ${Graph.edgeCount(subgraph)} edges`,
                ),
              ],
              1,
              Box.left,
            ),
            Box.text(mermaid),
          ],
          1,
          Box.left,
        ),
      );

      yield* Console.log(json ? JSON.stringify(payload, null, 2) : content);
    }),
).pipe(
  Command.withDescription(
    "Query an OKF bundle in a vector database for semantic search and retrieval",
  ),
);
