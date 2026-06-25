import { BunRuntime, BunServices } from "@effect/platform-bun";
import { EmbeddingModelLive } from "@repo/ai";
import { MarkdownService, OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Cause, Console, Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { Ansi, Box, Cmd } from "effect-boxes";
import { bundle } from "./commands/bundle";
import { concept } from "./commands/concept";
import { embed } from "./commands/embed";
import { graph } from "./commands/graph";
import { queryCommand } from "./commands/query";
import { validate } from "./commands/validate";

// ============================================================================
// Root Command
// ============================================================================

const root = Command.make("okf");

// ============================================================================
// Program
// ============================================================================

// Subcommands - modules inject additional subcommands via Command.withSubcommands
const AllCommands = Command.withSubcommands([
  concept,
  bundle,
  graph,
  validate,
  embed,
  queryCommand,
]);

const MainLayer = Layer.mergeAll(
  OkfService.layer,
  MarkdownService.layer,
  RagService.Default,
  EmbeddingModelLive,
).pipe(Layer.provideMerge(BunServices.layer));

const restoreTerminal = Box.renderPretty(
  Box.combineAll([Cmd.cursorShow, Cmd.altScreenLeave]),
).pipe(Effect.catch(() => Effect.void));

root.pipe(
  AllCommands,
  Command.run({ version: "0.0.0" }),
  Effect.provide(MainLayer),
  Effect.catchCause((cause) =>
    Effect.gen(function* () {
      yield* restoreTerminal;

      if (Cause.hasInterruptsOnly(cause)) {
        const message = Box.vsep(
          [
            Box.text("Interrupted.").pipe(
              Box.annotate(Ansi.combine(Ansi.bold, Ansi.yellow)),
            ),
            Box.text("Goodbye! Come back when you're ready to stack."),
          ],
          1,
          Box.center1,
        ).pipe(
          Box.pad(0, 1),
          Box.border("rounded", { annotation: Ansi.yellow }),
          Box.moveDown(1),
        );
        return yield* Console.log(`\n${Box.renderPrettySync(message)}`);
      }
      return yield* Console.log(
        `\n${Box.renderPrettySync(Box.text(Cause.pretty(cause)))}`,
      );
    }),
  ),
  BunRuntime.runMain,
);
