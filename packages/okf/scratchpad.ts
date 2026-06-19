import { BunServices } from "@effect/platform-bun";
import { Console, Effect, Graph, Layer } from "effect";
import { OkfService } from "./src";

const main = Effect.gen(function* () {
  yield* Console.log("Hello, OKF Scratchpad!");
  const okf = yield* OkfService;

  const { bundle, graph } = yield* okf.make(
    "../../.reference/okf/okf/bundles/stackoverflow",
  );

  // -- Graph summary --
  yield* Console.log("\n=== Graph Summary ===");
  yield* Console.log(
    `Nodes: ${Graph.nodeCount(graph.graph)}, Edges: ${Graph.edgeCount(graph.graph)}`,
  );

  // -- All nodes --
  yield* Console.log("\n=== Nodes ===");
  for (const [idx, node] of Graph.nodes(graph.graph)) {
    yield* Console.log(`  [${idx}] ${node.id} (${node.type})`);
  }

  // -- All edges --
  yield* Console.log("\n=== Edges ===");
  for (const [idx, edge] of Graph.edges(graph.graph)) {
    yield* Console.log(
      `  [${idx}] ${edge.data.sourceId} -> ${edge.data.targetId} (${edge.data.label ?? "no label"})`,
    );
  }

  // -- Link classification per concept --
  yield* Console.log("\n=== Link Classification ===");
  for (const concept of bundle.concepts) {
    if (concept.links.length === 0) continue;
    yield* Console.log(`\n  ${concept.id}:`);
    for (const link of concept.links) {
      yield* Console.log(`    [${link._tag}] -> ${link.target}`);
    }
  }

  // -- Unresolved links --
  yield* Console.log(
    `\n=== Unresolved Links (${graph.unresolvedLinks.length}) ===`,
  );
  for (const link of graph.unresolvedLinks) {
    yield* Console.log(`  ${link.sourceId} -> ${link.targetId}`);
  }

  // -- Mermaid diagram --
  yield* Console.log("\n=== Mermaid Diagram ===");
  const mermaid = Graph.toMermaid(graph.graph, {
    nodeLabel: (node) => node.id.split("/").pop() ?? node.id,
    edgeLabel: (edge) => edge.label ?? "",
  });
  yield* Console.log(mermaid);
});

const MainLayer = Layer.mergeAll(OkfService.layer).pipe(
  Layer.provideMerge(BunServices.layer),
);

void Effect.runPromise(main.pipe(Effect.provide(MainLayer))).catch((error) => {
  console.error("Error in OKF Scratchpad:", error);
});
