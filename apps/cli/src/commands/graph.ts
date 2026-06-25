import { OkfService } from "@repo/okf";
import { Array, Console, Effect, Graph, Match, Option, pipe } from "effect";
import { Command } from "effect/unstable/cli";
import { Box, Flex } from "effect-boxes";
import { bundlePath, conceptId } from "../args";
import { NeighborhoodGraph } from "../component/ui/NeighborhoodGraph";
import { json } from "../flags";

type DisplayNode = {
  readonly id: string;
  readonly title?: string | undefined;
};

const formatNode = (node: DisplayNode): string =>
  pipe(
    node.title === undefined ? Option.none<string>() : Option.some(node.title),
    Option.match({
      onNone: () => node.id,
      onSome: (title) => `${node.id} - ${title}`,
    }),
  );

const conceptNotFoundPayload = (conceptId: string) => ({
  error: "Concept not found",
  conceptId,
});

const renderNodeList = (nodes: ReadonlyArray<DisplayNode>): Box.Box<never> =>
  pipe(
    nodes,
    Array.map((node) => Box.text(`- ${formatNode(node)}`)),
    Box.vcat(Box.left),
  );

const renderPath = (
  from: string,
  to: string,
  nodes: ReadonlyArray<DisplayNode>,
) =>
  Box.vcat(
    [Box.text(`Shortest path from ${from} to ${to}:`), renderNodeList(nodes)],
    Box.left,
  );

const renderGraph = (
  bundle: string,
  nodes: number,
  edges: number,
  unresolvedLinks: number,
  mermaid: string,
) =>
  Box.vcat(
    [
      Box.hsep([Box.text("Bundle:"), Box.text(bundle)], 1, Box.left),
      Box.hsep([Box.text("Nodes:"), Box.text(nodes.toString())], 1, Box.left),
      Box.hsep([Box.text("Edges:"), Box.text(edges.toString())], 1, Box.left),
      Box.hsep(
        [Box.text("Unresolved Links:"), Box.text(unresolvedLinks.toString())],
        1,
        Box.left,
      ),
      Box.text(mermaid),
    ],
    Box.left,
  );

const renderNeighborhood = <N extends DisplayNode, E>(
  graph: Graph.Graph<N, E>,
  nodeIndex: Graph.NodeIndex,
  direction: "incoming" | "outgoing" | "both",
  radius: number,
): Box.Box<never> =>
  NeighborhoodGraph({
    graph,
    nodeIndex,
    radius,
    direction,
    nodeLabel: (node) => node.id,
  });

const renderNeighborhoodPlain = <N extends DisplayNode, E>(
  graph: Graph.Graph<N, E>,
  nodeIndex: Graph.NodeIndex,
  direction: "incoming" | "outgoing" | "both",
  radius: number,
): Box.Box<never> =>
  Box.text(
    Box.renderPlainSync(
      renderNeighborhood(graph, nodeIndex, direction, radius),
    ),
  );

const rootNodes = <N, E>(
  graph: Graph.Graph<N, E>,
): ReadonlyArray<readonly [Graph.NodeIndex, N]> =>
  pipe(
    Array.fromIterable(graph),
    Array.filter(
      ([nodeIndex]) =>
        (graph.reverseAdjacency.get(nodeIndex) ?? []).length === 0 &&
        (graph.adjacency.get(nodeIndex) ?? []).length > 0,
    ),
  );

const neighbors = Command.make(
  "neighbors",
  { bundlePath, conceptId, json },
  ({ bundlePath, conceptId, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const { graph } = yield* okf.make(bundlePath);

      const nodeIndex = graph.nodeIndex.get(conceptId);
      if (nodeIndex === undefined) {
        yield* Console.log(
          Match.value(json).pipe(
            Match.when(true, () =>
              JSON.stringify(conceptNotFoundPayload(conceptId), null, 2),
            ),
            Match.orElse(() => `Concept not found: ${conceptId}`),
          ),
        );
        return;
      }

      const node = yield* pipe(
        Graph.getNode(graph.graph, nodeIndex),
        Option.match({
          onNone: () =>
            Console.log(
              Match.value(json).pipe(
                Match.when(true, () =>
                  JSON.stringify(conceptNotFoundPayload(conceptId), null, 2),
                ),
                Match.orElse(() => `Concept not found: ${conceptId}`),
              ),
            ).pipe(Effect.as(undefined)),
          onSome: (node) => Effect.succeed(node),
        }),
      );

      if (node === undefined) {
        return;
      }

      const incoming = pipe(
        Graph.predecessors(graph.graph, nodeIndex),
        Array.map((neighborIndex) =>
          Option.getOrUndefined(Graph.getNode(graph.graph, neighborIndex)),
        ),
        Array.filter((neighbor) => neighbor !== undefined),
      );

      const outgoing = pipe(
        Graph.successors(graph.graph, nodeIndex),
        Array.map((neighborIndex) =>
          Option.getOrUndefined(Graph.getNode(graph.graph, neighborIndex)),
        ),
        Array.filter((neighbor) => neighbor !== undefined),
      );

      const payload = {
        concept: node,
        incoming,
        outgoing,
      };

      const content = yield* Box.renderPretty(
        Box.vsep(
          [
            Box.hsep(
              [Box.text("Concept:"), Box.text(formatNode(node))],
              1,
              Box.left,
            ),
            renderNeighborhoodPlain(graph.graph, nodeIndex, "both", 2),
          ],
          1,
          Box.left,
        ),
      );

      yield* Console.log(
        Match.value(json).pipe(
          Match.when(true, () => JSON.stringify(payload, null, 2)),
          Match.orElse(() => content),
        ),
      );
    }),
).pipe(
  Command.withDescription("Print neighbors from a concept to another concept"),
);

const topologies = Command.make(
  "topologies",
  { bundlePath, json },
  ({ bundlePath, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const { bundle, graph } = yield* okf.make(bundlePath);
      const roots = pipe(rootNodes(graph.graph), Array.take(3));

      const payload = {
        bundle: bundle.root,
        roots: roots.map(([nodeIndex, node]) => ({
          nodeIndex,
          node,
          outgoingCount: (graph.graph.adjacency.get(nodeIndex) ?? []).length,
        })),
      };

      const charts = roots.map(([nodeIndex, node], index) =>
        Flex.fill(
          (width) =>
            Box.vsep(
              [
                Box.text(`${index + 1}. ${formatNode(node)}`).pipe(
                  Box.truncate(width, Box.left),
                ),
                renderNeighborhoodPlain(graph.graph, nodeIndex, "outgoing", 3),
              ],
              1,
              Box.left,
            ),
          1,
        ),
      );

      const content = yield* Box.renderPretty(
        Box.vsep(
          [
            Box.hsep([Box.text("Bundle:"), Box.text(bundle.root)], 1, Box.left),
            Box.hsep(
              [Box.text("Root Topologies:"), Box.text(roots.length.toString())],
              1,
              Box.left,
            ),
            charts.length === 0
              ? Box.text("No top-level topologies found.")
              : Flex.row(charts, 180, { gap: 2 }),
          ],
          1,
          Box.left,
        ),
      );

      yield* Console.log(
        Match.value(json).pipe(
          Match.when(true, () => JSON.stringify(payload, null, 2)),
          Match.orElse(() => content),
        ),
      );
    }),
).pipe(Command.withDescription("Print top-level graph topology neighborhoods"));

const path = Command.make(
  "path",
  { bundlePath, from: conceptId, to: conceptId, json },
  ({ bundlePath, from, to, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const { graph } = yield* okf.make(bundlePath);

      const fromIndex = graph.nodeIndex.get(from);
      const toIndex = graph.nodeIndex.get(to);

      if (fromIndex === undefined) {
        yield* Console.log(
          Match.value(json).pipe(
            Match.when(true, () =>
              JSON.stringify(conceptNotFoundPayload(from), null, 2),
            ),
            Match.orElse(() => `Concept not found: ${from}`),
          ),
        );
        return;
      }

      if (toIndex === undefined) {
        yield* Console.log(
          Match.value(json).pipe(
            Match.when(true, () =>
              JSON.stringify(conceptNotFoundPayload(to), null, 2),
            ),
            Match.orElse(() => `Concept not found: ${to}`),
          ),
        );
        return;
      }

      const result = Graph.dijkstra(graph.graph, {
        source: fromIndex,
        target: toIndex,
        cost: () => 1,
      });

      if (Option.isNone(result)) {
        yield* Console.log(
          Match.value(json).pipe(
            Match.when(true, () =>
              JSON.stringify({ from, to, path: [] }, null, 2),
            ),
            Match.orElse(() => `No path found from ${from} to ${to}`),
          ),
        );
        return;
      }

      const nodes = pipe(
        result.value.path,
        Array.map((nodeIndex) =>
          Option.getOrUndefined(Graph.getNode(graph.graph, nodeIndex)),
        ),
        Array.filter((node) => node !== undefined),
      );

      const content = yield* Box.renderPretty(renderPath(from, to, nodes));

      yield* Console.log(
        Match.value(json).pipe(
          Match.when(true, () =>
            JSON.stringify({ from, to, path: nodes }, null, 2),
          ),
          Match.orElse(() => content),
        ),
      );
    }),
).pipe(Command.withDescription("Print a path between two concepts"));

export const graph = Command.make(
  "graph",
  { bundlePath, json },
  ({ bundlePath, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const { bundle, graph } = yield* okf.make(bundlePath);

      const mermaid = Graph.toMermaid(graph.graph, {
        nodeLabel: (node) => node.id,
        edgeLabel: (edge) => edge.label ?? edge.kind,
      });

      const payload = {
        bundle: bundle.root,
        nodes: Graph.nodeCount(graph.graph),
        edges: Graph.edgeCount(graph.graph),
        unresolvedLinks: graph.unresolvedLinks,
        mermaid,
      };

      const content = yield* Box.renderPretty(
        renderGraph(
          bundle.root,
          payload.nodes,
          payload.edges,
          payload.unresolvedLinks.length,
          mermaid,
        ),
      );

      yield* Console.log(
        Match.value(json).pipe(
          Match.when(true, () => JSON.stringify(payload, null, 2)),
          Match.orElse(() => content),
        ),
      );
    }),
).pipe(
  Command.withSubcommands([neighbors, path, topologies]),
  Command.withDescription("Print a graph of concepts and their relationships"),
);
