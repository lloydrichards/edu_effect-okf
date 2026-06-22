import { OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Array, Console, Effect, Graph, Option, pipe, Result } from "effect";
import { EmbeddingModel } from "effect/unstable/ai";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, query } from "../args";
import { json } from "../flags";

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

      // Expand seeds to include immediate neighbours (successors + predecessors)
      const keepIds = new Set<string>(
        result.hits
          .map((hit) => hit.id)
          .filter((id) => graph.nodeIndex.has(id)),
      );

      for (const seed of seeds) {
        for (const succ of Graph.successors(graph.graph, seed)) {
          Option.map(Graph.getNode(graph.graph, succ), (node) =>
            keepIds.add(node.id),
          );
        }
        for (const pred of Graph.predecessors(graph.graph, seed)) {
          Option.map(Graph.getNode(graph.graph, pred), (node) =>
            keepIds.add(node.id),
          );
        }
      }

      // Build subgraph containing only seeds + neighbours
      const subgraph = Graph.mutate(graph.graph, (mutable) => {
        Graph.filterNodes(mutable, (node) => keepIds.has(node.id));
      });

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
