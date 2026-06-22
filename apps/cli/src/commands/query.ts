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
        minDistance: 1,
      });

      yield* Effect.log(
        `Retrieved ${result.length} hits from "${collectionName}"`,
      );

      // Map RAG hit IDs to graph node indices (seeds)
      const seeds = Array.filterMap(result, (hit) =>
        Result.fromNullishOr(graph.nodeIndex.get(hit.id), () => undefined),
      );

      // Build subgraph by composing neighborhoods of each seed
      const subgraph = Array.reduce(
        Array.map(seeds, (seed) =>
          neighborhood(graph.graph, seed, { radius: 2 }),
        ),
        Graph.directed<ConceptNode, ConceptEdge>(),
        (acc, g) => union(acc, g, (n) => n.id),
      );

      const mermaid = Graph.toMermaid(subgraph, {
        nodeLabel: (node) => node.id,
        edgeLabel: (edge) => edge.label ?? edge.kind,
      });

      const hitSummary = pipe(
        result,
        Array.map(
          (hit) => `- ${hit.id} (score: ${hit.distance?.toFixed(4) ?? "n/a"})`,
        ),
      );

      // Build a hit lookup for marking direct matches
      const hitScores = new Map(result.map((h) => [h.id, h.distance] as const));

      // Build index map: nodeIndex -> node id (for resolving edge endpoints)
      const indexToId = new Map<Graph.NodeIndex, string>();
      for (const [idx, node] of subgraph) {
        indexToId.set(idx, node.id);
      }

      // Collect edges per node (keyed by source node id)
      const edgesByNode = new Map<
        string,
        Array<{ target: string; kind: string; label?: string | undefined }>
      >();
      for (const [, edge] of Graph.edges(subgraph)) {
        const sourceId = indexToId.get(edge.source) ?? edge.data.sourceId;
        const targetId = indexToId.get(edge.target) ?? edge.data.targetId;
        const entry = {
          target: targetId,
          kind: edge.data.kind,
          label: edge.data.label,
        };
        const existing = edgesByNode.get(sourceId);
        if (existing) existing.push(entry);
        else edgesByNode.set(sourceId, [entry]);
      }

      // Serialize nodes with their outgoing edges embedded
      const nodes = Array.fromIterable(subgraph).map(([, node]) => ({
        id: node.id,
        nodeId: graph.nodeIndex.get(node.id) ?? -1,
        type: node.type,
        path: node.path,
        title: node.title,
        description: node.description,
        tags: node.tags,
        isHit: hitScores.has(node.id),
        ...(hitScores.has(node.id) ? { score: hitScores.get(node.id) } : {}),
        edges: edgesByNode.get(node.id) ?? [],
      }));

      const payload = {
        query,
        collection: collectionName,
        subgraph: {
          summary: {
            nodeCount: Graph.nodeCount(subgraph),
            edgeCount: Graph.edgeCount(subgraph),
            hitCount: result.length,
            neighborCount: Graph.nodeCount(subgraph) - result.length,
          },
          nodes,
        },
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
