import { OkfService } from "@repo/okf";
import { Array, Console, Effect, Graph, Match, Option, pipe } from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, conceptId } from "../args";
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

const renderNeighbors = (heading: string, nodes: ReadonlyArray<DisplayNode>) =>
  pipe(
    nodes,
    Array.match({
      onEmpty: () => Box.text(`${heading}: none`),
      onNonEmpty: (neighbors) =>
        Box.vcat(
          [Box.text(`${heading}:`), renderNodeList(neighbors)],
          Box.left,
        ),
    }),
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
        Box.vcat(
          [
            Box.hsep(
              [Box.text("Concept:"), Box.text(formatNode(node))],
              1,
              Box.left,
            ),
            renderNeighbors("Incoming", incoming),
            renderNeighbors("Outgoing", outgoing),
          ],
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
  Command.withSubcommands([neighbors, path]),
  Command.withDescription("Print a graph of concepts and their relationships"),
);
