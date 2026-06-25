import { OkfService } from "@repo/okf";
import { Console, Effect, Terminal } from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, conceptId } from "../args";
import { NeighborhoodExplorer } from "../component/NeighborhoodExplorer";
import { ConceptCard } from "../component/ui/ConceptCard";
import { interactive } from "../flags";

export const concept = Command.make(
  "concept",
  { bundlePath, conceptId, interactive },
  ({ bundlePath, conceptId, interactive }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const terminal = yield* Terminal.Terminal;
      const terminalWidth = yield* terminal.columns;
      const width = terminalWidth > 20 ? terminalWidth : 120;

      const { bundle, graph } = yield* okf.make(bundlePath);

      const concept = pipe(
        bundle.concepts,
        Arr.findFirst((c) => c.id === conceptId),
      );
      if (Option.isNone(concept)) {
        yield* Console.log(`Concept not found: ${conceptId}`);
        return;
      }
      let selectedConcept = concept.value;
      if (interactive) {
        const nodeIndex = graph.nodeIndex.get(selectedConcept.id);
        const selectedNodeIndex = yield* NeighborhoodExplorer({
          graph: graph.graph,
          nodeIndex: nodeIndex || 0,
          radius: 2,
          nodeLabel: (node) => node.title || "",
        });

        selectedConcept = pipe(
          Graph.getNode(graph.graph, selectedNodeIndex),
          Option.flatMap((node) =>
            pipe(
              bundle.concepts,
              Arr.findFirst((concept) => concept.id === node.id),
            ),
          ),
          Option.getOrElse(() => selectedConcept),
        );
      }
      const card = yield* ConceptCard(selectedConcept, graph, width);

      yield* Console.log(yield* Box.renderPretty(card));
    }),
).pipe(Command.withDescription("Print a concept from a bundle"));
