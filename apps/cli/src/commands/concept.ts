import { OkfService } from "@repo/okf";
import { Console, Effect, Terminal } from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath, conceptId } from "../args";

export const concept = Command.make(
  "concept",
  { bundlePath, conceptId },
  ({ bundlePath, conceptId }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;
      const terminal = yield* Terminal.Terminal;
      const width = yield* terminal.columns;
      const { bundle } = yield* okf.make(bundlePath);

      const concept = bundle.concepts.find((c) => c.id === conceptId);
      if (!concept) {
        yield* Console.log(`Concept not found: ${conceptId}`);
        return;
      }

      const content = yield* Box.renderPretty(
        Box.vcat(
          [
            Box.hsep(
              [Box.text("Concept ID:"), Box.text(concept.id)],
              1,
              Box.left,
            ),
            Box.text(concept.body).pipe(
              Box.maxWidth(width - 4),
              Box.border("rounded"),
            ),
            Box.hsep(
              [Box.text("Links:"), Box.text(concept.links.length.toString())],
              1,
              Box.left,
            ),
          ],
          Box.left,
        ),
      );
      yield* Console.log(content);
    }),
).pipe(Command.withDescription("Print a concept from a bundle"));
