import { OkfService } from "@repo/okf";
import { Console, Effect, Terminal } from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, conceptId } from "../args";
import { ConceptCard } from "../component/ui/ConceptCard";

export const concept = Command.make(
  "concept",
  { bundlePath, conceptId },
  ({ bundlePath, conceptId }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const terminal = yield* Terminal.Terminal;
      const terminalWidth = yield* terminal.columns;
      const width = terminalWidth > 20 ? terminalWidth : 120;

      const { bundle, graph } = yield* okf.make(bundlePath);

      const concept = bundle.concepts.find((c) => c.id === conceptId);
      if (!concept) {
        yield* Console.log(`Concept not found: ${conceptId}`);
        return;
      }
      const card = yield* ConceptCard(concept, graph, width);

      yield* Console.log(yield* Box.renderPretty(card));
    }),
).pipe(Command.withDescription("Print a concept from a bundle"));
