import { BunRuntime, BunServices } from "@effect/platform-bun";
import { MarkdownService, OkfService } from "@repo/okf";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { bundle } from "./commands/bundle";
import { concept } from "./commands/concept";
import { graph } from "./commands/graph";
import { validate } from "./commands/validate";

// ============================================================================
// Root Command
// ============================================================================

const root = Command.make("okf");

// ============================================================================
// Program
// ============================================================================

// Subcommands - modules inject additional subcommands via Command.withSubcommands
const AllCommands = Command.withSubcommands([concept, bundle, graph, validate]);

const MainLayer = Layer.mergeAll(OkfService.layer, MarkdownService.layer).pipe(
  Layer.provideMerge(BunServices.layer),
);

root.pipe(
  AllCommands,
  Command.run({ version: "0.0.0" }),
  Effect.provide(MainLayer),
  BunRuntime.runMain,
);
